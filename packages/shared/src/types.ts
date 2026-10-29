// Domain types shared by the client, the simulation and the database tests.

export type Role = "leader" | "member" | "guest";

export type TaskSize = "S" | "M" | "L";

export type TaskStatus = "todo" | "in_progress" | "done";

export type DecayStage = "none" | "dirt" | "graffiti" | "defect" | "repair" | "fire";

/** Grid cell coordinates: integers, x and z on the ground plane (Y is up). */
export interface Cell {
  x: number;
  z: number;
}

export type CellKind = "lot" | "sidewalk" | "road" | "crosswalk";
