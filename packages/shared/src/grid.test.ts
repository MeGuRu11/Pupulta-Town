import { describe, expect, it } from "vitest";
import {
  BLOCK_CELLS,
  CELL_SIZE_M,
  STREET_CELLS,
  cellKind,
  footprint,
  isStreet,
  type CellKind,
} from "./index.ts";
import { cellKindExamples, footprintExamples } from "./rules-examples.ts";

describe("grid constants", () => {
  it("match decisions 0008 and 0010", () => {
    expect(CELL_SIZE_M).toBe(2);
    expect(STREET_CELLS).toBe(4);
  });

  it("fit M and L into a block without leftover cells", () => {
    expect(BLOCK_CELLS % footprint("M").width).toBe(0);
    expect(BLOCK_CELLS % footprint("L").width).toBe(0);
  });
});

describe("footprint", () => {
  it.each(footprintExamples)("$size takes $width × $depth cells", ({ size, width, depth }) => {
    expect(footprint(size)).toEqual({ width, depth });
  });
});

describe("cellKind", () => {
  it.each(cellKindExamples)("cell ($x, $z) is $kind", ({ x, z, kind }) => {
    expect(cellKind({ x, z })).toBe(kind);
  });

  it("lays out an intersection as 4 corners, 8 crosswalks and 4 road cells", () => {
    const counts: Record<CellKind, number> = { lot: 0, sidewalk: 0, road: 0, crosswalk: 0 };
    for (let x = 0; x < STREET_CELLS; x++) {
      for (let z = 0; z < STREET_CELLS; z++) {
        counts[cellKind({ x, z })]++;
      }
    }
    expect(counts).toEqual({ lot: 0, sidewalk: 4, road: 4, crosswalk: 8 });
  });

  it("repeats with the period of a street plus a block", () => {
    const period = STREET_CELLS + BLOCK_CELLS;
    for (let x = -period; x < period; x++) {
      expect(cellKind({ x: x + period, z: 7 })).toBe(cellKind({ x, z: 7 }));
    }
  });

  it("rejects non-integer cells", () => {
    expect(() => cellKind({ x: 0.5, z: 0 })).toThrow(RangeError);
  });
});

describe("isStreet", () => {
  it("is true for every kind except lot", () => {
    for (const { x, z, kind } of cellKindExamples) {
      expect(isStreet({ x, z })).toBe(kind !== "lot");
    }
  });
});
