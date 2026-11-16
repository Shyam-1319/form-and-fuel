import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = JSON.parse(readFileSync("wrangler.json", "utf8"));
function wrangler(args, json = false) {
  const r = spawnSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", ...args],
    {
      encoding: "utf8",
      stdio: json ? "pipe" : "inherit",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  if (r.status !== 0) throw new Error(`Wrangler ${args[0]} failed`);
  return json ? JSON.parse(r.stdout) : null;
}
wrangler(["whoami"]);
const databases = wrangler(["d1", "list", "--json"], true);
const name = config.d1_databases[0].database_name;
let db = databases.find((d) => d.name === name);
if (!db) {
  wrangler(["d1", "create", name]);
  db = wrangler(["d1", "list", "--json"], true).find((d) => d.name === name);
}
if (!db) throw new Error("Database creation could not be verified");
config.d1_databases[0].database_id = db.uuid;
writeFileSync("wrangler.json", JSON.stringify(config, null, 2) + "\n");
const projects = wrangler(["pages", "project", "list", "--json"], true);
if (!projects.some((p) => (p.name || p["Project Name"]) === config.name))
  wrangler([
    "pages",
    "project",
    "create",
    config.name,
    "--production-branch",
    "main",
  ]);
config.vars.APP_URL = `https://${config.name}.pages.dev`;
writeFileSync("wrangler.json", JSON.stringify(config, null, 2) + "\n");
console.log(
  `Pages project and DB binding prepared. Apply migrations with npm run db:remote. URL: ${config.vars.APP_URL}`,
);
