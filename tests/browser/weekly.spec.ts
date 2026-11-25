import { test, expect } from "@playwright/test";
test("weekly overview combines nutrition, weight and workouts and handles empty weeks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/progress");
  const overview = page
    .locator("section.card")
    .filter({
      has: page.getByRole("heading", { name: "Weekly overview", exact: true }),
    });
  const table = overview.getByRole("table", { name: "Weekly daily overview" });
  await expect(table.locator("tbody tr")).toHaveCount(7);
  await expect(
    overview.getByText("Calories per logged day", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("Protein per logged day", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("Weight change within week", { exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("Completed workouts", { exact: true }),
  ).toBeVisible();
  const original = await overview
    .getByLabel("Overview week ending")
    .inputValue();
  await overview
    .getByRole("button", { name: "Earlier week", exact: true })
    .click();
  await expect(overview.getByLabel("Overview week ending")).not.toHaveValue(
    original,
  );
  await overview
    .getByRole("button", { name: "Current week", exact: true })
    .click();
  await expect(overview.getByLabel("Overview week ending")).toHaveValue(
    original,
  );
  await overview.getByLabel("Overview week ending").fill("2000-01-07");
  await expect(table.getByText("Not recorded", { exact: true })).toHaveCount(
    21,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
