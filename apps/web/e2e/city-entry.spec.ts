import { expect, test } from "@playwright/test";
import { openSection, register } from "./helpers.ts";

test("a committed city survives a list failure and signing in again returns to its map", async ({ page }) => {
  const credentials = await register(page, "Градостроитель");
  await openSection(page, "Города");
  let creates = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname.endsWith("/rpc/create_city") && request.method() === "POST") creates++;
  });
  // The write succeeds on the real backend. Only the subsequent list read fails.
  const cityList = "**/rest/v1/cities?*";
  await page.route(cityList, route => route.fulfill({
    status: 400, contentType: "application/json", body: JSON.stringify({ message: "Ошибка загрузки списка" }),
  }));
  await page.getByLabel("Название города", { exact: true }).fill("Тихий берег");
  await page.getByRole("button", { name: "Создать город", exact: true }).click();
  const cities = page.getByRole("dialog", { name: "Города", exact: true });
  await expect(cities.getByRole("alert")).toBeVisible();
  await expect(cities.getByRole("button", { name: "Создать город", exact: true })).toBeDisabled();
  await page.unroute(cityList);
  await cities.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(cities).toBeHidden();
  await expect(page.getByRole("heading", { name: "Тихий берег", exact: true })).toBeVisible();
  expect(creates).toBe(1);

  await page.getByRole("button", { name: "Аккаунт", exact: true }).click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.getByLabel("Почта", { exact: true }).fill(credentials.email);
  await page.getByLabel("Пароль", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Тихий берег", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
