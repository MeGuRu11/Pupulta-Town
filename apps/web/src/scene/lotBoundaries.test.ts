import { describe, expect, it } from "vitest";
import { makeLotBoundaries } from "./lotBoundaries.ts";
import type { SceneLot } from "./model.ts";

function lot(x: number, z: number, size: SceneLot["size"] = "M", rotation = 0): SceneLot {
  const id = `${x},${z}`;
  const side = size === "M" ? 8 : 2;
  return { id, taskId: id, title: id, size, stage: "complete", decay: "none",
    x, z, width: side, depth: side, rotation };
}

describe("shared parcel boundaries", () => {
  it("leaves an isolated lot, a street, a vacant strip and a corner contact open", () => {
    expect(makeLotBoundaries([])).toEqual([]);
    expect(makeLotBoundaries([lot(12, 12)])).toEqual([]);
    expect(makeLotBoundaries([lot(28, 28), lot(44, 28)])).toEqual([]);
    expect(makeLotBoundaries([lot(12, 12), lot(22, 12)])).toEqual([]);
    expect(makeLotBoundaries([lot(12, 12), lot(20, 20)])).toEqual([]);
  });

  it("uses one fence, hedge or paved strip for each pair of finished neighbours", () => {
    expect(makeLotBoundaries([lot(12, 12), lot(20, 12)])).toEqual([
      { axis: "z", fixed: 16, start: 8, end: 16, kind: "fence", openings: [] },
    ]);
    expect(makeLotBoundaries([lot(12, 12), lot(17, 9, "S")])).toEqual([
      { axis: "z", fixed: 16, start: 8, end: 10, kind: "hedge", openings: [] },
    ]);
    expect(makeLotBoundaries([lot(9, 9, "S"), lot(11, 9, "S")])).toEqual([
      { axis: "z", fixed: 10, start: 8, end: 10, kind: "paving", openings: [] },
    ]);
  });

  it("uses a temporary barrier while either neighbour is unfinished", () => {
    const house = lot(12, 12), kiosk = lot(17, 9, "S");
    for (const stage of ["foundation", "construction"] as const) {
      expect(makeLotBoundaries([{ ...house, stage }, kiosk])[0]?.kind).toBe("works");
      expect(makeLotBoundaries([house, { ...kiosk, stage }])[0]?.kind).toBe("works");
    }
    expect(makeLotBoundaries([house, kiosk])[0]?.kind).toBe("hedge");
  });

  it("matches only occupied parts of a long edge at negative coordinates regardless of input order", () => {
    const row = [lot(-20, -20), lot(-15, -23, "S"), lot(-15, -17, "S")];
    const expected = [
      { axis: "z", fixed: -16, start: -24, end: -22, kind: "hedge", openings: [] },
      { axis: "z", fixed: -16, start: -18, end: -16, kind: "hedge", openings: [] },
    ];
    expect(makeLotBoundaries(row)).toEqual(expected);
    expect(makeLotBoundaries([...row].reverse())).toEqual(expected);
  });

  it("places a single gate in front of two doors facing each other", () => {
    const gates = [{ start: 11.4, end: 12.6 }];
    expect(makeLotBoundaries([lot(12, 12), lot(12, 20, "M", Math.PI)])).toEqual([
      { axis: "x", fixed: 16, start: 8, end: 16, kind: "fence", openings: gates },
    ]);
    expect(makeLotBoundaries([
      lot(12, 12, "M", Math.PI / 2), lot(20, 12, "M", 3 * Math.PI / 2),
    ])).toEqual([{ axis: "z", fixed: 16, start: 8, end: 16, kind: "fence", openings: gates }]);
  });

  it("gives a kiosk access through a hedge or temporary barrier at its rotated counter", () => {
    const house = lot(12, 12), kiosk = lot(17, 9, "S", 3 * Math.PI / 2);
    for (const stage of ["construction", "complete"] as const)
      expect(makeLotBoundaries([house, { ...kiosk, stage }])[0]?.openings)
        .toEqual([{ start: 8.5, end: 9.5 }]);
  });

  it("keeps the house entrance clear across two adjoining short boundary segments", () => {
    const boundaries = makeLotBoundaries([lot(12, 12), lot(11, 17, "S"), lot(13, 17, "S")]);
    expect(boundaries.filter(b => b.axis === "x")).toEqual([
      { axis: "x", fixed: 16, start: 10, end: 12, kind: "hedge", openings: [{ start: 11.4, end: 12 }] },
      { axis: "x", fixed: 16, start: 12, end: 14, kind: "hedge", openings: [{ start: 12, end: 12.6 }] },
    ]);
  });
});
