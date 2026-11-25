import { exportData } from "./export";
import { z, ZodError } from "zod";
import { verifyPassword } from "better-auth/crypto";
import { createAuth } from "./auth";
import { json, readJson, HttpError, type Env } from "./types";
import {
  editableSchemas,
  settingsSchema,
  daySchema,
  mealSchema,
  defaults,
  type EditableKind,
} from "../src/lib/domain";
import { owned, decode, quota, type Row } from "./db";
import { connect, status, sync } from "./intervals";
import { analyze, isAiConfigured } from "./ai";
const writeSchema = z.object({
  kind: z.enum([
    "meal",
    "recipe",
    "weight",
    "water",
    "measurement",
    "plan",
    "session",
  ]),
  date: daySchema,
  data: z.unknown(),
  requestId: z.string().uuid(),
});
const allowedKinds = [
  "meal",
  "recipe",
  "weight",
  "water",
  "measurement",
  "plan",
  "session",
  "activity",
  "wellness",
];
export async function handlePrivate(
  request: Request,
  env: Env,
  user: { id: string; email: string; name: string },
) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (method !== "GET")
    await quota(
      env.DB,
      `write:${user.id}:${new Date().toISOString().slice(0, 16)}`,
      90,
      new Date(Date.now() + 3600000).toISOString(),
    );
  if (path === "/api/capabilities" && method === "GET")
    return json({
      ai: isAiConfigured(env),
      photo: isAiConfigured(env) && env.AI_VISION_ENABLED === "true",
    });
  if (path === "/api/settings") {
    if (method === "GET") {
      const row = await env.DB.prepare(
        "SELECT data FROM settings WHERE user_id=?",
      )
        .bind(user.id)
        .first<{ data: string }>();
      return json(
        row
          ? JSON.parse(row.data)
          : { ...defaults, displayName: user.name, timezone: "UTC" },
      );
    }
    if (method === "PUT") {
      const data = settingsSchema.parse(await readJson(request));
      await env.DB.prepare(
        "INSERT INTO settings(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
      )
        .bind(user.id, JSON.stringify(data), new Date().toISOString())
        .run();
      return json(data);
    }
  }
  if (path === "/api/records" && method === "GET") {
    const kind = url.searchParams.get("kind") || "meal";
    if (!allowedKinds.includes(kind))
      throw new HttpError(400, "Invalid record type");
    const from = daySchema.parse(url.searchParams.get("from") || "1900-01-01");
    const to = daySchema.parse(url.searchParams.get("to") || "9999-12-31");
    const limit = Math.min(
      200,
      Math.max(1, Number(url.searchParams.get("limit") || 100)),
    );
    if (!Number.isInteger(limit)) throw new HttpError(400, "Invalid page size");
    const cursor = url.searchParams.get("cursor");
    const query = z
      .string()
      .max(160)
      .parse(url.searchParams.get("q") || "")
      .trim()
      .toLowerCase();
    let cursorDate = "9999-12-31",
      cursorId = "~";
    if (cursor) {
      const parts = cursor.split("|");
      cursorDate = daySchema.parse(parts[0]);
      cursorId = z.string().uuid().parse(parts[1]);
    }
    const rows = await env.DB.prepare(
      "SELECT id,kind,date,data,created_at,updated_at FROM records WHERE user_id=? AND kind=? AND date BETWEEN ? AND ? AND (date < ? OR (date=? AND id<?)) AND (?='' OR instr(lower(COALESCE(json_extract(data,'$.title'),'') || ' ' || COALESCE(json_extract(data,'$.notes'),'') || ' ' || COALESCE((SELECT group_concat(json_extract(value,'$.name'),' ') FROM json_each(records.data,'$.foods')),'')),?)>0) ORDER BY date DESC,id DESC LIMIT ?",
    )
      .bind(
        user.id,
        kind,
        from,
        to,
        cursorDate,
        cursorDate,
        cursorId,
        query,
        query,
        limit + 1,
      )
      .all<Row>();
    const items = rows.results.slice(0, limit);
    const last = items.at(-1);
    return json({
      items: items.map(decode),
      cursor:
        rows.results.length > limit && last ? `${last.date}|${last.id}` : null,
    });
  }
  if (path === "/api/meals/copy-day" && method === "POST") {
    const input = z
      .object({
        date: daySchema,
        requestId: z.string().uuid(),
        meals: z.array(mealSchema).min(1).max(100),
      })
      .parse(await readJson(request, 1000000));
    const now = new Date().toISOString();
    await env.DB.batch(
      input.meals.map((meal, index) =>
        env.DB.prepare(
          "INSERT INTO records(id,user_id,kind,date,data,created_at,updated_at,request_id) VALUES(?,?,'meal',?,?,?,?,?) ON CONFLICT(user_id,request_id) DO NOTHING",
        ).bind(
          crypto.randomUUID(),
          user.id,
          input.date,
          JSON.stringify({ ...meal, source: "copy" }),
          now,
          now,
          `copy-day:${input.requestId}:${index}`,
        ),
      ),
    );
    const result = await env.DB.prepare(
      "SELECT id,kind,date,data,created_at,updated_at FROM records WHERE user_id=? AND request_id LIKE ? ORDER BY data",
    )
      .bind(user.id, `copy-day:${input.requestId}:%`)
      .all<Row>();
    return json({ items: result.results.map(decode) }, 201);
  }
  if (path === "/api/records" && method === "POST") {
    const input = writeSchema.parse(
      await readJson(request, 1000000, (value) =>
        value !== null &&
        typeof value === "object" &&
        "kind" in value &&
        value.kind === "plan"
          ? 1000000
          : 150000,
      ),
    );
    const data = editableSchemas[input.kind].parse(input.data);
    if (input.kind === "session") await validateActivity(env, user.id, data);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO records(id,user_id,kind,date,data,created_at,updated_at,request_id) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,request_id) DO NOTHING",
    )
      .bind(
        id,
        user.id,
        input.kind,
        input.date,
        JSON.stringify(data),
        now,
        now,
        input.requestId,
      )
      .run();
    const row = await env.DB.prepare(
      "SELECT id,kind,date,data,created_at,updated_at FROM records WHERE user_id=? AND request_id=?",
    )
      .bind(user.id, input.requestId)
      .first<Row>();
    return json(decode(row!), 201);
  }
  const match = path.match(/^\/api\/records\/([a-f0-9-]+)$/);
  if (match) {
    const entry = await owned(env.DB, user.id, match[1]);
    if (method === "GET") return json(entry);
    if (["activity", "wellness"].includes(entry.kind))
      throw new HttpError(
        400,
        "Imported records are managed by synchronization",
      );
    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM records WHERE id=? AND user_id=?")
        .bind(entry.id, user.id)
        .run();
      return json({ deleted: true });
    }
    if (method === "PUT") {
      const input = z
        .object({ date: daySchema, data: z.unknown(), updatedAt: z.string() })
        .parse(
          await readJson(request, entry.kind === "plan" ? 1000000 : 150000),
        );
      const data = editableSchemas[entry.kind as EditableKind].parse(
        input.data,
      );
      if (entry.kind === "session") await validateActivity(env, user.id, data);
      const result = await env.DB.prepare(
        "UPDATE records SET date=?,data=?,updated_at=? WHERE id=? AND user_id=? AND updated_at=?",
      )
        .bind(
          input.date,
          JSON.stringify(data),
          new Date().toISOString(),
          entry.id,
          user.id,
          input.updatedAt,
        )
        .run();
      if (!result.meta.changes)
        throw new HttpError(409, "This record changed. Reload before editing.");
      return json(await owned(env.DB, user.id, entry.id));
    }
  }
  if (path === "/api/progress" && method === "GET") {
    const from = daySchema.parse(url.searchParams.get("from") || "1900-01-01");
    const to = daySchema.parse(url.searchParams.get("to") || "9999-12-31");
    const grouping =
      url.searchParams.get("group") === "month" ? "%Y-%m" : "%Y-%m-%d";
    const rows = await env.DB.prepare(
      `SELECT strftime(?,date) AS period,kind,COUNT(*) AS entries,COUNT(DISTINCT date) AS loggedDays,
   SUM(CASE WHEN kind='meal' THEN (SELECT SUM(json_extract(value,'$.calories')) FROM json_each(records.data,'$.foods')) END) AS calories,
   SUM(CASE WHEN kind='meal' THEN (SELECT SUM(json_extract(value,'$.protein')) FROM json_each(records.data,'$.foods')) END) AS protein,
   SUM(CASE WHEN kind='meal' THEN (SELECT SUM(json_extract(value,'$.carbs')) FROM json_each(records.data,'$.foods')) END) AS carbs,
   SUM(CASE WHEN kind='meal' THEN (SELECT SUM(json_extract(value,'$.fat')) FROM json_each(records.data,'$.foods')) END) AS fat,
   SUM(CASE WHEN kind='meal' THEN (SELECT SUM(json_extract(value,'$.fiber')) FROM json_each(records.data,'$.foods')) END) AS fiber,
   AVG(CASE WHEN kind='weight' THEN json_extract(data,'$.kg') END) AS weightKg,
   SUM(CASE WHEN kind='water' THEN json_extract(data,'$.ml') END) AS waterMl,
   AVG(CASE WHEN kind='wellness' THEN json_extract(data,'$.sleepSeconds') END) AS sleepSeconds,
   AVG(CASE WHEN kind='wellness' THEN json_extract(data,'$.steps') END) AS steps,
   AVG(CASE WHEN kind='wellness' THEN json_extract(data,'$.restingHR') END) AS restingHR,
   AVG(CASE WHEN kind='wellness' THEN (SELECT json_extract(value,'$.value') FROM json_each(records.data,'$.hrv') WHERE json_extract(value,'$.type')='rMSSD') END) AS rmssd,
   AVG(CASE WHEN kind='wellness' THEN (SELECT json_extract(value,'$.value') FROM json_each(records.data,'$.hrv') WHERE json_extract(value,'$.type')='SDNN') END) AS sdnn
   FROM records WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY period,kind ORDER BY period`,
    )
      .bind(grouping, user.id, from, to)
      .all();
    return json(rows.results);
  }
  if (path === "/api/integration") {
    if (method === "GET") return json(await status(env, user.id));
    if (method === "POST") {
      await connect(env, user.id, await readJson(request));
      return json({ connected: true });
    }
    if (method === "DELETE") {
      const input = z
        .object({ deleteHistory: z.boolean() })
        .parse(await readJson(request));
      const statements = [
        env.DB.prepare("DELETE FROM integrations WHERE user_id=?").bind(
          user.id,
        ),
      ];
      if (input.deleteHistory) {
        statements.push(
          env.DB.prepare(
            "DELETE FROM records WHERE user_id=? AND kind IN ('wellness','activity')",
          ).bind(user.id),
        );
        statements.push(
          env.DB.prepare(
            "UPDATE records SET data=json_set(data,'$.activityId',NULL) WHERE user_id=? AND kind='session'",
          ).bind(user.id),
        );
      }
      await env.DB.batch(statements);
      return json({ disconnected: true });
    }
  }
  if (path === "/api/sync" && method === "POST") {
    const input = z
      .object({ manual: z.boolean().default(false) })
      .parse(await readJson(request));
    const settings = await env.DB.prepare(
      "SELECT data FROM settings WHERE user_id=?",
    )
      .bind(user.id)
      .first<{ data: string }>();
    return json(
      await sync(
        env,
        user.id,
        settings
          ? settingsSchema.parse(JSON.parse(settings.data)).timezone
          : "UTC",
        input.manual,
      ),
    );
  }
  if (path === "/api/ai" && method === "POST")
    return json(await analyze(env, user.id, await readJson(request, 600000)));
  if (path === "/api/export" && method === "GET")
    return exportData(env, user.id);
  if (path === "/api/account" && method === "DELETE") {
    const input = z
      .object({
        confirmation: z.literal("DELETE MY ACCOUNT"),
        password: z.string().max(128),
      })
      .parse(await readJson(request));
    const account = await env.DB.prepare(
      "SELECT password FROM account WHERE userId=? AND providerId='credential'",
    )
      .bind(user.id)
      .first<{ password: string }>();
    if (
      !account?.password ||
      !(await verifyPassword({
        hash: account.password,
        password: input.password,
      }))
    )
      throw new HttpError(403, "Password confirmation failed");
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM verification WHERE identifier=? OR identifier=? OR identifier=?",
      ).bind(
        user.email,
        `email-verification-otp-${user.email}`,
        `forget-password-otp-${user.email}`,
      ),
      env.DB.prepare("DELETE FROM ai_requests WHERE user_id=?").bind(user.id),
      env.DB.prepare(
        "DELETE FROM usage WHERE bucket LIKE ? OR bucket LIKE ?",
      ).bind(`ai:user:${user.id}:%`, `write:${user.id}:%`),
      env.DB.prepare("DELETE FROM user WHERE id=?").bind(user.id),
    ]);
    return json({ deleted: true });
  }
  throw new HttpError(404, "Endpoint not found");
}
async function validateActivity(env: Env, userId: string, data: unknown) {
  const parsed = editableSchemas.session.parse(data);
  if (parsed.activityId) {
    const activity = await owned(env.DB, userId, parsed.activityId);
    if (activity.kind !== "activity")
      throw new HttpError(400, "Invalid activity link");
  }
}
export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/api/health" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(
          "SELECT version FROM schema_version WHERE version=3",
        ).first();
        await env.DB.prepare(
          "SELECT r.id,s.user_id,i.user_id,a.request_id,u.id,se.id,ac.id,v.id,rl.id,us.bucket FROM records r,settings s,integrations i,ai_requests a,user u,session se,account ac,verification v,rateLimit rl,usage us LIMIT 0",
        ).all();
        return json(
          {
            status: result ? "ok" : "unavailable",
            database: !!result,
            ai: isAiConfigured(env),
            aiConfiguration: {
              enabled: env.AI_ENABLED === "true",
              modelConfigured: !!env.GROQ_MODEL,
              keyConfigured: !!env.GROQ_API_KEY,
            },
          },
          result ? 200 : 503,
        );
      } catch {
        return json({ status: "unavailable", database: false }, 503);
      }
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.get("origin") !== new URL(env.APP_URL).origin
    )
      throw new HttpError(403, "Origin not allowed");
    if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
      throw new HttpError(503, "Authentication is not configured");
    const auth = createAuth(env);
    if (path.startsWith("/api/auth/")) {
      // Only the documented password + OTP flows are exposed, avoiding unused sign-in variants.
      const routes = [
        "/sign-up/email",
        "/sign-in/email",
        "/sign-out",
        "/get-session",
        "/email-otp/send-verification-otp",
        "/email-otp/verify-email",
        "/email-otp/request-password-reset",
        "/email-otp/reset-password",
      ];
      if (!routes.includes(path.slice(9)))
        throw new HttpError(404, "Endpoint not found");
      if (path.includes("sign-up") && !env.RESEND_API_KEY)
        throw new HttpError(503, "Registration awaits email configuration");
      const response = await auth.handler(request);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      // Generic signup response avoids confirming whether an email is registered.
      if (path.endsWith("/sign-up/email") && response.status < 500)
        return json({
          message:
            "If registration is possible, a verification code has been sent.",
        });
      return new Response(response.body, { status: response.status, headers });
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new HttpError(401, "Please sign in");
    if (!session.user.emailVerified)
      throw new HttpError(403, "Verify your email before continuing");
    return await handlePrivate(request, env, session.user);
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json(
        {
          error: "Please check your input",
          issues: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        400,
      );
    return json(
      { error: "Request could not be completed. Please try again." },
      500,
    );
  }
}
