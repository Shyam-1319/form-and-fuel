import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("copy day previews, cancels and saves selected scaled meals alongside existing meals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/history");
  await page.getByRole("button", { name: "Copy a day", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Copy a day’s meals" });
  const source = await dialog.getByLabel("Copy meals from").inputValue();
  await dialog.getByLabel("Copy meals to").fill("2025-01-01");
  await dialog
    .getByRole("button", { name: "Preview meals", exact: true })
    .click();
  await expect(dialog.getByRole("checkbox")).not.toHaveCount(0);
  const count = await dialog.getByRole("checkbox").count();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("2025-01-01", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Copy a day", exact: true }).click();
  await dialog.getByLabel("Copy meals from").fill(source);
  await dialog.getByLabel("Copy meals to").fill("2025-01-01");
  await dialog
    .getByRole("button", { name: "Preview meals", exact: true })
    .click();
  for (let i = 1; i < count; i++)
    await dialog.getByRole("checkbox").nth(i).uncheck();
  await dialog.getByRole("spinbutton").first().fill("2");
  await expect(dialog.getByRole("status")).toContainText("1 meal(s) selected");
  mkdirSync("artifacts/private", { recursive: true });
  await page.screenshot({ path: "artifacts/private/copy-day-mobile.png" });
  await dialog
    .getByRole("button", { name: "Confirm & copy 1 meals", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Copied 1 meal(s) to 2025-01-01.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Copy a day", exact: true }).click();
  await dialog.getByLabel("Copy meals from").fill(source);
  await dialog.getByLabel("Copy meals to").fill("2025-01-01");
  await dialog
    .getByRole("button", { name: "Preview meals", exact: true })
    .click();
  await expect(dialog.getByText(/1 meal\(s\) already exist/)).toBeVisible();
  await dialog
    .getByRole("button", { name: `Confirm & copy ${count} meals`, exact: true })
    .click();
  await expect(page.locator(".history-row")).toHaveCount(count + 1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
