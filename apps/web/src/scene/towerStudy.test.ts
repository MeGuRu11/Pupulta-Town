import { describe, expect, it } from "vitest";
import { cellKind, CELL_SIZE_M, footprint } from "@pupulta/shared";
import { sceneBlocks, sceneOrigin } from "./model.ts";
import type { Part } from "./Scenery.tsx";
import { makeTowerParts } from "./towerParts.ts";
import { measureTowerOcclusion, studyBlocks, studyLots, towerCenter } from "./towerStudy.ts";

describe("tower study neighbourhood", () => {
  it("fits the tower and every house on distinct buildable cells in the rendered grid", () => {
    const parcels = [
      ...studyLots,
      { ...towerCenter, size: "L" as const, width: 12, depth: 12 },
    ];
    const occupied = new Set<string>();
    expect(sceneOrigin(studyLots)).toEqual({ x: 0, z: 0 });
    expect(sceneBlocks(studyLots)).toBe(studyBlocks);
    expect(new Set(studyLots.map(lot => lot.title)).size).toBe(studyLots.length);
    for (const lot of parcels) {
      const cells = footprint(lot.size);
      expect(lot.width).toBe(cells.width * CELL_SIZE_M);
      expect(lot.depth).toBe(cells.depth * CELL_SIZE_M);
      const left = (lot.x - lot.width / 2) / CELL_SIZE_M;
      const top = (lot.z - lot.depth / 2) / CELL_SIZE_M;
      for (let x = left; x < left + cells.width; x++) {
        for (let z = top; z < top + cells.depth; z++) {
          expect(cellKind({ x, z })).toBe("lot");
          expect(occupied.has(`${x},${z}`)).toBe(false);
          occupied.add(`${x},${z}`);
        }
      }
    }
  });
});

describe("tower occlusion of ground-level lot centres", () => {
  const tall: Part = { position: [0, 22.5, 0], scale: [10, 45, 10], color: "tan" };
  it("reproduces the published results for the completed tower at each height and camera side", () => {
    for (let floors = 1; floors <= 15; floors++) {
      const parts = makeTowerParts("complete", floors, "none");
      const counts = [0, 1, 2, 3].map(side => measureTowerOcclusion(side, parts).length);
      const expected = floors < 7 ? [0, 0, 0, 0] : floors < 13 ? [1, 1, 1, 1] : [3, 2, 2, 2];
      expect(counts, `${floors} floors`).toEqual(expected);
    }
  });

  it("casts towards each camera face and counts each occluded address only once", () => {
    for (const turn of [0, 1, 2, 3]) {
      const hidden = measureTowerOcclusion(turn, [tall]);
      expect(hidden.length).toBeGreaterThan(0);
      expect(hidden).toEqual(measureTowerOcclusion(turn - 4, [tall, tall]));
      const opposite = measureTowerOcclusion(turn + 2, [tall]);
      expect(hidden.some(title => opposite.includes(title))).toBe(false);
    }
    expect(measureTowerOcclusion(0, [{ ...tall, position: [0, 0.5, 0], scale: [10, 1, 10] }])).toEqual([]);
  });

  it("tests the rotated box surface rather than the axis-aligned bounds of its original orientation", () => {
    const lot = studyLots[0]!;
    // At y = 1 the overview ray from the lot is at approximately (+0.52, +0.95) in XZ.
    const bar: Part = {
      position: [lot.x - towerCenter.x + 0.52, 1, lot.z - towerCenter.z + 2.5],
      scale: [4, 0.1, 0.18], color: "tan",
    };
    expect(measureTowerOcclusion(0, [bar])).not.toContain(lot.title);
    expect(measureTowerOcclusion(0, [{ ...bar, yaw: Math.PI / 2 }])).toContain(lot.title);
    expect(measureTowerOcclusion(2, [{ ...bar, yaw: Math.PI / 2 }])).not.toContain(lot.title);
  });
});
