import { cellKind, CELL_SIZE_M } from "@pupulta/shared";
import { describe, expect, it } from "vitest";
import { MAX_RESIDENT_SPEED_MPS, simulate } from "./index.ts";

// A fixed moment, as the Playwright screenshots will use: 2026-11-01T12:00:00Z.
const NOON = 1_793_534_400_000;

describe("simulate", () => {
  it("gives the same positions for the same seed and time", () => {
    expect(simulate(123, NOON)).toEqual(simulate(123, NOON));
  });

  it("gives different positions for different seeds", () => {
    expect(simulate(123, NOON)).not.toEqual(simulate(124, NOON));
  });

  it("moves residents as time passes", () => {
    expect(simulate(123, NOON + 1000)).not.toEqual(simulate(123, NOON));
  });

  it("returns the requested number of residents with stable ids", () => {
    const residents = simulate(5, NOON, { residents: 12, blocks: 2 });
    expect(residents.map(({ id }) => id)).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it("keeps every resident on a sidewalk cell", () => {
    for (let step = 0; step < 200; step++) {
      for (const { x, z } of simulate(99, NOON + step * 1_337)) {
        const cell = { x: Math.floor(x / CELL_SIZE_M), z: Math.floor(z / CELL_SIZE_M) };
        expect(cellKind(cell)).toBe("sidewalk");
      }
    }
  });

  it("moves a resident no farther than its top speed in one second", () => {
    for (let step = 0; step < 100; step++) {
      const time = NOON + step * 7_919;
      const before = simulate(31, time);
      const after = simulate(31, time + 1000);
      before.forEach((resident, i) => {
        const next = after[i];
        if (!next) throw new Error(`resident ${i} disappeared`);
        const distance = Math.hypot(next.x - resident.x, next.z - resident.z);
        expect(distance).toBeLessThanOrEqual(MAX_RESIDENT_SPEED_MPS + 1e-9);
      });
    }
  });

  it("does not depend on the order of calls", () => {
    const late = simulate(8, NOON + 60_000);
    simulate(8, NOON);
    expect(simulate(8, NOON + 60_000)).toEqual(late);
  });
});
