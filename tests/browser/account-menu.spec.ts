import { test, expect } from "@playwright/test";
test("account dropdown separates profile, targets and remaining settings", async ({
  page,
}) => {
  await page.goto("/demo");
  const account = page.getByLabel("Account options", { exact: true }).first();
  await account.click();
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daily targets", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic profile");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");
  await account.click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("navigation", { name: "Account options" }),
  ).toBeHidden();
  await account.click();
  await page.getByRole("link", { name: "Targets", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Daily targets", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save targets", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Settings saved");
  await account.click();
  await page
    .getByRole("navigation", { name: "Account options" })
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your data belongs to you." }),
  ).toBeVisible();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await account.click();
  await expect(
    page.getByRole("navigation", { name: "Account options" }),
  ).toBeVisible();
  await page.mouse.click(10, 400);
  await expect(
    page.getByRole("navigation", { name: "Account options" }),
  ).toBeHidden();
});
