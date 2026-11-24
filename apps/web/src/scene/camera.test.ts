import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { advanceCameraTurn, DEFAULT_ZOOM, frameCityCamera, limitZoom, MAX_ZOOM, MIN_ZOOM } from "./camera.ts";

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

  it("keeps a constant image scale and centre through a turn", () => {
    const camera = new OrthographicCamera();
    frameCityCamera(camera, 390, 844, 40, 0, 1.25);
    const width = camera.right - camera.left;
    for (const turn of [-0.75, 0.25, 0.5, 1, 4]) {
      frameCityCamera(camera, 390, 844, 40, turn, 1.25);
      expect(camera.right - camera.left).toBeCloseTo(width, 10);
      expect(camera.zoom).toBe(1.25);
      const centre = new Vector3(20, 1.3, 20).project(camera);
      expect(centre.x).toBeCloseTo(0);
      expect(centre.y).toBeCloseTo(0);
    }
  });
});

describe("camera turn motion", () => {
  it("moves continuously in the requested direction across the last face and lands exactly", () => {
    for (const [from, to] of [[3, 4], [0, -1]] as const) {
      const start = { rotation: from, velocity: 0 };
      const moving = advanceCameraTurn(start, to, 0.1);
      expect(moving.rotation).toBeGreaterThan(Math.min(from, to));
      expect(moving.rotation).toBeLessThan(Math.max(from, to));
      expect(Math.sign(moving.velocity)).toBe(Math.sign(to - from));
      expect(advanceCameraTurn(moving, to, 2)).toEqual({ rotation: to, velocity: 0 });
    }
  });

  it("uses elapsed time consistently at different rendering rates", () => {
    const start = { rotation: 0, velocity: 0 };
    let state = start;
    for (let frame = 0; frame < 15; frame++) state = advanceCameraTurn(state, 1, 1 / 60);
    const delayed = advanceCameraTurn(start, 1, 0.25);
    expect(state.rotation).toBeCloseTo(delayed.rotation, 10);
    expect(state.velocity).toBeCloseTo(delayed.velocity, 10);
  });

  it("retargets a running turn without snapping or discarding additional clicks", () => {
    const moving = advanceCameraTurn({ rotation: 0, velocity: 0 }, 1, 0.08);
    const forward = advanceCameraTurn(moving, 2, 0.06);
    expect(forward.rotation).toBeGreaterThan(moving.rotation);
    expect(forward.rotation).toBeLessThan(2);
    const reversed = advanceCameraTurn(forward, 0, 0);
    expect(reversed.rotation).toBeCloseTo(forward.rotation, 12);
    expect(reversed.velocity).toBeCloseTo(forward.velocity, 12);
    const returning = advanceCameraTurn(reversed, 0, 0.2);
    expect(returning.rotation).toBeLessThan(forward.rotation);
    expect(advanceCameraTurn(returning, 0, 2)).toEqual({ rotation: 0, velocity: 0 });
  });
});
