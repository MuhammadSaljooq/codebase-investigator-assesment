import { test, expect } from "@playwright/test";

test("loads investigator shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Local Codebase Investigator")).toBeVisible();
  await expect(page.getByPlaceholder("https://github.com/owner/repo")).toBeVisible();
});
