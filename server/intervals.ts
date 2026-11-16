import { z } from "zod";
import {
  addDays,
  daySchema,
  dayInZone,
  type Wellness,
  type Activity,
} from "../src/lib/domain";
import { encrypt, decrypt } from "./crypto";
import { HttpError, type Env } from "./types";
import { quota } from "./db";
const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
const label = (value: unknown, fallback: string) =>
  typeof value === "string" ? value.slice(0, 160) : fallback;
export function normalizeWellness(
  raw: Record<string, unknown>,
  fetchedAt: string,
): Wellness {
  const hrv: Wellness["hrv"] = [];
  if (number(raw.hrv) !== null)
    hrv.push({ value: number(raw.hrv)!, type: "rMSSD", unit: "ms" });
  if (number(raw.hrvSDNN) !== null)
    hrv.push({ value: number(raw.hrvSDNN)!, type: "SDNN", unit: "ms" });
  return {
    sleepSeconds: number(raw.sleepSecs),
    sleepScore: number(raw.sleepScore),
    steps: number(raw.steps),
    restingHR: number(raw.restingHR),
    hrv,
    workoutCalories: null,
    activeCalories: null,
    totalExpenditure: null,
    sourceDate: daySchema.parse(raw.id),
    fetchedAt,
  };
}
export function normalizeActivity(
  raw: Record<string, unknown>,
  fetchedAt: string,
): Activity {
  if (typeof raw.id !== "string" || typeof raw.start_date_local !== "string")
    throw new Error("Invalid source activity");
  return {
    name: label(raw.name, "Activity"),
    type: label(raw.type, "Unknown"),
    start: raw.start_date_local,
    seconds: number(raw.moving_time),
    metres: number(raw.distance),
    averageHR: number(raw.average_heartrate),
    maxHR: number(raw.max_heartrate),
    workoutCalories: number(raw.calories),
    trainingLoad: number(raw.icu_training_load),
    sourceId: raw.id,
    fetchedAt,
  };
}
async function upstream(env: Env, athlete: string, key: string, path: string) {
  await quota(
    env.DB,
    `intervals:second:${new Date().toISOString().slice(0, 19)}`,
    5,
    new Date(Date.now() + 60000).toISOString(),
  );
  const response = await fetch(
    `https://intervals.icu/api/v1/athlete/${encodeURIComponent(athlete)}${path}`,
    {
      headers: {
        Authorization: `Basic ${btoa(`API_KEY:${key}`)}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (response.status === 429) {
    const retry = response.headers.get("Retry-After");
    const seconds =
      retry && /^\d+$/.test(retry)
        ? Number(retry)
        : retry
          ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
          : 60;
    throw new HttpError(
      429,
      "Provider rate limit; retry later",
      Number.isFinite(seconds) ? seconds : 60,
    );
  }
  if (!response.ok)
    throw new HttpError(
      502,
      "Intervals.icu request failed. Check your connection.",
    );
  const body = await response.text();
  if (body.length > 4000000)
    throw new HttpError(
      502,
      "Provider response too large; choose a smaller import range",
    );
  return JSON.parse(body) as unknown;
}
export const connectionSchema = z.object({
  athleteId: z.string().regex(/^i?\d{1,15}$/),
  apiKey: z
    .string()
    .min(8)
    .max(300)
    .regex(/^[\x21-\x7E]+$/),
  startDate: daySchema,
});
export async function connect(env: Env, userId: string, input: unknown) {
  if (!env.INTEGRATION_ENCRYPTION_KEY)
    throw new HttpError(503, "Integration encryption is not configured");
  const value = connectionSchema.parse(input);
  if (value.startDate > dayInZone())
    throw new HttpError(400, "Start date must not be in the future");
  const athlete = (await upstream(env, value.athleteId, value.apiKey, "")) as {
    id?: string;
  };
  if (athlete.id !== value.athleteId)
    throw new HttpError(400, "Credentials do not match that athlete");
  const credential = await encrypt(
    value.apiKey,
    env.INTEGRATION_ENCRYPTION_KEY,
    userId,
  );
  const existing = await env.DB.prepare(
    "SELECT athlete_id FROM integrations WHERE user_id=?",
  )
    .bind(userId)
    .first<{ athlete_id: string }>();
  if (existing && existing.athlete_id !== value.athleteId)
    throw new HttpError(
      409,
      "Disconnect and delete imported history before connecting a different athlete",
    );
  const otherSource = await env.DB.prepare(
    "SELECT id FROM records WHERE user_id=? AND kind IN ('activity','wellness') AND (source_account IS NULL OR source_account<>?) LIMIT 1",
  )
    .bind(userId, value.athleteId)
    .first();
  if (otherSource)
    throw new HttpError(
      409,
      "Delete previously imported history before switching athlete accounts.",
    );
  await env.DB.prepare(
    "INSERT INTO integrations(user_id,athlete_id,credential,start_date,cursor) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET credential=excluded.credential,start_date=excluded.start_date,cursor=excluded.cursor,status='connected',error=NULL",
  )
    .bind(userId, value.athleteId, credential, value.startDate, value.startDate)
    .run();
}
export async function status(env: Env, userId: string) {
  return await env.DB.prepare(
    "SELECT athlete_id,start_date,cursor,imported_through,earliest_wellness,earliest_activity,latest_wellness,latest_activity,last_success,next_retry,status,error FROM integrations WHERE user_id=?",
  )
    .bind(userId)
    .first();
}
type Connection = {
  athlete_id: string;
  credential: string;
  start_date: string;
  cursor: string;
  imported_through: string | null;
  last_success: string | null;
  next_retry: string | null;
  failures: number;
};
export async function sync(
  env: Env,
  userId: string,
  timezone: string,
  manual = false,
) {
  const state = await env.DB.prepare(
    "SELECT * FROM integrations WHERE user_id=?",
  )
    .bind(userId)
    .first<Connection>();
  if (!state) return { connected: false };
  const now = new Date().toISOString();
  if (state.next_retry && state.next_retry > now)
    throw new HttpError(
      429,
      "Sync is backing off; retry after the time shown in Settings",
    );
  if (
    !manual &&
    state.last_success &&
    Date.now() - Date.parse(state.last_success) < 15 * 60 * 1000
  )
    return { throttled: true };
  const leaseId = crypto.randomUUID();
  const lock = await env.DB.prepare(
    "UPDATE integrations SET lease_until=?,lease_id=? WHERE user_id=? AND (lease_until IS NULL OR lease_until<?) RETURNING user_id",
  )
    .bind(new Date(Date.now() + 90000).toISOString(), leaseId, userId, now)
    .first();
  if (!lock) return { busy: true };
  try {
    if (!env.INTEGRATION_ENCRYPTION_KEY)
      throw new Error("Missing encryption key");
    const key = await decrypt(
      state.credential,
      env.INTEGRATION_ENCRYPTION_KEY,
      userId,
    );
    const today = dayInZone(new Date(), timezone);
    const oldest =
      state.cursor > today
        ? addDays(today, -14) > state.start_date
          ? addDays(today, -14)
          : state.start_date
        : state.cursor;
    const newest = addDays(oldest, 29) > today ? today : addDays(oldest, 29);
    const wellness = z
      .array(z.record(z.string(), z.unknown()))
      .max(1000)
      .parse(
        await upstream(
          env,
          state.athlete_id,
          key,
          `/wellness?oldest=${oldest}&newest=${newest}`,
        ),
      );
    const activities = z
      .array(z.record(z.string(), z.unknown()))
      .max(2000)
      .parse(
        await upstream(
          env,
          state.athlete_id,
          key,
          `/activities?oldest=${oldest}&newest=${newest}`,
        ),
      );
    if (wellness.length === 1000 || activities.length >= 1000)
      throw new HttpError(
        502,
        "Batch may be truncated; import paused for review. Cached history is retained.",
      );
    const items = [
      ...wellness
        .filter((raw) =>
          [
            "sleepSecs",
            "sleepScore",
            "steps",
            "restingHR",
            "hrv",
            "hrvSDNN",
          ].some((k) => number(raw[k]) !== null),
        )
        .map((raw) => ({
          kind: "wellness",
          date: daySchema.parse(raw.id),
          sourceId: String(raw.id),
          data: normalizeWellness(raw, now),
        })),
      ...activities.map((raw) => {
        const data = normalizeActivity(raw, now);
        return {
          kind: "activity",
          date: daySchema.parse(data.start.slice(0, 10)),
          sourceId: data.sourceId,
          data,
        };
      }),
    ];
    // Every write is gated by the lease so disconnecting cannot resurrect history.
    for (let start = 0; start < items.length; start += 40) {
      await env.DB.batch(
        items
          .slice(start, start + 40)
          .map((item) =>
            env.DB.prepare(
              "INSERT INTO records(id,user_id,kind,date,data,created_at,updated_at,source_id,source_account) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM integrations WHERE user_id=? AND lease_id=?) ON CONFLICT(user_id,kind,source_id) DO UPDATE SET date=excluded.date,data=excluded.data,updated_at=excluded.updated_at,source_account=excluded.source_account",
            ).bind(
              crypto.randomUUID(),
              userId,
              item.kind,
              item.date,
              JSON.stringify(item.data),
              now,
              now,
              item.sourceId,
              state.athlete_id,
              userId,
              leaseId,
            ),
          ),
      );
    }
    await env.DB.prepare(
      `UPDATE integrations SET cursor=?,imported_through=CASE WHEN imported_through IS NULL OR imported_through<? THEN ? ELSE imported_through END,last_success=?,failures=0,next_retry=NULL,status='connected',error=NULL,earliest_wellness=(SELECT MIN(date) FROM records WHERE user_id=? AND kind='wellness'),latest_wellness=(SELECT MAX(date) FROM records WHERE user_id=? AND kind='wellness'),earliest_activity=(SELECT MIN(date) FROM records WHERE user_id=? AND kind='activity'),latest_activity=(SELECT MAX(date) FROM records WHERE user_id=? AND kind='activity') WHERE user_id=? AND lease_id=?`,
    )
      .bind(
        addDays(newest, 1),
        newest,
        newest,
        now,
        userId,
        userId,
        userId,
        userId,
        userId,
        leaseId,
      )
      .run();
    return { oldest, newest, records: items.length, hasMore: newest < today };
  } catch (error) {
    const delay = Math.max(
      Math.min(3600000, 60000 * 2 ** Math.min(state.failures, 6)),
      error instanceof HttpError ? (error.retryAfterSeconds || 0) * 1000 : 0,
    );
    await env.DB.prepare(
      "UPDATE integrations SET failures=failures+1,next_retry=?,status='error',error=? WHERE user_id=? AND lease_id=?",
    )
      .bind(
        new Date(Date.now() + delay).toISOString(),
        "Fetch failed; cached history retained.",
        userId,
        leaseId,
      )
      .run();
    throw error instanceof HttpError
      ? error
      : new HttpError(502, "Sync failed; cached history retained");
  } finally {
    await env.DB.prepare(
      "UPDATE integrations SET lease_until=NULL,lease_id=NULL WHERE user_id=? AND lease_id=?",
    )
      .bind(userId, leaseId)
      .run();
  }
}
