import { test, expect } from "@playwright/test";
test("Google sign-in uses each user's Google account and keeps password login available", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({ json: null }),
  );
  await page.route("**/api/auth-options", (route) =>
    route.fulfill({ json: { google: true, emailSignup: false } }),
  );
  await page.route("**/api/auth/sign-in/social", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ provider: "google" });
    await route.fulfill({
      json: {
        url: "https://accounts.google.com/o/oauth2/v2/auth?state=synthetic",
      },
    });
  });
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Synthetic Google account chooser</h1>",
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//);
});
test("unconfigured Google sign-in is hidden and public email signup is explained", async ({
  page,
}) => {
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({ json: null }),
  );
  await page.route("**/api/auth-options", (route) =>
    route.fulfill({ json: { google: false, emailSignup: false } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Email registration is currently restricted/),
  ).toBeVisible();
});
