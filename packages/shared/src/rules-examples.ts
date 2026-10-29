// Shared examples for the grid rules. Vitest checks them against this package,
// and PR 3 checks the same rows against the database functions in pgTAP.
import type { CellKind, TaskSize } from "./types.ts";

export const footprintExamples: ReadonlyArray<{
  size: TaskSize;
  width: number;
  depth: number;
}> = [
  { size: "S", width: 1, depth: 1 },
  { size: "M", width: 4, depth: 4 },
  { size: "L", width: 6, depth: 6 },
];

export const cellKindExamples: ReadonlyArray<{ x: number; z: number; kind: CellKind }> = [
  // A street running along z, crossing a block row.
  { x: 0, z: 8, kind: "sidewalk" },
  { x: 1, z: 8, kind: "road" },
  { x: 2, z: 8, kind: "road" },
  { x: 3, z: 8, kind: "sidewalk" },
  // Block cells, from the first to the last one before the next street.
  { x: 4, z: 8, kind: "lot" },
  { x: 8, z: 8, kind: "lot" },
  { x: 15, z: 15, kind: "lot" },
  // The next street repeats the profile.
  { x: 16, z: 8, kind: "sidewalk" },
  { x: 17, z: 8, kind: "road" },
  { x: 19, z: 8, kind: "sidewalk" },
  // A street running along x.
  { x: 8, z: 0, kind: "sidewalk" },
  { x: 8, z: 1, kind: "road" },
  { x: 8, z: 3, kind: "sidewalk" },
  // Intersection: corners, crosswalks on the edges, plain road in the middle.
  { x: 0, z: 0, kind: "sidewalk" },
  { x: 3, z: 3, kind: "sidewalk" },
  { x: 1, z: 0, kind: "crosswalk" },
  { x: 0, z: 2, kind: "crosswalk" },
  { x: 3, z: 1, kind: "crosswalk" },
  { x: 1, z: 1, kind: "road" },
  { x: 2, z: 2, kind: "road" },
  // Negative coordinates follow the same period.
  { x: -1, z: 8, kind: "lot" },
  { x: -13, z: 8, kind: "sidewalk" },
  { x: -16, z: -15, kind: "crosswalk" },
];
