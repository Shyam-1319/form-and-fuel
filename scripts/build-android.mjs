import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const sdk = process.env.ANDROID_SDK_ROOT || "C:/projects/.tooling/android/sdk";
const java = process.env.JAVA_HOME;
if (!java)
  throw new Error("Set JAVA_HOME to the Java 17 installation before building.");
const signingPath = join(root, "artifacts/private/android/signing.json");
if (!existsSync(signingPath))
  throw new Error(
    "The private Android signing configuration is required. Restore it from your private backup; do not generate a different key for updates.",
  );
const signing = JSON.parse(readFileSync(signingPath, "utf8"));
const env = {
  ...process.env,
  JAVA_HOME: java,
  ANDROID_SDK_ROOT: sdk,
  FORM_FUEL_STORE_PASSWORD: signing.password,
};
function run(file, args, cwd = root) {
  const result = spawnSync(file, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0)
    throw new Error("Android build/signing command failed");
}
run(
  process.env.ComSpec || "cmd.exe",
  ["/d", "/s", "/c", "gradlew.bat --no-daemon --console=plain assembleRelease"],
  join(root, "android"),
);
const tools = join(sdk, "build-tools/36.0.0");
const unsigned = join(
  root,
  "android/app/build/outputs/apk/release/app-release-unsigned.apk",
);
const aligned = join(root, "artifacts/private/android/aligned.apk");
const releases = join(root, "artifacts/releases");
mkdirSync(releases, { recursive: true });
const manifest = JSON.parse(
  readFileSync(join(root, "android/twa-manifest.json"), "utf8"),
);
if (!/^[0-9]+(?:\.[0-9]+)*$/.test(manifest.appVersionName))
  throw new Error("Use a numeric dotted Android version name");
const output = join(releases, `Form-and-Fuel-${manifest.appVersionName}.apk`);
run(join(tools, "zipalign.exe"), ["-f", "-P", "16", "4", unsigned, aligned]);
const signer = join(tools, "lib/apksigner.jar");
run(join(java, "bin/java.exe"), [
  "-jar",
  signer,
  "sign",
  "--ks",
  signing.keystore,
  "--ks-key-alias",
  signing.alias,
  "--ks-pass",
  "env:FORM_FUEL_STORE_PASSWORD",
  "--key-pass",
  "env:FORM_FUEL_STORE_PASSWORD",
  "--out",
  output,
  aligned,
]);
run(join(java, "bin/java.exe"), [
  "-jar",
  signer,
  "verify",
  "--verbose",
  "--print-certs",
  output,
]);
console.log("Signed and verified APK: " + output);
