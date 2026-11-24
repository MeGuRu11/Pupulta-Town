import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export async function register(page: Page, name: string, path = "/") {
  const email = `town-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  await page.goto(path);
  await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  await page.getByLabel("Имя", { exact: true }).fill(name);
  await page.getByLabel("Почта", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Зарегистрироваться", exact: true }).click();
  await expect(page.getByRole("button", { name: "Аккаунт", exact: true })).toBeVisible();
  if (!new URL(page.url()).hash) {
    await expect(page.getByRole("dialog", { name: "Города", exact: true })).toBeVisible();
  }
  return { email, password };
}

export async function createCity(page: Page, name: string) {
  await openSection(page, "Города");
  await page.getByLabel("Название города", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Создать город", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

export async function openSection(page: Page, name: string) {
  const button = page.getByRole("navigation", { name: "Меню города" }).getByRole("button", { name, exact: true });
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

export async function openBuildings(page: Page) {
  await openSection(page, "Постройки");
  const summary = page.getByText(/^Постройки на карте \(\d+\)$/);
  if (!await summary.evaluate(node => node.closest("details")?.open)) await summary.click();
}
