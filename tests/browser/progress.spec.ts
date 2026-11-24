import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("exercise progress selects exact movement histories on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/workouts");
  await page
    .getByRole("button", { name: "Exercise progress", exact: true })
    .click();
  const selector = page.getByRole("combobox", { name: "Exercise to track" });
  const goblet = await selector
    .locator("option")
    .filter({ hasText: "Goblet squat" })
    .getAttribute("value");
  await selector.selectOption(goblet!);
  await expect(
    page.locator(".exercise-progress-stats").getByText("20 kg × 10 reps", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table", { name: "Exercise progress history" })
      .locator("tbody tr"),
  ).toHaveCount(4);
  await expect(page.getByText("30 total reps", { exact: true })).toBeVisible();
  const pushup = await selector
    .locator("option")
    .filter({ hasText: "Push-up" })
    .getAttribute("value");
  await selector.selectOption(pushup!);
  await expect(page.getByText("10 reps", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Not enough weight data", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  mkdirSync("artifacts/private", { recursive: true });
  await page.screenshot({
    path: "artifacts/private/exercise-progress-mobile.png",
    fullPage: true,
  });
});
