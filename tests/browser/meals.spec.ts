import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("favourites load an adjustable preview and recent meals repeat only after confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/add-meal");
  await page
    .getByLabel("Meal name", { exact: true })
    .fill("Favourite test oats");
  await page.getByLabel("Food name", { exact: true }).fill("Oats");
  await page.getByLabel("Calories (kcal)", { exact: true }).fill("300");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Snack");
  await page
    .getByRole("button", { name: "Save to favourites", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved to favourites", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Favourite test oats", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Add meal", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: /Favourite test oats.*Load preview/ })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Category", exact: true }),
  ).toHaveValue("Snack");
  await expect(page.getByLabel("Calories (kcal)", { exact: true })).toHaveValue(
    "300",
  );
  mkdirSync("artifacts/private", { recursive: true });
  await page.locator(".quick-meals").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/private/favourites-mobile.png" });
  await page.getByLabel("Multiply all portions and nutrients").fill("2");
  await page.getByRole("button", { name: "Apply ×2", exact: true }).click();
  await expect(page.getByLabel("Calories (kcal)", { exact: true })).toHaveValue(
    "600",
  );
  await page.getByRole("button", { name: "Confirm & save meal" }).click();
  await expect(
    page.getByRole("heading", { name: "Favourite test oats", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("link", { name: "Add meal", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Recent meals", exact: true }).click();
  await page.getByLabel("Find a saved meal").fill("Favourite test oats");
  await page
    .getByRole("button", { name: /Favourite test oats.*Load preview/ })
    .click();
  await expect(page.getByLabel("Calories (kcal)", { exact: true })).toHaveValue(
    "600",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Confirm & save meal" }).click();
  await expect(
    page.getByRole("heading", { name: "Favourite test oats", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Recipes & saved meals" }).click();
  const card = page.locator("section.card").filter({
    has: page.getByRole("heading", {
      name: "Favourite test oats",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Remove from favourites" }).click();
  await card.getByRole("link", { name: "Load in meal editor" }).click();
  await expect(page).toHaveURL(/\/add-meal\?recipe=/);
  await expect(page.getByRole("heading", { name: "What’s on your plate?" })).toBeVisible();
  await expect(page.getByLabel("Calories (kcal)", { exact: true })).toHaveValue(
    "300",
  );
  await expect(
    page
      .locator(".quick-meal-choice")
      .filter({ hasText: "Favourite test oats" }),
  ).toHaveCount(0);
});
