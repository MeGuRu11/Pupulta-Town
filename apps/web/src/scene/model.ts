import { CELL_SIZE_M, DECAY_DAY_UTC_OFFSET_MINUTES, footprint, GRID_PERIOD_CELLS, type DecayStage } from "@pupulta/shared";
import { getTaskDecay } from "../tracker/model.ts";
import type { CityData, CityObject, TeamTask } from "../tracker/types.ts";

export interface SceneLot {
  id: string;
  taskId: string;
  title: string;
  size: "S" | "M";
  stage: CityObject["stage"];
  decay: DecayStage;
  /** Footprint centre and side lengths in world metres. */
  x: number;
  z: number;
  width: number;
  depth: number;
  /** Rotation about the vertical axis in radians. */
  rotation: number;
}

/** Wall-to-lot reserve and clear entrance width, both in metres. */
export const plotDimensions = {
  S: { setback: 0.3, entranceWidth: 1 },
  M: { setback: 1.2, entranceWidth: 1.2 },
} as const;

const dayMs = 24 * 60 * 60 * 1000;
const decayOffsetMs = DECAY_DAY_UTC_OFFSET_MINUTES * 60 * 1000;

/** Building decay can change during a Moscow calendar day only when a task closes. */
export function sceneDecayTime(tasks: readonly TeamTask[], nowMs: number): number {
  let time = Math.floor((nowMs + decayOffsetMs) / dayMs) * dayMs - decayOffsetMs;
  for (const task of tasks) {
    if (task.closed_at === null) continue;
    const closedAt = Date.parse(task.closed_at);
    if (closedAt > time && closedAt <= nowMs) time = closedAt;
  }
  return time;
}

export function makeSceneLots(data: CityData, nowMs: number): SceneLot[] {
  const tasks = new Map(data.tasks.map(task => [task.id, task]));
  const lots: SceneLot[] = [];
  for (const object of data.objects) {
    const task = tasks.get(object.task_id);
    // Independent table reads can straddle a transaction. A later refresh joins the pair.
    if (!task || task.city_id !== object.city_id || object.size === "L") continue;
    const cells = footprint(object.size);
    const width = cells.width * CELL_SIZE_M;
    const depth = cells.depth * CELL_SIZE_M;
    lots.push({
      id: object.id, taskId: task.id, title: task.title, size: object.size,
      stage: object.stage, decay: getTaskDecay(task, nowMs),
      x: object.cell_x * CELL_SIZE_M + width / 2,
      z: object.cell_z * CELL_SIZE_M + depth / 2,
      width, depth, rotation: object.rotation * Math.PI / 180,
    });
  }
  return lots;
}

const periodM = GRID_PERIOD_CELLS * CELL_SIZE_M;

/** Align the visible grid with database cells even when a city spans signed coordinates. */
export function sceneOrigin(lots: readonly SceneLot[]): { x: number; z: number } {
  if (!lots.length) return { x: 0, z: 0 };
  let minX = Infinity;
  let minZ = Infinity;
  for (const lot of lots) {
    minX = Math.min(minX, lot.x - lot.width / 2);
    minZ = Math.min(minZ, lot.z - lot.depth / 2);
  }
  return { x: Math.floor(minX / periodM) * periodM, z: Math.floor(minZ / periodM) * periodM };
}

/** Number of whole blocks along the square board, with the far lot edges included. */
export function sceneBlocks(lots: readonly SceneLot[]): number {
  const origin = sceneOrigin(lots);
  let span = periodM;
  for (const lot of lots) {
    span = Math.max(span, lot.x + lot.width / 2 - origin.x, lot.z + lot.depth / 2 - origin.z);
  }
  return Math.ceil(span / periodM);
}
