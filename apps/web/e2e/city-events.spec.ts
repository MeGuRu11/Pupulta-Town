import { expect, test, type Page } from "@playwright/test";
import { createCity, openSection, register } from "./helpers.ts";

const feed = (page: Page) => page.getByRole("region", { name: "Лента событий", exact: true });
// Feed updates come from the real database. Freeze only the city clock so two
// software-rendered views don't continuously repaint pedestrians during this test.
const sceneClock = "2099-01-22T09:00:00Z";

async function createHouse(page: Page, title: string, assignee?: string) {
  await openSection(page, "Новая задача");
  await page.getByLabel("Название задачи", { exact: true }).fill(title);
  await page.getByRole("combobox", { name: "Размер", exact: true }).selectOption("M");
  await page.getByLabel("Срок", { exact: true }).fill("2000-01-01");
  if (assignee) await page.getByRole("checkbox", { name: assignee, exact: true }).check();
  await page.getByRole("button", { name: "Создать задачу", exact: true }).click();
  await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible();
}

test("both players see who built the house and the city keeps its history", async ({ page: leader, browser, baseURL }) => {
  if (!baseURL) throw new Error("City feed tests require the local tracker.");
  await register(leader, "Аня", "/?" + new URLSearchParams({ now: sceneClock }));
  await createCity(leader, "Заречье");
  await openSection(leader, "События");
  await expect(feed(leader)).toBeVisible();
  await openSection(leader, "Участники");
  await leader.getByRole("button", { name: "Пригласить", exact: true }).click();
  const invite = new URL(await leader.getByLabel("Ссылка-приглашение", { exact: true }).inputValue());
  invite.searchParams.set("now", sceneClock);
  await openSection(leader, "События");
  const context = await browser.newContext({ baseURL });
  try {
    const member = await context.newPage();
    await register(member, "Борис", invite.href);
    await member.getByRole("button", { name: "Присоединиться", exact: true }).click();
    await expect(feed(leader).getByRole("listitem")).toContainText(["Борис"]);
    await openSection(leader, "Участники");
    await leader.getByRole("button", { name: "Обновить", exact: true }).click();
    await createHouse(leader, "Дом у реки", "Борис");
    await openSection(leader, "События");
    await openSection(member, "Задачи");
    const status = member.getByRole("combobox", { name: "Статус задачи Дом у реки", exact: true });
    await status.selectOption("in_progress");
    await expect(feed(leader).getByRole("listitem").first()).toContainText(/Борис.*Дом у реки.*строительство/i);
    await status.selectOption("done");
    const newest = feed(leader).getByRole("listitem").first();
    await expect(newest).toContainText(/Борис.*Дом у реки.*закрыта.*Дом построен.*восстановлена/);
    await expect(feed(leader).getByRole("listitem")).toHaveCount(4);
    await leader.reload();
    await openSection(leader, "События");
    await expect(newest).toContainText(/Борис.*Дом у реки/);
    await createCity(leader, "Сосновка");
    await openSection(leader, "События");
    await expect(feed(leader).getByText("Событий пока нет.", { exact: true })).toBeVisible();
    await expect(feed(leader).getByRole("listitem")).toHaveCount(0);
    await openSection(member, "События");
    await expect(feed(member).getByRole("listitem")).toHaveCount(4);
  } finally {
    await context.close();
  }
});

test("older history stays accessible when a new event arrives", async ({ page }) => {
  test.setTimeout(90_000);
  await register(page, "Вера");
  await createCity(page, "Долгая история");
  await createHouse(page, "Первая постройка");
  const status = page.getByRole("combobox", { name: "Статус задачи Первая постройка", exact: true });
  for (let i = 0; i < 20; i++) {
    const next = i % 2 === 0 ? "in_progress" : "done";
    await status.selectOption(next);
    await expect(status).toHaveValue(next);
    await expect(status).toBeEnabled();
  }
  const history = await page.context().newPage();
  await history.goto(page.url());
  await openSection(history, "События");
  const rows = feed(history).getByRole("listitem");
  await expect(rows).toHaveCount(20);
  await feed(history).getByRole("button", { name: "Показать ещё", exact: true }).click();
  await expect(rows).toHaveCount(21);
  await expect(rows.last()).toContainText(/фундамент дома/i);
  await status.selectOption("in_progress");
  await expect(rows).toHaveCount(22);
  await expect(rows.last()).toContainText(/фундамент дома/i);
  await expect(rows.first()).toContainText(/возобновлено/);
});
