import { test, expect } from "@playwright/test";
import { defaults, dayInZone } from "../../src/lib/domain";
test("successful wearable sync refreshes Home without another sync or page reload", async ({
  page,
}) => {
  let synced = false,
    calls = 0;
  const today = dayInZone();
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let json: unknown;
    if (url.pathname === "/api/auth/get-session")
      json = { user: { id: "synthetic" } };
    else if (url.pathname === "/api/settings")
      json = {
        ...defaults,
        displayName: "Test",
        onboarded: true,
        timezone: "UTC",
      };
    else if (url.pathname === "/api/sync") {
      synced = true;
      calls++;
      json = { records: 1 };
    } else if (url.pathname === "/api/records")
      json = {
        items:
          synced && url.searchParams.get("kind") === "wellness"
            ? [
                {
                  id: "synthetic-wellness",
                  kind: "wellness",
                  date: today,
                  data: {
                    sleepSeconds: 27000,
                    steps: 5000,
                    restingHR: 60,
                    hrv: [],
                  },
                  createdAt: today,
                  updatedAt: today,
                },
              ]
            : [],
        cursor: null,
      };
    else throw new Error("Unexpected request " + url.pathname);
    await route.fulfill({ json });
  });
  await page.goto("/");
  const sleep = page
    .locator(".stat")
    .filter({ has: page.getByText("Sleep", { exact: true }) });
  await expect(sleep.locator(".stat-value")).toContainText("7.5");
  await expect(page.getByText("5,000", { exact: true })).toBeVisible();
  expect(calls).toBe(1);
});
