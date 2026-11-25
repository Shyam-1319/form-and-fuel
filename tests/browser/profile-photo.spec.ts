import { test, expect } from "@playwright/test";
test("profile photo is previewed, saved to avatar, and removed", async ({
  page,
}) => {
  await page.goto("/demo/profile");
  const file = page.getByLabel(/^Profile photo \(optional\)/);
  await file.setInputFiles({
    name: "synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#326050";
        context.fillRect(0, 0, 32, 32);
        return canvas.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    ),
  });
  await expect(page.getByAltText("Profile photo preview")).toBeVisible();
  await expect(page.getByAltText("Your profile", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByAltText("Your profile", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove profile photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByAltText("Your profile", { exact: true })).toHaveCount(
    0,
  );
});
