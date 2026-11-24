import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { DEFAULT_ZOOM, frameCityCamera, limitZoom, MAX_ZOOM, MIN_ZOOM } from "./camera.ts";

describe("full-screen city camera", () => {
  it("keeps the whole board between the upper and lower HUD in overview", () => {
    for (const [width, height] of [[1280, 900], [390, 844], [844, 390]] as const) {
      for (const turn of [0, 1, 2, 3]) {
        const camera = new OrthographicCamera();
        frameCityCamera(camera, width, height, 40, turn, DEFAULT_ZOOM);
        for (const x of [0, 40]) for (const z of [0, 40]) for (const y of [-1.5, 7]) {
          const point = new Vector3(x, y, z).project(camera);
          const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
          expect(px).toBeGreaterThan(10);
          expect(px).toBeLessThan(width - 10);
          expect(py).toBeGreaterThan(Math.min(80, height / 5));
          expect(py).toBeLessThan(height - Math.min(80, height / 5));
        }
      }
    }
  });

  it("bounds zoom and preserves its value when changing orientation", () => {
    expect(limitZoom(MIN_ZOOM / 2)).toBe(MIN_ZOOM);
    expect(limitZoom(MAX_ZOOM * 2)).toBe(MAX_ZOOM);
    const camera = new OrthographicCamera();
    const point = new Vector3(40, 0, 0);
    frameCityCamera(camera, 1280, 900, 40, 0, DEFAULT_ZOOM);
    const overview = point.clone().project(camera).x;
    frameCityCamera(camera, 1280, 900, 40, 0, MAX_ZOOM);
    expect(point.clone().project(camera).x).toBeCloseTo(overview * MAX_ZOOM / DEFAULT_ZOOM);
    frameCityCamera(camera, 1280, 900, 40, 1, MAX_ZOOM);
    expect(camera.zoom).toBe(MAX_ZOOM);
  });
});
