import { expect, test, type Locator, type Page } from "@playwright/test";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { createCity, openBuildings, openSection, register } from "./helpers.ts";

const viewport = { width: 1280, height: 900 };
const sceneQuery = new URLSearchParams({ seed: "42", now: "2099-01-22T09:00:00Z" });
const live = "Обновляется в реальном времени";
const title = "Дом команды";
const deadlineMs = 2_000;
const captureStyle = readFileSync(new URL("./map-capture.css", import.meta.url), "utf8");
// At the fixed viewport and camera, the first M lot sits in this unobstructed part of the map.
const firstLot = { x: 455, y: 210, width: 255, height: 245 };

test.use({
  viewport,
  deviceScaleFactor: 1,
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});
test.describe.configure({ retries: 0 });

async function captureMap(canvas: Locator): Promise<Buffer> {
  return canvas.screenshot({ style: captureStyle });
}

/** With fixed time and seed, only a change to the city can change its canvas. */
async function changedFrame(canvas: Locator, previous: Buffer): Promise<Buffer> {
  let frame = previous;
  await expect.poll(async () => {
    frame = await captureMap(canvas);
    return !frame.equals(previous);
  }, { intervals: [25, 50, 100] }).toBe(true);
  return frame;
}

function cityMap(page: Page) {
  return {
    canvas: page.getByTestId("city-scene").locator("canvas"),
    house: page.getByRole("list", { name: "Объекты на карте" }).getByRole("listitem").filter({ hasText: title }),
  };
}

test("the leader sees the assignee build and repair a house within two seconds per transition",
  async ({ page: leader, browser, baseURL }) => {
    test.setTimeout(90_000);
    if (!baseURL) throw new Error("Start the local Playwright server.");
    const memberSession = await browser.newContext({ baseURL, viewport, deviceScaleFactor: 1 });
    try {
      const member = await memberSession.newPage();
      await register(leader, "Архитектор", "/?" + sceneQuery);
      await createCity(leader, "Город двух игроков");
      await openSection(leader, "Участники");
      await leader.getByRole("button", { name: "Пригласить", exact: true }).click();
      const invite = new URL(await leader.getByLabel("Ссылка-приглашение").inputValue());
      expect(invite.origin).toBe(new URL(baseURL).origin);
      for (const [key, value] of sceneQuery) invite.searchParams.set(key, value);
      await register(member, "Строитель", invite.href);
      await member.getByRole("button", { name: "Присоединиться", exact: true }).click();
      await expect(member.getByRole("heading", { name: "Город двух игроков", exact: true })).toBeVisible();
      await leader.getByRole("button", { name: "Скрыть приглашение", exact: true }).click();
      await leader.getByRole("button", { name: "Обновить", exact: true }).click();

      for (const page of [leader, member]) {
        await openSection(page, "Участники");
        await expect(page.getByText(live, { exact: true })).toBeVisible();
        await openBuildings(page);
      }
      const leaderMap = cityMap(leader);
      const memberMap = cityMap(member);
      const empty = await captureMap(leaderMap.canvas);
      await expect.poll(async () => (await captureMap(memberMap.canvas)).equals(empty)).toBe(true);

      await openSection(leader, "Новая задача");
      await leader.getByLabel("Название задачи", { exact: true }).fill(title);
      await leader.getByRole("combobox", { name: "Размер", exact: true }).selectOption("M");
      await leader.getByLabel("Срок", { exact: true }).fill("2099-01-01");
      await leader.getByRole("checkbox", { name: "Строитель", exact: true }).check();
      await leader.getByRole("button", { name: "Создать задачу", exact: true }).click();
      await expect(leader.getByRole("article", { name: title, exact: true })).toBeVisible();
      await openBuildings(leader);
      const foundation = title + " · M · Фундамент · Пожар";
      await expect(leaderMap.house).toHaveText(foundation);
      await expect(memberMap.house).toHaveText(foundation);
      let previous = await changedFrame(leaderMap.canvas, empty);
      await expect.poll(async () => (await captureMap(memberMap.canvas)).equals(previous)).toBe(true);

      const status = member.getByRole("combobox", { name: "Статус задачи " + title, exact: true });
      for (const [value, expectedStage] of [
        ["in_progress", "Стройка · Пожар"],
        ["done", "Готовый объект"],
      ] as const) {
        const state = title + " · M · " + expectedStage;
        await openSection(member, "Задачи");
        await status.scrollIntoViewIfNeeded();
        const before = await leader.screenshot({ clip: firstLot });
        // One monotonic clock includes the UI action, RPC, realtime delivery and captured paint.
        const started = performance.now();
        await status.selectOption(value);
        await expect.poll(async () => !(await leader.screenshot({ clip: firstLot })).equals(before),
          { intervals: [25, 50, 100] }).toBe(true);
        const elapsed = performance.now() - started;
        console.log("Map transition %s: %d ms", value, Math.ceil(elapsed));
        expect(elapsed, "Remote map transition " + value + " in milliseconds").toBeLessThan(deadlineMs);

        await expect(leaderMap.house).toHaveText(state);
        const frame = await changedFrame(leaderMap.canvas, previous);
        await openBuildings(member);
        await expect(memberMap.house).toHaveText(state);
        await expect.poll(async () => (await captureMap(memberMap.canvas)).equals(frame)).toBe(true);
        previous = frame;
      }
    } finally {
      await memberSession.close();
    }
  });
