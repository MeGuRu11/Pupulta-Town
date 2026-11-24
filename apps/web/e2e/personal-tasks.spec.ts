import { expect, test, type Page } from "@playwright/test";
import { createCity, openSection, register } from "./helpers.ts";

async function openRoom(page: Page) {
  await openSection(page, "Личная комната");
  await expect(page.getByRole("heading", { name: "Личная комната", level: 2 })).toBeVisible();
}

function statusOf(page: Page, title: string) {
  return page.getByRole("combobox", { name: `Статус задачи ${title}`, exact: true });
}

async function addPersonalTask(page: Page, title: string) {
  await page.getByLabel("Название личной задачи", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Добавить задачу", exact: true }).click();
  await expect(statusOf(page, title)).toHaveValue("todo");
}

test("retrying a personal task after a lost response keeps exactly one saved task", async ({ page }) => {
  await register(page, "Художник", "/#personal");
  const input = page.getByLabel("Название личной задачи", { exact: true });
  const add = page.getByRole("button", { name: "Добавить задачу", exact: true });
  const title = "Подготовить эскиз двора";
  await input.fill(title);
  await page.route("**/rest/v1/personal_tasks?*", async route => {
    if (route.request().method() !== "POST") return route.continue();
    const committed = await route.fetch();
    expect(committed.status()).toBe(201);
    await route.abort("failed");
  }, { times: 1 });
  await add.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(input).toHaveValue(title);
  await add.click();
  await expect(statusOf(page, title)).toHaveValue("todo");
  await page.reload();
  await expect(page.getByRole("article", { name: title, exact: true })).toHaveCount(1);
});

test("personal tasks persist across city visits and stay private between teammates", async ({ page: leader, browser, baseURL }) => {
  test.setTimeout(90_000);
  if (!baseURL) throw new Error("The personal task suite requires a local Playwright baseURL.");
  const leaderTitle = "Разобрать свои эскизы";
  const memberTitle = "Выбрать книгу на вечер";
  await register(leader, "Руководитель");
  await openRoom(leader);
  await addPersonalTask(leader, leaderTitle);
  const leaderStatus = statusOf(leader, leaderTitle);
  await leaderStatus.selectOption("in_progress");
  await expect(leaderStatus).toHaveValue("in_progress");
  await leaderStatus.selectOption("done");
  await expect(leaderStatus).toHaveValue("done");
  await leader.reload();
  await expect(leader.getByRole("heading", { name: "Личная комната", level: 2 })).toBeVisible();
  await expect(leaderStatus).toHaveValue("done");
  await leaderStatus.selectOption("in_progress");
  await expect(leaderStatus).toHaveValue("in_progress");

  await createCity(leader, "Берёзовая роща");
  await openSection(leader, "Участники");
  await leader.getByRole("button", { name: "Пригласить", exact: true }).click();
  const invite = await leader.getByLabel("Ссылка-приглашение", { exact: true }).inputValue();
  const memberContext = await browser.newContext({ baseURL });
  try {
    const member = await memberContext.newPage();
    await register(member, "Исполнитель", invite);
    await member.getByRole("button", { name: "Присоединиться", exact: true }).click();
    await expect(member.getByRole("heading", { name: "Берёзовая роща", exact: true })).toBeVisible();
    await openRoom(member);
    await addPersonalTask(member, memberTitle);
    await expect(member.getByText(leaderTitle, { exact: true })).toHaveCount(0);

    await openRoom(leader);
    await expect(leaderStatus).toHaveValue("in_progress");
    await expect(leader.getByText(memberTitle, { exact: true })).toHaveCount(0);
    await openSection(leader, "Задачи");
    await expect(leader.getByText("В городе пока нет задач.", { exact: true })).toBeVisible();
    await openSection(leader, "Постройки");
    await expect(leader.getByText("Постройки на карте (0)", { exact: true })).toBeVisible();
  } finally {
    await memberContext.close();
  }
});
