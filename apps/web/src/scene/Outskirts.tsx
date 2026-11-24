import { useMemo } from "react";
import { Color } from "three";
import { createRandom } from "@pupulta/sim";
import { Scenery, type Part, type Point } from "./Scenery.tsx";

// A seeded woodland verge frames the playable streets. Its geometry stays bounded
// even when distant lots expand the city's board.
function buildVerge(span: number, seed: number) {
  const random = createRandom(seed);
  const positions: number[] = [], colors: number[] = [];
  const foliage: Part[] = [], trunks: Part[] = [], rocks: Part[] = [];
  const palette = ["#556343", "#476447", "#65764a", "#586e50", "#877843"];
  const sides = Math.min(128, 4 * Math.ceil(span / 3));
  const half = span / 2;
  const inner: Point[] = [], bank: Point[] = [], foot: Point[] = [];
  const color = new Color();

  function face(a: Point, b: Point, c: Point, ink: string) {
    positions.push(...a, ...b, ...c);
    color.set(ink).multiplyScalar(0.9 + random() * 0.15);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  }

  for (let i = 0; i < sides; i++) {
    // Start at a board corner; all four corners fall on exact segment boundaries.
    const angle = Math.PI / 4 + 2 * Math.PI * i / sides;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const edge = half / Math.max(Math.abs(dx), Math.abs(dz));
    const depth = 3.6 + random() * 3;
    inner.push([half + edge * dx, -0.45, half + edge * dz]);
    bank.push([half + (edge + depth) * dx, -0.7 - random() * 0.9, half + (edge + depth) * dz]);
    foot.push([half + (edge + depth + 0.6) * dx, -2.7 - random(), half + (edge + depth + 0.6) * dz]);

    const radius = edge + 1.9 + random() * (depth - 2.4);
    const x = half + radius * dx, z = half + radius * dz;
    if (random() < 0.65) {
      const height = 2.5 + random() * 2;
      const width = 1.45 + random() * 0.85;
      const treeColor = palette[Math.floor(random() * palette.length)]!;
      trunks.push({ position: [x, -0.4, z], scale: [0.34, 1.7, 0.32], color: "#755f44" });
      foliage.push({ position: [x, height / 2 - 0.3, z], scale: [width, height, width], yaw: angle, color: treeColor });
    } else if (random() < 0.7) {
      rocks.push({ position: [x, -0.76, z], scale: [1.65 + random(), 1 + random(), 1.7], yaw: angle, color: "#767967" });
    }
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    face(inner[i]!, inner[j]!, bank[i]!, "#62704e");
    face(inner[j]!, bank[j]!, bank[i]!, "#5d674b");
    face(bank[i]!, bank[j]!, foot[i]!, "#645f4e");
    face(bank[j]!, foot[j]!, foot[i]!, "#544f43");
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), foliage, trunks, rocks };
}

export function Outskirts({ span, seed }: { span: number; seed: number }) {
  const verge = useMemo(() => buildVerge(span, seed), [span, seed]);
  return <>
    <mesh>
      <bufferGeometry key={`${span}:${seed}`} onUpdate={geometry => geometry.computeVertexNormals()}>
        <bufferAttribute attach="attributes-position" args={[verge.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[verge.colors, 3]} />
      </bufferGeometry>
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </mesh>
    <Scenery parts={verge.trunks} />
    <Scenery parts={verge.foliage} shape="crown" />
    <Scenery parts={verge.rocks} shape="crown" />
  </>;
}
