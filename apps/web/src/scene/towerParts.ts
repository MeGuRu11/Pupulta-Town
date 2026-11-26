import type { Part, Point } from "./Scenery.tsx";
import type { SceneLot } from "./model.ts";

export type TowerStage = SceneLot["stage"];
export type TowerDecay = Extract<SceneLot["decay"], "none" | "dirt" | "graffiti" | "defect">;

const floorHeight = 3;
const facade = 4.45;
const sides = [0, 1, 2, 3] as const;

export function makeTowerParts(stage: TowerStage, floors: number, decay: TowerDecay): Part[] {
  const parts: Part[] = [];
  const count = Number.isFinite(floors) ? Math.max(1, Math.min(15, Math.floor(floors))) : 1;
  const roofY = count * floorHeight;
  const box = (position: Point, scale: Point, color: string) => parts.push({ position, scale, color });
  // Place an upright box in wall coordinates. Positive depth points out of the building.
  const onWall = (side: number, across: number, y: number, depth: number, scale: Point, color: string) => {
    switch (side) {
      case 0: return box([across, y, depth], scale, color);
      case 1: return box([depth, y, -across], [scale[2], scale[1], scale[0]], color);
      case 2: return box([-across, y, -depth], scale, color);
      default: return box([-depth, y, across], [scale[2], scale[1], scale[0]], color);
    }
  };

  box([0, 0.04, 0], [12, 0.08, 12], stage === "complete" ? "#aca990" : "#b49473");
  box([0, 0.18, 0], [9.3, 0.28, 9.3], "#b1a692");

  if (stage === "foundation") {
    for (const side of sides) {
      onWall(side, 0, 0.64, 4.25, [8.9, 0.86, 0.4], "#af7958");
      for (const across of [-3.65, 0, 3.65]) {
        onWall(side, across, 0.97, 3.95, [0.18, 1.5, 0.18], "#625d58");
      }
    }
    box([-1.2, 0.42, -0.9], [2.3, 0.22, 4.2], "#cead77");
  } else if (stage === "construction") {
    box([-1.6, roofY / 2, -0.7], [2, roofY, 2.7], "#8c8d81");
    for (let level = 0; level < count; level++) {
      const base = level * floorHeight;
      for (const side of sides) {
        onWall(side, 3.85, base + 1.5, 3.85, [0.65, 3, 0.65], "#bbac93");
        onWall(side, -4.45, base + 1.5, 4.45, [0.22, 3, 0.22], "#965e3e");
        onWall(side, 0, base + 1.08, 4.45, [9.1, 0.17, 0.2], "#e3ad59");
      }
      box([0, base + 2.84, 0], [9.2, 0.32, 9.2], "#b7ac97");
    }
    for (const side of sides) {
      onWall(side, 0, roofY + 0.39, 4.30, [8.9, 0.8, 0.30], "#dc9b4c");
    }
    box([-1.6, roofY + 0.56, -0.7], [2, 1.12, 2.7], "#96978b");
  } else {
    for (let level = 0; level < count; level++) {
      const base = level * floorHeight;
      box([0, base + 1.5, 0], [facade * 2, floorHeight, facade * 2], level === 0 ? "#b16f52" : "#e3be87");
      box([0, base + 2.85, 0], [9.15, 0.3, 9.15], "#f0d5a5");
      for (const side of sides) {
        for (const bay of [-2.6, 0, 2.6]) {
          const entry = level === 0 && side === 0 && bay === 0;
          const y = entry ? 1.16 : base + 1.55;
          const height = entry ? 2.3 : 1.45;
          onWall(side, bay, y, facade, [1.85, height, 0.17], entry ? "#644944" : "#496969");
          onWall(side, bay, y + 0.1, facade + 0.09, [1.43, height * 0.67, 0.08], "#89aba3");
        }
        // A continuous terracotta pier links the repeated storeys to the roof.
        onWall(side, -3.84, base + 1.5, facade + 0.07, [0.45, 3, 0.25], "#b66c50");
      }
    }
    box([0, 0.14, 5.2], [2.65, 0.23, 1.6], "#d9c9a6");
    box([0, 2.48, 4.94], [3.5, 0.34, 1.35], "#39716b");
    box([0, roofY + 0.18, 0], [9.45, 0.36, 9.45], "#4d7772");
    box([0, roofY + 0.43, 0], [8.75, 0.18, 8.75], "#82a29a");
    box([-0.9, roofY + 0.94, -0.7], [3.4, 0.84, 2.7], "#dfba89");
    box([-0.9, roofY + 1.46, -0.7], [3.75, 0.2, 3], "#46716d");
  }

  if (decay !== "none") {
    // Keep marks on the highest built wall so that low neighbours do not hide them.
    const bandY = stage === "foundation" ? 0.24 : stage === "construction" ? roofY + 0.03 : roofY - 2.64;
    const h = stage === "complete" ? 2.2 : 0.72;
    const depth = stage === "complete" ? facade + 0.19 : facade + 0.02;
    for (const side of sides) {
      const mark = (x: number, y: number, w: number, height: number, color: string) =>
        onWall(side, x, bandY + y * h, depth, [w, height * h, 0.12], color);
      if (decay === "dirt") {
        mark(0.65, 0.76, 4.1, 0.42, "#7a6444");
        mark(-0.61, 0.33, 0.92, 0.44, "#4e4030");
        mark(1.47, 0.40, 1.25, 0.30, "#7a6444");
      } else if (decay === "graffiti") {
        mark(-0.85, 0.7, 2.5, 0.28, "#e53fd0");
        mark(0.04, 0.49, 0.72, 0.14, "#e53fd0");
        mark(1.17, 0.27, 3, 0.30, "#e53fd0");
        mark(2.34, 0.57, 0.68, 0.30, "#9be83a");
      } else {
        mark(0.55, 0.65, 2.45, 0.50, "#2b2522");
        mark(1.07, 0.29, 1.36, 0.22, "#4e4030");
        mark(1.75, 0.12, 0.73, 0.12, "#9a4a21");
      }
    }
  }
  return parts;
}
