import { describe, expect, it } from "vitest";
import type { Part } from "./Scenery.tsx";
import { makeTowerParts } from "./towerParts.ts";

const stages = ["foundation", "construction", "complete"] as const;
const overlays = ["dirt", "graffiti", "defect"] as const;
const top = (parts: Part[]) => Math.max(...parts.map(p => p.position[1] + p.scale[1] / 2));

describe("modular tower", () => {
  it.each(stages)("keeps the %s and its overlays inside the six-cell lot", stage => {
    for (const decay of ["none", ...overlays] as const) {
      const parts = makeTowerParts(stage, 15, decay);
      expect(parts.length).toBeGreaterThan(0);
      for (const { position: [x, y, z], scale: [w, h, d], yaw = 0 } of parts) {
        const cos = Math.abs(Math.cos(yaw)), sin = Math.abs(Math.sin(yaw));
        expect(Math.abs(x) + (w * cos + d * sin) / 2).toBeLessThanOrEqual(6.000001);
        expect(Math.abs(z) + (w * sin + d * cos) / 2).toBeLessThanOrEqual(6.000001);
        expect(y - h / 2).toBeGreaterThanOrEqual(-0.000001);
        expect(Math.min(w, h, d)).toBeGreaterThan(0);
      }
    }
  });

  it("builds the same low footing for every planned height", () => {
    const base = makeTowerParts("foundation", 1, "none");
    expect(makeTowerParts("foundation", 15, "none")).toEqual(base);
    expect(top(base)).toBeLessThan(3);
  });

  it.each(["construction", "complete"] as const)("stacks %s modules every three metres", stage => {
    const first = top(makeTowerParts(stage, 1, "none"));
    for (const count of [2, 8, 15]) {
      expect(top(makeTowerParts(stage, count, "none")) - first).toBeCloseTo((count - 1) * 3);
    }
  });

  it("keeps the frame open where the finished tower has enclosed middle floors", () => {
    // Sample an off-centre interior point, away from columns and floor slabs.
    const containsPoint = (p: Part) => [2, 4.5, 2].every((coordinate, axis) =>
      Math.abs(coordinate - p.position[axis]!) < p.scale[axis]! / 2);
    expect(makeTowerParts("construction", 4, "none").some(containsPoint)).toBe(false);
    expect(makeTowerParts("complete", 4, "none").some(containsPoint)).toBe(true);
  });

  it.each(stages)("shows different additive decay marks on all four sides of the %s", stage => {
    const clean = makeTowerParts(stage, 4, "none");
    const variants = overlays.map(decay => {
      const weathered = makeTowerParts(stage, 4, decay);
      expect(weathered.slice(0, clean.length)).toEqual(clean);
      expect(top(weathered)).toBeCloseTo(top(clean));
      const marks = weathered.slice(clean.length);
      for (const side of [-1, 1]) {
        expect(marks.some(p => p.position[0] * side > 4)).toBe(true);
        expect(marks.some(p => p.position[2] * side > 4)).toBe(true);
      }
      return marks;
    });
    expect(new Set(variants.map(parts => JSON.stringify(parts))).size).toBe(3);
  });
});
