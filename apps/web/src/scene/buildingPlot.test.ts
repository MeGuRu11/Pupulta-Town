import { describe, expect, it } from "vitest";
import { makeBuildings } from "./Buildings.tsx";
import type { SceneLot } from "./model.ts";
import type { Part } from "./Scenery.tsx";

const origin = { x: -32, z: 64 };
function lot(size: SceneLot["size"], stage: SceneLot["stage"], rotation: number): SceneLot {
  const side = size === "S" ? 2 : 8;
  return { id: "lot", taskId: "task", title: "", decay: "none", x: -20, z: 76,
    size, stage, rotation, width: side, depth: side };
}

function worldBounds(part: Part) {
  const cos = Math.abs(Math.cos(part.yaw ?? 0)), sin = Math.abs(Math.sin(part.yaw ?? 0));
  const [width, , depth] = part.scale;
  const halfX = (cos * width + sin * depth) / 2, halfZ = (sin * width + cos * depth) / 2;
  return {
    left: part.position[0] - halfX, right: part.position[0] + halfX,
    back: part.position[2] - halfZ, front: part.position[2] + halfZ,
  };
}

describe.each(["S", "M"] as const)("structures on a %s plot", size => {
  it.each(["foundation", "construction", "complete"] as const)("preserves a yard around the %s and keeps ground finishes on its lot", stage => {
    for (const rotation of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      const plot = lot(size, stage, rotation);
      const { boxes, roofs } = makeBuildings([plot], origin);
      for (const part of [...boxes, ...roofs]) {
        // Ground treatments can reach a neighbour. Everything above paving height must be set back.
        const abovePaving = part.position[1] + part.scale[1] / 2 > 0.07;
        const setback = abovePaving ? (size === "S" ? 0.3 : 1.2) : 0;
        const half = plot.width / 2 - setback + 1e-8;
        const x = plot.x - origin.x, z = plot.z - origin.z;
        const bounds = worldBounds(part);
        expect(bounds.left).toBeGreaterThanOrEqual(x - half);
        expect(bounds.right).toBeLessThanOrEqual(x + half);
        expect(bounds.back).toBeGreaterThanOrEqual(z - half);
        expect(bounds.front).toBeLessThanOrEqual(z + half);
      }
    }
  });

  it("paves an approach from the finished building to the edge facing its door or counter", () => {
    const cosines = [1, 0, -1, 0], sines = [0, 1, 0, -1];
    for (const [turn, sin] of sines.entries()) {
      const plot = lot(size, "complete", turn * Math.PI / 2);
      const { boxes } = makeBuildings([plot], origin);
      const x = plot.x - origin.x, z = plot.z - origin.z;
      const cos = cosines[turn]!;
      const setback = size === "S" ? 0.3 : 1.2;
      const width = size === "S" ? 1 : 1.2;
      const reachesFacade = boxes.some(part => {
        const dx = part.position[0] - x, dz = part.position[2] - z;
        const along = dx * sin + dz * cos, across = dx * cos - dz * sin;
        return Math.abs(across) < 1e-8 && Math.abs(part.scale[0] - width) < 1e-8
          && part.position[1] + part.scale[1] / 2 <= 0.07
          && Math.abs(along + part.scale[2] / 2 - plot.depth / 2) < 1e-8
          && along - part.scale[2] / 2 <= plot.depth / 2 - setback + 1e-8;
      });
      expect(reachesFacade).toBe(true);
    }
  });
});
