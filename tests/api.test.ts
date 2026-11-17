import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
import { handlePrivate, handleRequest } from "../server/app";
import { createAuth } from "../server/auth";
import { analyze } from "../server/ai";
import { connect, sync, status } from "../server/intervals";
import { quota } from "../server/db";
import { HttpError, type Env } from "../server/types";
import { readWorkbook, suggestMapping, mapWorkbook } from "../src/lib/importer";
let mf: Miniflare, env: Env;
const alice = { id: "alice", name: "Alice", email: "alice@example.test" },
  bob = { id: "bob", name: "Bob", email: "bob@example.test" };
const request = (
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
) =>
  new Request(`http://localhost:8788${path}`, {
    method,
    headers: {
      Origin: "http://localhost:8788",
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const meal = {
  title: "Synthetic oats",
  category: "Breakfast",
  time: "08:00",
  foods: [
    {
      name: "Oats",
      quantity: 1,
      unit: "bowl",
      calories: 300,
      protein: 10,
      carbs: 50,
      fat: 5,
      fiber: 7,
    },
  ],
  notes: "",
  source: "manual",
  assumptions: "",
};
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      compatibilityDate: "2026-11-01",
      d1Databases: ["DB"],
    }),
  );
  const DB = (await mf.getD1Database("DB")) as unknown as D1Database;
  env = {
    DB,
    APP_URL: "http://localhost:8788",
    BETTER_AUTH_SECRET: "test-only-secret-not-used-in-any-deployment-123456789",
    RESEND_API_KEY: "synthetic-test-only",
    EMAIL_FROM: "Test <onboarding@resend.dev>",
    INTEGRATION_ENCRYPTION_KEY: btoa(
      String.fromCharCode(...new Uint8Array(32).fill(3)),
    ),
  };
  for (const filename of [
    "0001_initial.sql",
    "0002_activity_link.sql",
    "0003_import_provenance.sql",
  ]) {
    const sql = await readFile(`migrations/${filename}`, "utf8");
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await DB.prepare(statement).run();
  }
});
afterAll(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  await env.DB.batch(
    [
      "DELETE FROM user",
      "DELETE FROM verification",
      "DELETE FROM rateLimit",
      "DELETE FROM usage",
      "DELETE FROM records",
      "DELETE FROM ai_requests",
    ].map((sql) => env.DB.prepare(sql)),
  );
  for (const user of [alice, bob])
    await env.DB.prepare(
      "INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)",
    )
      .bind(user.id, user.name, user.email, Date.now(), Date.now())
      .run();
});
afterEach(() => vi.unstubAllGlobals());
it("saves and edits larger workbook plans while retaining request limits", async () => {
  const plan = {
    title: "Synthetic multiweek plan",
    notes: "",
    warnings: [],
    days: [{ week: "1", day: "A", notes: "", exercises: [] }],
    sourceNotes: Array.from(
      { length: 200 },
      (_, i) => `${i}: ${"Synthetic source note. ".repeat(50)}`,
    ),
  };
  const created = await handlePrivate(
    request("/api/records", "POST", {
      kind: "plan",
      date: "2026-11-01",
      data: plan,
      requestId: crypto.randomUUID(),
    }),
    env,
    alice,
  );
  expect(created.status).toBe(201);
  const entry = (await created.json()) as {
    id: string;
    updatedAt: string;
    data: unknown;
  };
  expect(entry.data).toEqual(plan);
  const updated = await handlePrivate(
    request(`/api/records/${entry.id}`, "PUT", {
      date: "2026-11-01",
      data: plan,
      updatedAt: entry.updatedAt,
    }),
    env,
    alice,
  );
  expect(updated.status).toBe(200);
  expect(((await updated.json()) as { data: unknown }).data).toEqual(plan);
  await expect(
    handlePrivate(
      request("/api/records", "POST", {
        kind: "meal",
        date: "2026-11-01",
        data: { ...meal, notes: "x".repeat(150001) },
        requestId: crypto.randomUUID(),
      }),
      env,
      alice,
    ),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    handlePrivate(
      request("/api/records", "POST", {
        kind: "plan",
        date: "2026-11-01",
        data: { ...plan, notes: "x".repeat(1000001) },
        requestId: crypto.randomUUID(),
      }),
      env,
      alice,
    ),
  ).rejects.toMatchObject({ status: 413 });
});
it.skipIf(!process.env.LOCAL_IMPORT_WORKBOOK)(
  "imports an optional private local workbook through persistence",
  async () => {
    const bytes = await readFile(process.env.LOCAL_IMPORT_WORKBOOK!);
    const book = await readWorkbook(new File([bytes], "local-workbook.xlsx"));
    const plan = mapWorkbook(
      book,
      book.sheets.map(suggestMapping),
      "Local import test",
    );
    const created = await handlePrivate(
      request("/api/records", "POST", {
        kind: "plan",
        date: "2026-11-01",
        data: plan,
        requestId: crypto.randomUUID(),
      }),
      env,
      alice,
    );
    expect(created.status).toBe(201);
    const entry = (await created.json()) as {
      id: string;
      updatedAt: string;
      data: unknown;
    };
    expect(entry.data).toEqual(plan);
    const updated = await handlePrivate(
      request(`/api/records/${entry.id}`, "PUT", {
        date: "2026-11-01",
        data: plan,
        updatedAt: entry.updatedAt,
      }),
      env,
      alice,
    );
    expect(updated.status).toBe(200);
  },
);
it("health checks the actual schema and denies anonymous private access", async () => {
  expect(
    await (await handleRequest(request("/api/health"), env)).json(),
  ).toEqual({ status: "ok", database: true });
  expect((await handleRequest(request("/api/records"), env)).status).toBe(401);
});
it("rejects cross-origin mutations before authentication", async () => {
  const r = new Request("http://localhost:8788/api/records", {
    method: "POST",
    headers: { Origin: "https://evil.test" },
    body: "{}",
  });
  expect((await handleRequest(r, env)).status).toBe(403);
});
it("isolates reads, edits, deletes, exports and client-supplied identity", async () => {
  const created = await handlePrivate(
    request("/api/records", "POST", {
      kind: "meal",
      date: "2026-11-01",
      data: meal,
      requestId: crypto.randomUUID(),
      userId: "bob",
    }),
    env,
    alice,
  );
  const entry = (await created.json()) as { id: string; updatedAt: string };
  for (const method of ["GET", "PUT", "DELETE"])
    await expect(
      handlePrivate(
        request(
          `/api/records/${entry.id}`,
          method,
          method === "PUT"
            ? { date: "2026-11-01", data: meal, updatedAt: entry.updatedAt }
            : undefined,
        ),
        env,
        bob,
      ),
    ).rejects.toMatchObject({ status: 404 });
  const exported = (await (
    await handlePrivate(request("/api/export"), env, bob)
  ).json()) as { records: unknown[] };
  expect(exported.records).toHaveLength(0);
  const owner = await (
    await handlePrivate(request("/api/export"), env, alice)
  ).text();
  expect(owner).toContain("Synthetic oats");
  expect(owner).not.toContain("password");
});
it("deduplicates explicit saves and rejects stale edits", async () => {
  const body = {
    kind: "meal",
    date: "2026-11-01",
    data: meal,
    requestId: crypto.randomUUID(),
  };
  const results = await Promise.all([
    handlePrivate(request("/api/records", "POST", body), env, alice),
    handlePrivate(request("/api/records", "POST", body), env, alice),
  ]);
  const ids = await Promise.all(
    results.map(async (r) => ((await r.json()) as { id: string }).id),
  );
  expect(ids[0]).toBe(ids[1]);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM records").first("n"),
  ).toBe(1);
  await expect(
    handlePrivate(
      request(`/api/records/${ids[0]}`, "PUT", {
        date: "2026-11-01",
        data: meal,
        updatedAt: "outdated",
      }),
      env,
      alice,
    ),
  ).rejects.toMatchObject({ status: 409 });
});
it("AI preview creates no meal and validates estimates; unavailable AI leaves manual logging working", async () => {
  await expect(
    analyze(env, alice.id, {
      requestId: crypto.randomUUID(),
      kind: "meal",
      description: "Oats",
      consent: true,
    }),
  ).rejects.toMatchObject({ status: 503 });
  const aiEnv = {
    ...env,
    AI_ENABLED: "true",
    GROQ_API_KEY: "synthetic",
    GROQ_MODEL: "test",
  };
  const provider = {
    complete: vi.fn(async () => ({
      foods: meal.foods,
      assumptions: "Example only",
      uncertainty: "Estimate",
    })),
  };
  const id = crypto.randomUUID();
  await analyze(
    aiEnv,
    alice.id,
    { requestId: id, kind: "meal", description: "Oats", consent: true },
    provider,
  );
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM records").first("n"),
  ).toBe(0);
  await expect(
    analyze(
      aiEnv,
      alice.id,
      { requestId: id, kind: "meal", description: "Oats", consent: true },
      provider,
    ),
  ).rejects.toBeInstanceOf(HttpError);
  expect(provider.complete).toHaveBeenCalledTimes(1);
});
it("enforces atomic quota limits under concurrent requests", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      quota(env.DB, "test-quota", 3, "2099-01-01"),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
});
it("upserts wearable history, retains source dates and preserves cache on failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.endsWith("/i123")) return Response.json({ id: "i123" });
      if (input.includes("/wellness"))
        return Response.json([{ id: "2026-01-01", steps: 0, hrv: 50 }]);
      return Response.json([
        {
          id: "a1",
          start_date_local: "2026-01-01T08:00:00",
          name: "Walk",
          calories: 120,
        },
      ]);
    }),
  );
  await connect(env, alice.id, {
    athleteId: "i123",
    apiKey: "synthetic-api-key",
    startDate: "2026-01-01",
  });
  await sync(env, alice.id, "UTC", true);
  await env.DB.prepare("UPDATE integrations SET cursor=? WHERE user_id=?")
    .bind("2026-01-01", alice.id)
    .run();
  await sync(env, alice.id, "UTC", true);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE user_id=?")
      .bind(alice.id)
      .first("n"),
  ).toBe(2);
  const s = (await status(env, alice.id)) as { latest_wellness: string };
  expect(s.latest_wellness).toBe("2026-01-01");
  expect(JSON.stringify(s)).not.toContain("synthetic-api-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("fail", { status: 500 })),
  );
  await expect(sync(env, alice.id, "UTC", true)).rejects.toThrow();
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM records").first("n"),
  ).toBe(2);
});
it("prevents concurrent duplicate sync and removes credentials on disconnect", async () => {
  await env.DB.prepare(
    "INSERT INTO integrations(user_id,athlete_id,credential,start_date,cursor,lease_until) VALUES(?,?,?,?,?,?)",
  )
    .bind(alice.id, "i1", "encrypted", "2020-01-01", "2020-01-01", "2099-01-01")
    .run();
  expect(await sync(env, alice.id, "UTC", true)).toEqual({ busy: true });
  await handlePrivate(
    request("/api/integration", "DELETE", { deleteHistory: true }),
    env,
    alice,
  );
  expect(await status(env, alice.id)).toBeNull();
});
it("runs signup, single-use verification, login, reset, logout and account deletion", async () => {
  let code = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input !== "https://api.resend.com/emails")
        throw new Error("Unexpected provider");
      const body = JSON.parse(String(init?.body)) as { text: string };
      code = body.text.match(/code is (\d+)/)![1];
      return Response.json({ id: "synthetic-email" });
    }),
  );
  const email = "auth-flow@example.test",
    password = "Long test password 123!";
  expect(
    (
      await handleRequest(
        request("/api/auth/sign-up/email", "POST", {
          name: "Test",
          email,
          password,
        }),
        env,
      )
    ).status,
  ).toBe(200);
  expect(code).toHaveLength(8);
  expect(
    (
      await handleRequest(
        request("/api/auth/sign-in/email", "POST", { email, password }),
        env,
      )
    ).status,
  ).toBe(403);
  const first = await handleRequest(
    request("/api/auth/email-otp/verify-email", "POST", { email, otp: code }),
    env,
  );
  expect(first.status).toBe(200);
  expect(
    (
      await handleRequest(
        request("/api/auth/email-otp/verify-email", "POST", {
          email,
          otp: code,
        }),
        env,
      )
    ).status,
  ).toBeGreaterThanOrEqual(400);
  const login = await handleRequest(
    request("/api/auth/sign-in/email", "POST", { email, password }),
    env,
  );
  expect(login.status).toBe(200);
  const cookie = login.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  expect(cookie).toContain("session_token");
  expect(
    (
      await handleRequest(
        request("/api/settings", "GET", undefined, cookie),
        env,
      )
    ).status,
  ).toBe(200);
  await handleRequest(
    request("/api/auth/email-otp/request-password-reset", "POST", { email }),
    env,
  );
  const resetCode = code;
  const nextPassword = "New long test password 456!";
  expect(
    (
      await handleRequest(
        request("/api/auth/email-otp/reset-password", "POST", {
          email,
          otp: resetCode,
          password: nextPassword,
        }),
        env,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handleRequest(
        request("/api/auth/email-otp/reset-password", "POST", {
          email,
          otp: resetCode,
          password: nextPassword,
        }),
        env,
      )
    ).status,
  ).toBeGreaterThanOrEqual(400);
  expect(
    (
      await handleRequest(
        request("/api/settings", "GET", undefined, cookie),
        env,
      )
    ).status,
  ).toBe(401);
  const login2 = await handleRequest(
    request("/api/auth/sign-in/email", "POST", {
      email,
      password: nextPassword,
    }),
    env,
  );
  const cookie2 = login2.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  expect(
    (
      await handleRequest(
        request("/api/auth/sign-out", "POST", {}, cookie2),
        env,
      )
    ).status,
  ).toBe(200);
  expect(
    await createAuth(env).api.getSession({
      headers: new Headers({ cookie: cookie2 }),
    }),
  ).toBeNull();
  const login3 = await handleRequest(
    request("/api/auth/sign-in/email", "POST", {
      email,
      password: nextPassword,
    }),
    env,
  );
  const cookie3 = login3.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  const user = await env.DB.prepare("SELECT id FROM user WHERE email=?")
    .bind(email)
    .first<{ id: string }>();
  await handlePrivate(
    request("/api/records", "POST", {
      kind: "meal",
      date: "2026-11-01",
      data: meal,
      requestId: crypto.randomUUID(),
    }),
    env,
    { ...alice, id: user!.id, email },
  );
  expect(
    (
      await handleRequest(
        request(
          "/api/account",
          "DELETE",
          { confirmation: "DELETE MY ACCOUNT", password: nextPassword },
          cookie3,
        ),
        env,
      )
    ).status,
  ).toBe(200);
  expect(
    await env.DB.prepare("SELECT id FROM user WHERE email=?")
      .bind(email)
      .first(),
  ).toBeNull();
  expect(
    await env.DB.prepare("SELECT id FROM records WHERE user_id=?")
      .bind(user!.id)
      .first(),
  ).toBeNull();
  expect(
    (
      await handleRequest(
        request("/api/settings", "GET", undefined, cookie3),
        env,
      )
    ).status,
  ).toBe(401);
});
