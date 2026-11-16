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
  } else if (!(await response.text()).includes('id="root"'))
    throw new Error(`${path}: app shell missing`);
  console.log(`${path}: passed`);
}
const privateResponse = await fetch(base + "/api/records");
if (![401, 503].includes(privateResponse.status))
  throw new Error("Unauthenticated private access unexpected");
console.log(`Private records without session: HTTP ${privateResponse.status}`);
