import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("wrangler.json", "utf8"));
const base = process.env.APP_URL || config.vars.APP_URL;
for (const path of ["/", "/demo", "/demo/workouts", "/api/health"]) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  if (path === "/api/health") {
    const result = await response.json();
    if (result.status !== "ok" || result.database !== true)
      throw new Error("Database health check failed");
    if (config.vars.AI_ENABLED === "true" && result.ai !== true)
      throw new Error("Production AI configuration check failed");
  } else if (!(await response.text()).includes('id="root"'))
    throw new Error(`${path}: app shell missing`);
  console.log(`${path}: passed`);
}
const privateResponse = await fetch(base + "/api/records");
if (privateResponse.status !== 401)
  throw new Error(`Private records must reject anonymous access with HTTP 401, got ${privateResponse.status}`);
console.log(`Private records without session: HTTP ${privateResponse.status}`);
const sessionResponse = await fetch(base + "/api/auth/get-session");
if (sessionResponse.status !== 200 || (await sessionResponse.json()) !== null)
  throw new Error("Anonymous session check failed");
console.log("Authentication configured; anonymous session is null: passed");
