import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator } from "@playwright/test";

const stylePath = fileURLToPath(new URL("./map-capture.css", import.meta.url));
const style = readFileSync(stylePath, "utf8");

test.use({
  viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce",
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function capture(canvas: Locator) {
  return createHash("sha256").update(await canvas.screenshot({ style })).digest("hex");
}

async function expectNewView(canvas: Locator, seen: Set<string>) {
  let view = "";
  await expect.poll(async () => {
    view = await capture(canvas);
    return seen.has(view);
  }).toBe(false);
  seen.add(view);
}

test("a tower shows its construction stages and three distinct decay treatments", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/prototype/tower");
  await expect(page.getByRole("heading", { name: "Башня L", exact: true })).toBeVisible();
  const canvas = page.getByTestId("city-scene").locator("canvas");
  const stage = page.getByRole("combobox", { name: "Этап строительства", exact: true });
  const decay = page.getByRole("combobox", { name: "Порча", exact: true });
  const floors = page.getByRole("slider", { name: "Этажи", exact: true });
  await stage.selectOption("complete");
  await floors.press("Home");
  for (let floor = 1; floor < 8; floor++) await floors.press("ArrowRight");
  await expect(floors).toHaveValue("8");
  await decay.selectOption("none");
  const cleanImage = "tower-eight-floors.png";
  await expect(canvas).toHaveScreenshot(cleanImage, { stylePath });
  const cleanView = await capture(canvas);
  const seen = new Set([cleanView]);
  for (const effect of ["dirt", "graffiti", "defect"]) {
    await decay.selectOption(effect);
    await expectNewView(canvas, seen);
  }
  await decay.selectOption("none");
  await expect.poll(() => capture(canvas)).toBe(cleanView);
  await stage.selectOption("foundation");
  await expect(floors).toBeDisabled();
  await expect(floors).toHaveValue("0");
  await expectNewView(canvas, seen);
  await stage.selectOption("construction");
  await expect(floors).toBeEnabled();
  await expect(floors).toHaveValue("8");
  await expectNewView(canvas, seen);
  await stage.selectOption("complete");
  await expect(canvas).toHaveScreenshot(cleanImage, { stylePath });
});

test("tower height and all four camera sides can be compared at normal zoom", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/prototype/tower");
  const canvas = page.getByTestId("city-scene").locator("canvas");
  const floors = page.getByRole("slider", { name: "Этажи", exact: true });
  const count = page.getByTestId("tower-occlusion");
  await page.getByRole("combobox", { name: "Этап строительства", exact: true }).selectOption("complete");
  await expect(floors).toHaveAttribute("min", "1");
  await expect(floors).toHaveAttribute("max", "15");
  await floors.press("Home");
  await expect(floors).toHaveValue("1");
  const firstCount = await count.innerText();
  await floors.press("End");
  await expect(floors).toHaveValue("15");
  await expect(count).not.toHaveText(firstCount);

  const tallImage = "tower-fifteen-floors.png";
  await expect(canvas).toHaveScreenshot(tallImage, { stylePath });
  const seen = new Set([await capture(canvas)]);
  const rotate = page.getByRole("button", { name: "Повернуть вправо", exact: true });
  for (const side of [2, 3, 4]) {
    await rotate.click();
    await expect(page.getByText(`Ракурс ${side} из 4`, { exact: true })).toBeVisible();
    await expectNewView(canvas, seen);
  }
  await rotate.click();
  await expect(page.getByText("Ракурс 1 из 4", { exact: true })).toBeVisible();
  await expect(canvas).toHaveScreenshot(tallImage, { stylePath });
});
