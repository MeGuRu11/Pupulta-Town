// Residents walking the sidewalks. A position is a closed-form function of the seed
// and the time, so any frame costs the same and does not depend on earlier frames.
import {
  BLOCK_CELLS,
  CELL_SIZE_M,
  GRID_PERIOD_CELLS,
  PEDESTRIAN_LANE_M,
  STREET_CELLS,
} from "@pupulta/shared";
import { createRandom } from "./random.ts";

export const MIN_RESIDENT_SPEED_MPS = 1.0;
export const MAX_RESIDENT_SPEED_MPS = 1.6;

export interface SimulateOptions {
  /** The city is `blocks × blocks` blocks, starting at cell (0, 0). */
  blocks?: number;
  residents?: number;
}

export interface ResidentPosition {
  id: number;
  /** World position in metres on the ground plane. */
  x: number;
  z: number;
  /** Facing angle around the Y axis in radians; 0 faces +x, π/2 faces +z. */
  heading: number;
}

// Residents walk in the middle of the pedestrian lane, which runs along the block edge.
const LANE_OFFSET_M = PEDESTRIAN_LANE_M / 2;
const LOOP_SIDE_M = BLOCK_CELLS * CELL_SIZE_M + 2 * LANE_OFFSET_M;
const LOOP_LENGTH_M = 4 * LOOP_SIDE_M;

interface Resident {
  originX: number;
  originZ: number;
  speed: number;
  phase: number;
  reverse: boolean;
}

const createResident = (next: () => number, blocks: number): Resident => {
  const block = Math.floor(next() * blocks * blocks);
  const blockStart = (index: number) => (index * GRID_PERIOD_CELLS + STREET_CELLS) * CELL_SIZE_M;
  return {
    originX: blockStart(block % blocks) - LANE_OFFSET_M,
    originZ: blockStart(Math.floor(block / blocks)) - LANE_OFFSET_M,
    speed: MIN_RESIDENT_SPEED_MPS + next() * (MAX_RESIDENT_SPEED_MPS - MIN_RESIDENT_SPEED_MPS),
    phase: next() * LOOP_LENGTH_M,
    reverse: next() < 0.5,
  };
};

// Point at `distance` metres along the loop around the block: +x, +z, −x, −z.
const pointOnLoop = (distance: number): { x: number; z: number; heading: number } => {
  const side = Math.floor(distance / LOOP_SIDE_M);
  const along = distance - side * LOOP_SIDE_M;
  switch (side) {
    case 0:
      return { x: along, z: 0, heading: 0 };
    case 1:
      return { x: LOOP_SIDE_M, z: along, heading: Math.PI / 2 };
    case 2:
      return { x: LOOP_SIDE_M - along, z: LOOP_SIDE_M, heading: Math.PI };
    default:
      return { x: 0, z: LOOP_SIDE_M - along, heading: -Math.PI / 2 };
  }
};

const positionAt = (resident: Resident, timeMs: number): Omit<ResidentPosition, "id"> => {
  const travelled = resident.phase + (resident.speed * timeMs) / 1000;
  const forward = ((travelled % LOOP_LENGTH_M) + LOOP_LENGTH_M) % LOOP_LENGTH_M;
  const distance = resident.reverse ? LOOP_LENGTH_M - forward : forward;
  const point = pointOnLoop(distance % LOOP_LENGTH_M);
  const heading = resident.reverse ? point.heading + Math.PI : point.heading;
  return { x: resident.originX + point.x, z: resident.originZ + point.z, heading };
};

/**
 * Positions of the residents at `timeMs` (Unix milliseconds).
 * The same seed and time always give the same picture.
 */
export const simulate = (
  seed: number,
  timeMs: number,
  { blocks = 3, residents = 30 }: SimulateOptions = {},
): ResidentPosition[] => {
  const next = createRandom(seed);
  return Array.from({ length: residents }, (_, id) => ({
    id,
    ...positionAt(createResident(next, blocks), timeMs),
  }));
};
