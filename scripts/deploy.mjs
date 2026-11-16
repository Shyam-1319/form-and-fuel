import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const config = JSON.parse(readFileSync("wrangler.json", "utf8"));
if (config.d1_databases[0].database_id.startsWith("00000000"))
  throw new Error("Run npm run setup:cloudflare first");
function run(file, args) {
  const r = spawnSync(process.execPath, [file, ...args], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status || 1);
}
run("node_modules/typescript/bin/tsc", ["--noEmit"]);
run("node_modules/vite/bin/vite.js", ["build"]);
run("node_modules/wrangler/bin/wrangler.js", [
  "d1",
  "migrations",
  "apply",
  "DB",
  "--remote",
]);
run("node_modules/wrangler/bin/wrangler.js", [
  "pages",
  "deploy",
  "dist",
  "--project-name",
  config.name,
  "--branch",
  "main",
]);
run("scripts/verify-live.mjs", []);
