import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createCity, openSection, register } from "./helpers.ts";

test("registration, city creation, restored session and password sign-in", async ({ page }) => {
  const cityName = `Город ${randomUUID().slice(0, 8)}`;
  const { email, password } = await register(page, "Архитектор");
  await page.getByLabel("Код приглашения", { exact: true }).fill("bad-invite");
  await page.getByRole("button", { name: "Присоединиться", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Вставьте код или ссылку-приглашение в город.");
  await createCity(page, cityName);
  await openSection(page, "Задачи");
  await expect(page.getByText("В городе пока нет задач.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Аккаунт", exact: true }).click();
  await expect(page.getByRole("button", { name: "Выйти", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: cityName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(page.getByRole("heading", { name: cityName, exact: true })).toHaveCount(0);
  await page.getByLabel("Почта", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("heading", { name: cityName, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const menu = page.getByRole("navigation", { name: "Меню города" }).getByRole("button", { name: "Города", exact: true });
  const navigation = page.getByRole("navigation", { name: "Выбор города", exact: true });
  await expect(menu).toHaveAttribute("aria-pressed", "false");
  await expect(navigation).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-pressed", "true");
  await navigation.getByRole("button", { name: cityName, exact: true }).click();
  await expect(navigation).toBeHidden();
  await expect(menu).toHaveAttribute("aria-pressed", "false");
});

test("invitation, role-aware S/M tasks and live status updates between two sessions", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  if (!baseURL) throw new Error("The tracker suite requires a local Playwright baseURL.");
  const leaderContext = await browser.newContext({ baseURL });
  const memberContext = await browser.newContext({ baseURL });
  try {
    const leader = await leaderContext.newPage();
    const member = await memberContext.newPage();
    const suffix = randomUUID().slice(0, 8);
    const cityName = `Пупульта ${suffix}`;
    const memberName = `Строитель ${suffix}`;
    await register(leader, "Руководитель");
    await createCity(leader, cityName);
    await openSection(leader, "Участники");
    await leader.getByRole("button", { name: "Пригласить", exact: true }).click();
    const invite = await leader.getByLabel("Ссылка-приглашение", { exact: true }).inputValue();
    expect(new URL(invite).origin).toBe(new URL(baseURL).origin);
    expect(new URL(invite).searchParams.get("invite")).toBeTruthy();
    await register(member, memberName, invite);
    await member.getByRole("button", { name: "Присоединиться", exact: true }).click();
    await expect(member.getByRole("heading", { name: cityName, exact: true })).toBeVisible();
    await openSection(member, "Участники");
    await expect(member.getByRole("button", { name: "Пригласить", exact: true })).toHaveCount(0);
    await openSection(member, "Задачи");
    await expect(member.getByRole("heading", { name: "Задачи города", exact: true })).toBeVisible();
    await expect(member.getByRole("button", { name: "Создать задачу", exact: true })).toHaveCount(0);
    await expect(member.getByRole("navigation", { name: "Меню города" }).getByRole("button", { name: "Новая задача", exact: true })).toHaveCount(0);
    await leader.getByRole("button", { name: "Обновить", exact: true }).click();

    for (const size of ["S", "M"] as const) {
      const title = `${size === "S" ? "Ларёк" : "Дом"} ${suffix}`;
      await openSection(leader, "Новая задача");
      await leader.getByLabel("Название задачи", { exact: true }).fill(title);
      await leader.getByLabel("Описание", { exact: true }).fill("Подготовить черновой объект города");
      await leader.getByRole("combobox", { name: "Размер", exact: true }).selectOption(size);
      await leader.getByLabel("Срок", { exact: true }).fill("2026-12-01");
      await leader.getByRole("checkbox", { name: memberName, exact: true }).check();
      await leader.getByRole("button", { name: "Создать задачу", exact: true }).click();
      const object = member.getByRole("article", { name: title, exact: true });
      await expect(object).toContainText(`${size} · Фундамент`);
      const statusLabel = `Статус задачи ${title}`;
      await member.getByLabel(statusLabel, { exact: true }).selectOption("in_progress");
      await expect(leader.getByLabel(statusLabel, { exact: true })).toHaveValue("in_progress");
      await expect(object).toContainText(`${size} · Стройка`);
      await member.getByLabel(statusLabel, { exact: true }).selectOption("done");
      await expect(leader.getByLabel(statusLabel, { exact: true })).toHaveValue("done");
      await expect(object).toContainText(`${size} · Готовый объект`);
    }

    await member.reload();
    await openSection(member, "Задачи");
    await expect(member.getByRole("article", { name: `Дом ${suffix}`, exact: true })).toBeVisible();
    await expect(member.getByLabel(`Статус задачи Дом ${suffix}`, { exact: true })).toHaveValue("done");
    await createCity(leader, `Другой ${suffix}`);
    await openSection(leader, "Задачи");
    await expect(leader.getByRole("article", { name: `Дом ${suffix}`, exact: true })).toHaveCount(0);
    await expect(member.getByRole("article", { name: `Дом ${suffix}`, exact: true })).toBeVisible();
    await openSection(leader, "Города");
    await leader.getByRole("button", { name: cityName, exact: true }).click();
    await openSection(leader, "Задачи");
    await expect(leader.getByLabel(`Статус задачи Дом ${suffix}`, { exact: true })).toHaveValue("done");
  } finally {
    await leaderContext.close();
    await memberContext.close();
  }
});
