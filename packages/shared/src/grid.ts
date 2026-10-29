// Grid rules from decisions 0008 (cell and object sizes) and 0010 (street profile).
// The database uses the same values; the examples in rules-examples.ts keep them in sync.
import type { Cell, CellKind, TaskSize } from "./types.ts";

/** Side of one grid cell in metres. */
export const CELL_SIZE_M = 2;

/** Street width in cells: sidewalk, two road lanes, sidewalk. */
export const STREET_CELLS = 4;

/** Block side in cells between two streets (decision 0011): a multiple of both M (4) and L (6). */
export const BLOCK_CELLS = 12;

/** The street and block pattern repeats every this many cells along each axis. */
export const GRID_PERIOD_CELLS = STREET_CELLS + BLOCK_CELLS;

/** Pedestrian lane of a sidewalk cell, measured from the block edge (0010). */
export const PEDESTRIAN_LANE_M = 1.25;

const FOOTPRINT_CELLS: Record<TaskSize, number> = { S: 1, M: 4, L: 6 };

export const footprint = (size: TaskSize): { width: number; depth: number } => {
  const side = FOOTPRINT_CELLS[size];
  return { width: side, depth: side };
};

type Lane = "lot" | "sidewalk" | "road";

// Position across one axis: street cells 0..3 are sidewalk, road, road, sidewalk.
const laneAt = (coordinate: number): Lane => {
  if (!Number.isInteger(coordinate)) {
    throw new RangeError(`Cell coordinate must be an integer, got ${coordinate}`);
  }
  const local = ((coordinate % GRID_PERIOD_CELLS) + GRID_PERIOD_CELLS) % GRID_PERIOD_CELLS;
  if (local >= STREET_CELLS) return "lot";
  return local === 0 || local === STREET_CELLS - 1 ? "sidewalk" : "road";
};

export const cellKind = ({ x, z }: Cell): CellKind => {
  const alongX = laneAt(x);
  const alongZ = laneAt(z);
  if (alongX === "lot") return alongZ;
  if (alongZ === "lot") return alongX;
  // Intersection square: sidewalk corners, crosswalks on the edges, road in the middle.
  if (alongX === alongZ) return alongX;
  return "crosswalk";
};

export const isStreet = (cell: Cell): boolean => cellKind(cell) !== "lot";
