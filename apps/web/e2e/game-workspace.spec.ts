import { expect, test } from "@playwright/test";
import { createCity, register } from "./helpers.ts";

test("the city fills the viewport and stays mounted while its menus open", async ({ page }) => {
  await register(page, "Архитектор");
  await createCity(page, "Высокий берег");
  const scene = page.getByTestId("city-scene").locator("canvas");
  await expect(scene).toBeVisible();
  const original = await scene.elementHandle();
  if (!original) throw new Error("Missing city canvas");
  const dock = page.getByRole("navigation", { name: "Меню города" });
  const map = dock.getByRole("button", { name: "Карта", exact: true });
  await expect(map).toHaveAttribute("aria-pressed", "true");
  const completed = page.getByRole("button", { name: "Завершённые задачи" });
  await completed.click();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: "Статус", exact: true })).toHaveValue("done");
  await page.keyboard.press("Escape");
  await expect(completed).toBeFocused();
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => scene.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
    for (const name of ["Задачи", "События", "Личная комната"]) {
      const control = dock.getByRole("button", { name, exact: true });
      await control.click();
      await expect(page.getByRole("button", { name: "Закрыть окно", exact: true })).toBeVisible();
      expect(await scene.evaluate((node, first) => node === first, original)).toBe(true);
      expect(await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }))).toEqual(viewport);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Закрыть окно", exact: true })).toBeHidden();
      await expect(control).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 390, height: 540 });
  await dock.getByRole("button", { name: "Новая задача", exact: true }).click();
  const title = page.getByLabel("Название задачи", { exact: true });
  await title.fill("Дом на набережной");
  await dock.getByRole("button", { name: "Участники", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Участники", exact: true })).toBeVisible();
  await dock.getByRole("button", { name: "Новая задача", exact: true }).click();
  await expect(title).toHaveValue("Дом на набережной");
  const create = page.getByRole("button", { name: "Создать задачу", exact: true });
  await create.scrollIntoViewIfNeeded();
  await expect(create).toBeInViewport();
  await expect(dock).toBeInViewport();
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(0);
  expect(await page.locator(".game-window-body").evaluate(node => node.scrollTop)).toBeGreaterThan(0);
});
