import { plotDimensions, type SceneLot } from "./model.ts";

interface Interval {
  start: number;
  end: number;
}

export interface LotBoundary extends Interval {
  /** Axis along the segment; fixed is its coordinate on the other axis, in world metres. */
  axis: "x" | "z";
  fixed: number;
  kind: "fence" | "hedge" | "paving" | "works";
  openings: Interval[];
}

interface Edge extends Interval {
  lot: SceneLot;
  entrance?: Interval;
}

function boundaryKind(a: SceneLot, b: SceneLot): LotBoundary["kind"] {
  if (a.stage !== "complete" || b.stage !== "complete") return "works";
  if (a.size !== b.size) return "hedge";
  return a.size === "M" ? "fence" : "paving";
}

function sharedOpenings(a: Edge, b: Edge, start: number, end: number): Interval[] {
  const openings: Interval[] = [];
  for (const door of [a.entrance, b.entrance]) {
    if (door && door.start < end && door.end > start)
      openings.push({ start: Math.max(start, door.start), end: Math.min(end, door.end) });
  }
  openings.sort((left, right) => left.start - right.start);
  const [first, second] = openings;
  if (first && second && first.end >= second.start)
    return [{ start: first.start, end: Math.max(first.end, second.end) }];
  return openings;
}

export function makeLotBoundaries(lots: readonly SceneLot[]): LotBoundary[] {
  const result: LotBoundary[] = [];
  for (const axis of ["x", "z"] as const) {
    const lines = new Map<number, { low: Edge[]; high: Edge[] }>();
    for (const lot of lots) {
      const along = lot[axis];
      const across = axis === "x" ? lot.z : lot.x;
      const halfAlong = (axis === "x" ? lot.width : lot.depth) / 2;
      const halfAcross = (axis === "x" ? lot.depth : lot.width) / 2;
      // The facade points along local +Z. Rotations stored by the city are quarter turns.
      const facing = Math.round(axis === "x" ? Math.cos(lot.rotation) : Math.sin(lot.rotation));
      for (const sign of [-1, 1]) {
        const fixed = across + sign * halfAcross;
        let line = lines.get(fixed);
        if (!line) {
          line = { low: [], high: [] };
          lines.set(fixed, line);
        }
        const edge: Edge = { lot, start: along - halfAlong, end: along + halfAlong };
        if (facing === sign) {
          const halfGate = plotDimensions[lot.size].entranceWidth / 2;
          edge.entrance = { start: along - halfGate, end: along + halfGate };
        }
        line[sign < 0 ? "low" : "high"].push(edge);
      }
    }

    for (const fixed of [...lines.keys()].sort((a, b) => a - b)) {
      const { low, high } = lines.get(fixed)!;
      low.sort((a, b) => a.start - b.start);
      high.sort((a, b) => a.start - b.start);
      // Allocated lots do not overlap. Sweep their opposite edges once on each grid line.
      let i = 0, j = 0;
      while (i < low.length && j < high.length) {
        const a = low[i]!, b = high[j]!;
        const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end);
        if (start < end) {
          result.push({
            axis, fixed, start, end, kind: boundaryKind(a.lot, b.lot),
            openings: sharedOpenings(a, b, start, end),
          });
        }
        if (a.end <= b.end) i++;
        if (b.end <= a.end) j++;
      }
    }
  }
  return result;
}
