import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("home metric arrows open daily histories and earlier weeks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  for (const [button, label, unit] of [
    ["protein", "Protein", "g"],
    ["water", "Water", "L"],
    ["sleep", "Sleep", "hrs"],
    ["calories consumed", "Calories", "kcal"],
  ]) {
    await page
      .getByRole("button", { name: `View ${button} history`, exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: `${label} history`,
      exact: true,
    });
    const table = dialog.getByRole("table", {
      name: `${label} daily history`,
      exact: true,
    });
    await expect(table.locator("tbody tr")).toHaveCount(7);
    await expect(table).toContainText(unit);
    const original = await dialog.getByLabel("Week ending").inputValue();
    await dialog
      .getByRole("button", { name: "Previous week", exact: true })
      .click();
    await expect(dialog.getByLabel("Week ending")).not.toHaveValue(original);
    await dialog
      .getByRole("button", { name: "This week", exact: true })
      .click();
    await expect(dialog.getByLabel("Week ending")).toHaveValue(original);
    if (label === "Protein") {
      mkdirSync("artifacts/private", { recursive: true });
      await page.screenshot({
        path: "artifacts/private/protein-history-mobile.png",
      });
    }
    await dialog.getByLabel("Week ending").fill("2000-01-07");
    await expect(table.getByText("Not recorded", { exact: true })).toHaveCount(
      7,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Close dialog" }).click();
    await expect(dialog).toHaveCount(0);
  }
});
