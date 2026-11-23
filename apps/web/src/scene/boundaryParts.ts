import type { Part } from "./Scenery.tsx";
import type { LotBoundary } from "./lotBoundaries.ts";

export function boundaryParts(edges: readonly LotBoundary[], origin: { x: number; z: number }): Part[] {
  const parts: Part[] = [];
  for (const edge of edges) {
    const alongX = edge.axis === "x";
    const offset = alongX ? origin.x : origin.z;
    const fixed = edge.fixed - (alongX ? origin.z : origin.x);
    function box(at: number, y: number, length: number, height: number, thickness: number, color: string) {
      parts.push({
        position: alongX ? [at, y, fixed] : [fixed, y, at],
        scale: alongX ? [length, height, thickness] : [thickness, height, length],
        color,
      });
    }

    const start = edge.start - offset;
    const end = edge.end - offset;
    if (edge.kind === "paving") {
      box((start + end) / 2, 0.04, end - start, 0.06, 0.4, "#d1c4ac");
      continue;
    }

    function barrier(from: number, to: number) {
      // Set the ends back from gates and corners where two boundaries meet.
      const left = from + 0.08, right = to - 0.08;
      const span = right - left;
      if (span < 0.14) return;
      const middle = (left + right) / 2;
      if (edge.kind === "hedge") {
        box(middle, 0.13, span, 0.22, 0.33, "#8e7454");
        const bushes = Math.ceil(span / 0.72);
        const length = span / bushes;
        for (let i = 0; i < bushes; i++) {
          const height = i % 2 ? 0.69 : 0.78;
          box(left + (i + 0.5) * length, 0.19 + height / 2, length - 0.035,
            height, 0.44, i % 2 ? "#648454" : "#70945e");
        }
        return;
      }

      if (edge.kind === "works") {
        const footLength = Math.min(0.24, span / 2);
        for (const at of [left + footLength / 2, right - footLength / 2]) {
          box(at, 0.12, footLength, 0.19, 0.38, "#7b7770");
          box(at, 0.54, Math.min(footLength, 0.11), 0.95, 0.11, "#665f59");
        }
        const stripes = Math.ceil(span / 0.45);
        const width = span / stripes;
        for (let i = 0; i < stripes; i++) {
          box(left + (i + 0.5) * width, 0.78, width, 0.38, 0.16, i % 2 ? "#ffdfa0" : "#b35637");
        }
        return;
      }

      for (const y of [0.34, 0.73]) box(middle, y, span, 0.14, 0.1, "#9c7051");
      const intervals = Math.max(1, Math.ceil((span - 0.14) / 1.15));
      for (let i = 0; i <= intervals; i++) {
        const at = left + 0.07 + i * (span - 0.14) / intervals;
        box(at, 0.51, 0.14, 1.0, 0.17, "#805a42");
      }
    }

    let cursor = start;
    for (const opening of edge.openings) {
      barrier(cursor, opening.start - offset);
      cursor = opening.end - offset;
    }
    barrier(cursor, end);
  }
  return parts;
}
