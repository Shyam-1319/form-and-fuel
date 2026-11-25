import { test, expect } from "@playwright/test";
test("photo preview requires consent and cancellation leaves diary unchanged", async ({
  page,
}) => {
  await page.goto("/demo/add-meal");
  const image = await page.screenshot({ type: "jpeg" });
  await page
    .getByLabel("Meal photo (optional)", { exact: true })
    .setInputFiles({
      name: "synthetic.jpg",
      mimeType: "image/jpeg",
      buffer: image,
    });
  await expect(
    page.getByAltText("Meal photo selected for analysis"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Estimate nutrition", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Use simulated AI in this fictional demo" })
    .check();
  await page
    .getByRole("button", { name: "Estimate nutrition", exact: true })
    .click();
  await expect(
    page.getByText("Simulated AI estimate", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(
    page.getByAltText("Meal photo selected for analysis"),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Estimated meal", exact: true }),
  ).toHaveCount(0);
});
