import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream"] },
  permissions: ["camera"],
});

test("camera captures locally, stops tracks and requires consent before an estimate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as unknown as { testTracks: MediaStreamTrack[] }).testTracks =
        stream.getTracks();
      return stream;
    };
  });
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiCalls.push(request.url());
  });
  await page.goto("/demo/add-meal");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  const capture = page.getByRole("button", {
    name: "Capture food photo",
    exact: true,
  });
  await expect(capture).toBeEnabled();
  mkdirSync("artifacts/private", { recursive: true });
  await page
    .getByRole("region", { name: "Food camera" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/private/food-camera-mobile.png" });
  await capture.click();
  await expect(page.getByRole("region", { name: "Food camera" })).toHaveCount(
    0,
  );
  const image = page.getByAltText("Meal photo selected for analysis");
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { testTracks: MediaStreamTrack[] }
        ).testTracks.every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  expect(
    await image.evaluate((element: HTMLImageElement) =>
      Math.max(element.naturalWidth, element.naturalHeight),
    ),
  ).toBeLessThanOrEqual(512);
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
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(capture).toBeEnabled();
  await page.getByRole("button", { name: "Close camera", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { testTracks: MediaStreamTrack[] }
        ).testTracks.every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  expect(apiCalls).toEqual([]);
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(capture).toBeEnabled();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { testTracks: MediaStreamTrack[] }
        ).testTracks.every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("denied camera access offers upload fallback", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/demo/add-meal");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Camera access was blocked",
  );
  await page.getByRole("button", { name: "Close camera", exact: true }).click();
  await expect(
    page.getByLabel("Meal photo (optional)", { exact: true }),
  ).toBeEnabled();
});

test("permission resolved after closing camera stops the late stream", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as unknown as { testTracks: MediaStreamTrack[] }).testTracks =
        stream.getTracks();
      await new Promise<void>((resolve) => {
        (window as unknown as { releaseCamera: () => void }).releaseCamera =
          resolve;
      });
      return stream;
    };
  });
  await page.goto("/demo/add-meal");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as unknown as { releaseCamera?: () => void })
            .releaseCamera,
      ),
    )
    .toBe("function");
  await page.getByRole("button", { name: "Close camera", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { releaseCamera: () => void }).releaseCamera(),
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { testTracks: MediaStreamTrack[] }
        ).testTracks.every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
});
