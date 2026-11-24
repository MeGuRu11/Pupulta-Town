import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createCity, openBuildings, openSection, register } from "./helpers.ts";

const stylePath = fileURLToPath(new URL("./map-capture.css", import.meta.url));
const style = readFileSync(stylePath, "utf8");

// Rasterize just the canvas with the same software WebGL backend on Windows and Linux.
test.use({
  viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1,
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function addTask(page: Page, title: string, size: "S" | "M", due: string) {
  await openSection(page, "Новая задача");
  await page.getByLabel("Название задачи", { exact: true }).fill(title);
  await page.getByRole("combobox", { name: "Размер", exact: true }).selectOption(size);
  await page.getByLabel("Срок", { exact: true }).fill(due);
  await page.getByRole("button", { name: "Создать задачу", exact: true }).click();
  await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible();
}

test("the city shows an intermediate camera angle and respects reduced motion", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T10:00:00Z") });
  await page.goto("/");
  const canvas = page.getByTestId("city-scene").locator("canvas");
  const right = page.getByRole("button", { name: "Повернуть вправо" });
  const left = page.getByRole("button", { name: "Повернуть влево" });
  await expect(right).toBeVisible();
  // The controls can mount before the first WebGL frame reaches the compositor.
  // Wait for terrain at the centre of the actual screenshot before storing it.
  const capture = () => canvas.screenshot({ style });
  await expect.poll(async () => page.evaluate(async png => {
    const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64," + png)).blob());
    const sample = document.createElement("canvas").getContext("2d")!;
    sample.drawImage(bitmap, bitmap.width / 2, bitmap.height / 2, 1, 1, 0, 0, 1, 1);
    bitmap.close();
    const [red, green, blue] = sample.getImageData(0, 0, 1, 1).data;
    return green! > 90 && green! > blue! && red! > blue!;
  }, (await capture()).toString("base64"))).toBe(true);
  await page.clock.pauseAt(new Date("2030-01-01T10:05:00Z"));
  await page.clock.runFor(64);
  const front = await capture();
  await right.evaluate(button => (button as HTMLButtonElement).click());
  await page.clock.runFor(160);
  const turning = await capture();
  await page.clock.runFor(1200);
  const side = await capture();
  expect(turning.equals(front)).toBe(false);
  expect(turning.equals(side)).toBe(false);
  expect(side.equals(front)).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await left.evaluate(button => (button as HTMLButtonElement).click());
  await page.clock.runFor(64);
  // Browser time stays paused at 64 ms while the GPU presents that frame.
  await expect.poll(async () => (await capture()).equals(front)).toBe(true);
});

test("a seeded city draws task stages and decay, rotates and restores its map", async ({ page }) => {
  test.setTimeout(120_000);
  // The fixed clock is later than the real closure timestamp written by the test database.
  await register(page, "Архитектор", "/?seed=42&now=2099-01-22T09:00:00Z");
  await createCity(page, "Сосновая слобода");
  const canvas = page.getByTestId("city-scene").locator("canvas");
  await expect(canvas).toBeVisible();
  await addTask(page, "Ларёк", "S", "2099-02-01");
  await addTask(page, "Дом", "M", "2099-01-01");
  await openBuildings(page);
  const list = page.getByRole("list", { name: "Объекты на карте" });
  const kiosk = list.getByRole("listitem").filter({ hasText: "Ларёк" });
  const house = list.getByRole("listitem").filter({ hasText: "Дом" });
  await expect(kiosk).toContainText(/S.*Фундамент/);
  await expect(house).toContainText(/M.*Фундамент.*Пожар/);

  const kioskStatus = page.getByRole("combobox", { name: "Статус задачи Ларёк", exact: true });
  await openSection(page, "Задачи");
  await kioskStatus.selectOption("done");
  await openBuildings(page);
  await expect(kiosk).toContainText("Готовый объект");
  const houseStatus = page.getByRole("combobox", { name: "Статус задачи Дом", exact: true });
  await openSection(page, "Задачи");
  await houseStatus.selectOption("in_progress");
  await openBuildings(page);
  await expect(house).toContainText(/Стройка.*Пожар/);

  const image = "city-with-construction.png";
  await page.keyboard.press("Escape");
  await expect(canvas).toHaveScreenshot(image, { stylePath });
  const front = await canvas.screenshot({ style });
  await page.getByRole("button", { name: "Повернуть вправо", exact: true }).click();
  await expect.poll(async () => !(await canvas.screenshot({ style })).equals(front)).toBe(true);
  await page.getByRole("button", { name: "Повернуть влево", exact: true }).click();
  await expect(canvas).toHaveScreenshot(image, { stylePath });
  await page.getByRole("button", { name: "Приблизить карту", exact: true }).click();
  await expect.poll(async () => !(await canvas.screenshot({ style })).equals(front)).toBe(true);
  await page.getByRole("button", { name: "Отдалить карту", exact: true }).click();
  await expect(canvas).toHaveScreenshot(image, { stylePath });

  await openSection(page, "Задачи");
  await houseStatus.selectOption("done");
  await openBuildings(page);
  await expect(house).toContainText("Готовый объект");
  await expect(house).not.toContainText("Пожар");
  await expect.poll(async () => !(await canvas.screenshot({ style })).equals(front)).toBe(true);
});

test("a row of homes and nearby kiosks changes its shared boundaries when construction ends", async ({ page }) => {
  test.setTimeout(120_000);
  await register(page, "Градостроитель", "/?seed=42&now=2099-01-22T09:00:00Z");
  await createCity(page, "Тихий переулок");

  // Three M lots fill the back row. The two S lots are then allocated side by side in front.
  const homes = ["Дом с палисадником", "Соседний дом", "Новый дом"];
  const kiosks = ["Булочная", "Цветочный киоск"];
  for (const title of [...homes, ...kiosks]) {
    await addTask(page, title, homes.includes(title) ? "M" : "S", "2099-02-01");
    await page.getByRole("combobox", { name: `Статус задачи ${title}`, exact: true })
      .selectOption(title === "Новый дом" ? "in_progress" : "done");
  }

  await openBuildings(page);
  const objects = page.getByRole("list", { name: "Объекты на карте" });
  await expect(objects.getByRole("listitem").filter({ hasText: "Готовый объект" })).toHaveCount(4);
  const building = objects.getByRole("listitem").filter({ hasText: "Новый дом" });
  await expect(building).toContainText("Стройка");
  const canvas = page.getByTestId("city-scene").locator("canvas");
  await expect(canvas).toHaveScreenshot("neighbouring-lots-under-construction.png", { stylePath });

  await openSection(page, "Задачи");
  await page.getByRole("combobox", { name: "Статус задачи Новый дом", exact: true }).selectOption("done");
  await openBuildings(page);
  await expect(building).toContainText("Готовый объект");
  await expect(canvas).toHaveScreenshot("neighbouring-lots-complete.png", { stylePath });
});

test("the tracker remains usable without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply(getContext, canvas, args) {
        if (["webgl2", "webgl", "experimental-webgl"].includes(args[0])) return null;
        return Reflect.apply(getContext, canvas, args);
      },
    });
  });
  await register(page, "Мастер");
  await createCity(page, "Город без WebGL");
  await expect(page.getByText(/Не удалось открыть 3D-карту/)).toBeVisible();
  await addTask(page, "Мастерская", "M", "2099-02-01");
  await openBuildings(page);
  await expect(page.getByRole("list", { name: "Объекты на карте" }))
    .toContainText(/Мастерская.*M.*Фундамент/);
});
