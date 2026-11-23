import { describe, expect, it } from "vitest";
import { boundaryParts } from "./boundaryParts.ts";
import type { LotBoundary } from "./lotBoundaries.ts";

const origin = { x: -32, z: 64 };
const edge: LotBoundary = {
  kind: "fence", axis: "x", start: -24, end: -16, fixed: 80,
  openings: [{ start: -20.6, end: -19.4 }],
};

describe("visible boundaries", () => {
  for (const kind of ["fence", "hedge", "works"] as const) {
    it(`keeps the entrance and both ends clear of every ${kind} part`, () => {
      const parts = boundaryParts([{ ...edge, kind }], origin);
      expect(parts.length).toBeGreaterThan(0);
      let before = false, after = false;
      for (const { position: [x, , z], scale: [width] } of parts) {
        const left = origin.x + x - width / 2;
        const right = origin.x + x + width / 2;
        expect(left).toBeGreaterThanOrEqual(edge.start);
        expect(right).toBeLessThanOrEqual(edge.end);
        expect(right <= -20.6 || left >= -19.4).toBe(true);
        expect(origin.z + z).toBe(edge.fixed);
        before ||= right <= -20.6;
        after ||= left >= -19.4;
      }
      expect(before && after).toBe(true);
    });
  }

  it("lays a continuous walkable strip along a side shared by two kiosks", () => {
    const parts = boundaryParts([{ ...edge, kind: "paving", axis: "z", fixed: -16,
      start: 80, end: 82, openings: [{ start: 80.5, end: 81.5 }] }], origin);
    expect(parts).toHaveLength(1);
    const { position: [x, y, z], scale: [width, height, depth] } = parts[0]!;
    expect(x).toBe(16);
    expect(z).toBe(17);
    expect(depth).toBe(2);
    expect(width).toBeLessThan(1);
    expect(y + height / 2).toBeLessThan(0.1);
  });
});
