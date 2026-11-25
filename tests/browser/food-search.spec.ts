import { test, expect } from "@playwright/test";
test("food history searches ingredients and clears on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/history");
  const search = page.getByRole("searchbox", { name: "Search food history" });
  await search.fill("granola");
  await expect(page.locator(".history-row").first()).toContainText(/granola/i);
  await expect(
    page
      .locator(".history-row")
      .filter({ hasText: "Roasted vegetable grain bowl" }),
  ).toHaveCount(0);
  await search.fill("no matching meal xyz");
  await expect(page.locator(".history-row")).toHaveCount(0);
  await expect(page.getByText(/No matching meals found/)).toBeVisible();
  await search.fill("");
  await expect(page.locator(".history-row").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
