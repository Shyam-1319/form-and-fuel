import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:8788",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "chrome",
    trace: "off",
  },
  reporter: "list",
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command:
          "node node_modules/wrangler/bin/wrangler.js pages dev dist --port 8788",
        url: "http://localhost:8788/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
