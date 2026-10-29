import { expect, test } from "@playwright/test";

test("the app starts and shows its name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Пупульта Town");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Пупульта Town");
});
