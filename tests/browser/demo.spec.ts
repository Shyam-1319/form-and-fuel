import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("demo is isolated, responsive, and uses accessible measurement controls", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) calls.push(r.url());
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/demo");
  await expect(
    page.getByText("Demo — fictional sample data.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A little better, Alex." }),
  ).toBeVisible();
  mkdirSync("docs/screenshots", { recursive: true });
  await page.screenshot({
    path: "docs/screenshots/demo-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Waist: measurement available", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Add measurement", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Circumference (cm)", { exact: true }).fill("80.2");
  await page
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".measurement-value")).toHaveText("80.2cm");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/demo-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Workouts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workouts", exact: true }),
  ).toBeVisible();
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});
test("AI preview cancels without saving; manual corrections save explicitly", async ({
  page,
}) => {
  await page.goto("/demo/add-meal");
  await page.getByLabel("Describe your meal").fill("Synthetic test meal");
  await page
    .getByRole("checkbox", { name: "Use simulated AI in this fictional demo" })
    .check();
  await page.getByRole("button", { name: "Estimate nutrition" }).click();
  await expect(
    page.getByText("Simulated AI estimate", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Synthetic test meal", exact: true }),
  ).toHaveCount(0);
  await page.goto("/demo/add-meal");
  await page.getByLabel("Meal name", { exact: true }).fill("Browser test oats");
  await page.getByLabel("Food name", { exact: true }).fill("Oats");
  await page.getByLabel("Calories (kcal)", { exact: true }).fill("333");
  await page.getByLabel("Protein (g)", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Confirm & save meal" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test oats", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText("333 kcal", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser test oats", exact: true }),
  ).toHaveCount(0);
});
test("XLSX import has mapping, retained notes, editable preview, and explicit save", async ({
  page,
}) => {
  await page.goto("/demo/workouts");
  await page.getByRole("button", { name: "Import plan" }).click();
  await page
    .getByLabel("Workout file", { exact: true })
    .setInputFiles("public/samples/strength-plan.xlsx");
  await expect(
    page.getByRole("heading", { name: "Week 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open editable import preview" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Workout plan editor" }),
  ).toBeVisible();
  await page
    .getByLabel("Plan title", { exact: true })
    .fill("Reviewed synthetic import");
  await page.getByText(/Review all retained source content/).click();
  await expect(page.getByText(/Outside-table note:/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm & save plan" }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Plan", exact: true })
      .locator("option:checked"),
  ).toHaveText("Reviewed synthetic import");
});
test("compact workout logger shows previous sets and saves entered weight and reps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/workouts");
  await page.getByText("Manage plan", { exact: true }).click();
  await page
    .getByLabel("Add demonstration links from workbook", { exact: false })
    .setInputFiles({
      name: "videos.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Exercise,Video\nGoblet squat,https://example.test/demo",
      ),
    });
  await expect(
    page.getByRole("link", {
      name: "Watch Goblet squat demonstration",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://example.test/demo");
  await page.getByText("Manage plan", { exact: true }).click();
  const card = page.getByRole("region", { name: "Goblet squat", exact: true });
  await expect(card.getByRole("columnheader")).toHaveText([
    "Set",
    "Previous",
    "Weight (kg)",
    "Reps",
  ]);
  await expect(card.getByText("20 kg × 10", { exact: true })).toHaveCount(3);
  await card
    .getByLabel("Goblet squat set 1 weight (kg)", { exact: true })
    .fill("25");
  await card.getByLabel("Goblet squat set 1 reps", { exact: true }).fill("12");
  await page
    .getByRole("button", { name: "Save completed session", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Workout saved.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Log another workout", exact: true })
    .click();
  await expect(card.getByText("25 kg × 12", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await card.screenshot({ path: "artifacts/private/compact-workout-card.png" });
  await page.screenshot({
    path: "artifacts/private/compact-workout-mobile.png",
    fullPage: true,
  });
});
test("all direct routes load and dark mode works", async ({ page }) => {
  for (const [path, title] of [
    ["history", "Every meal has a place."],
    ["health", "A fuller picture of recovery."],
    ["progress", "Your story, over time."],
    ["settings", "Your space, your settings."],
  ]) {
    await page.goto(`/demo/${path}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/demo");
  await page.getByLabel("Account options", { exact: true }).first().click();
  await page
    .getByRole("navigation", { name: "Account options" })
    .getByRole("link", { name: "Profile", exact: true })
    .click();
  await expect(page).toHaveURL(/\/demo\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await page.goto("/demo");
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.screenshot({
    path: "docs/screenshots/demo-dark.png",
    fullPage: true,
  });
});
