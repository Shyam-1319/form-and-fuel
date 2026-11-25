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
        canvas.width = 64;
        canvas.height = 32;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#326050";
        context.fillRect(0, 0, 64, 32);
        context.fillStyle = "#eeaa22";
        context.fillRect(32, 0, 32, 32);
        return canvas.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    ),
  });
  const crop = page.getByLabel("Circular crop preview");
  await expect(crop).toBeVisible();
  const initialCrop = await crop.evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL(),
  );
  await page.getByLabel("Zoom", { exact: true }).focus();
  await page.keyboard.press("End");
  await page.getByLabel("Horizontal position", { exact: true }).focus();
  await page.keyboard.press("End");
  await expect
    .poll(() =>
      crop.evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
    )
    .not.toBe(initialCrop);
  await page.getByRole("button", { name: "Reset crop", exact: true }).click();
  await expect
    .poll(() =>
      crop.evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
    )
    .toBe(initialCrop);
  await page
    .getByRole("button", { name: "Use this crop", exact: true })
    .click();
  await expect(crop).toHaveCount(0);
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
