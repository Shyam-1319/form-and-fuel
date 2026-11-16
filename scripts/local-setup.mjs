import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".dev.vars")) {
  writeFileSync(
    ".dev.vars",
    `# Local development only. Never commit.\nAPP_URL=http://localhost:8788\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64")}\nINTEGRATION_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\nAI_ENABLED=false\n`,
    { mode: 0o600 },
  );
  console.log(
    "Created ignored local development configuration. Secret values were not printed.",
  );
} else console.log("Existing local configuration preserved.");
