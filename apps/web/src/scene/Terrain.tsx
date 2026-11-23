import { useEffect, useMemo } from "react";
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";
import { BLOCK_CELLS, CELL_SIZE_M, GRID_PERIOD_CELLS, STREET_CELLS, cellKind } from "@pupulta/shared";
import { Scenery, type Part } from "./Scenery.tsx";

export const BLOCK_PERIOD = GRID_PERIOD_CELLS * CELL_SIZE_M;
export const STREET_WIDTH = STREET_CELLS * CELL_SIZE_M;
const blockWidth = BLOCK_CELLS * CELL_SIZE_M;

const paints = {
  road: 0x57616a,
  lane: 0xe5ca83,
  zebra: 0xf3e9cf,
  stone: 0xddd1b4,
  seam: 0xc5b99d,
  kerb: 0xf2e4c6,
  lawn: 0xa2bc86,
  grass: 0xa8c08a,
  border: 0x90a779,
};

// Repeating grid texture keeps the full ground visible for large cities with a single draw.
function groundTexture(span: number) {
  const pixels = 256;
  const bytes = new Uint8Array(pixels * pixels * 4);
  for (let j = 0; j < pixels; j++) {
    for (let i = 0; i < pixels; i++) {
      const x = ((i + 0.5) * BLOCK_PERIOD) / pixels;
      const z = ((j + 0.5) * BLOCK_PERIOD) / pixels;
      const cx = Math.floor(x / CELL_SIZE_M);
      const cz = Math.floor(z / CELL_SIZE_M);
      const kind = cellKind({ x: cx, z: cz });
      let ink: number;
      if (kind === "lot") {
        ink = (cx + cz) % 2 ? paints.lawn : paints.grass;
        if (Math.min(x - STREET_WIDTH, z - STREET_WIDTH, BLOCK_PERIOD - x, BLOCK_PERIOD - z) < 0.22)
          ink = paints.border;
      } else if (kind === "sidewalk") {
        const nearRoad = (v: number) =>
          Math.abs(v - CELL_SIZE_M) < 0.17 || Math.abs(v - (STREET_WIDTH - CELL_SIZE_M)) < 0.17;
        ink =
          nearRoad(x) || nearRoad(z)
            ? paints.kerb
            : x % CELL_SIZE_M < 0.09 || z % CELL_SIZE_M < 0.09
              ? paints.seam
              : paints.stone;
      } else if (kind === "crosswalk") {
        const crossesZ = cx === 0 || cx === STREET_CELLS - 1;
        const across = crossesZ ? x : z;
        const along = crossesZ ? z : x;
        ink =
          across % CELL_SIZE_M > 0.36 && across % CELL_SIZE_M < 1.64 && along % 0.8 < 0.36
            ? paints.zebra
            : paints.road;
      } else {
        const mid = STREET_WIDTH / 2;
        const stripe = (v: number, along: number) =>
          Math.abs(v - mid) < 0.12 &&
          along >= STREET_WIDTH + 1 &&
          along < BLOCK_PERIOD - 1 &&
          along % 4 < 2.2;
        ink = stripe(x, z) || stripe(z, x) ? paints.lane : paints.road;
      }
      const offset = (j * pixels + i) * 4;
      bytes[offset] = ink >> 16;
      bytes[offset + 1] = (ink >> 8) & 255;
      bytes[offset + 2] = ink & 255;
      bytes[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(bytes, pixels, pixels);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.repeat.set(span / BLOCK_PERIOD, -span / BLOCK_PERIOD);
  texture.offset.y = span / BLOCK_PERIOD;
  texture.needsUpdate = true;
  return texture;
}

function streetFurniture(blocks: number, seed: number) {
  const boxes: Part[] = [],
    crowns: Part[] = [];
  // When a city covers many blocks, distribute the landmark trees across the board.
  const stride = Math.max(1, Math.ceil(blocks / 16));
  for (let bz = 0; bz < blocks; bz += stride) {
    for (let bx = 0; bx < blocks; bx += stride) {
      const x = bx * BLOCK_PERIOD + STREET_WIDTH;
      const z = bz * BLOCK_PERIOD + STREET_WIDTH;
      const variation = (Math.imul(bx + 1, 67) ^ Math.imul(bz + 1, 109) ^ seed) >>> 0;
      const offset = blockWidth * (0.25 + (variation % 5) * 0.09);
      const treeX = x + offset,
        treeZ = z - 1.58;
      boxes.push({ position: [treeX, 0.54, treeZ], scale: [0.23, 1.08, 0.23], color: "#95694a" });
      crowns.push({
        position: [treeX, 1.78, treeZ],
        scale: [1.75, 2.1, 1.65],
        color: variation % 2 ? "#67945d" : "#739865",
        yaw: variation % 6,
      });
      const lampX = x - 1.58,
        lampZ = z + blockWidth - offset;
      boxes.push(
        { position: [lampX, 1.15, lampZ], scale: [0.14, 2.3, 0.14], color: "#4d5861" },
        { position: [lampX, 2.46, lampZ], scale: [0.4, 0.38, 0.4], color: "#ffdf92" },
        { position: [lampX, 2.71, lampZ], scale: [0.48, 0.13, 0.48], color: "#505c62" },
      );
    }
  }
  return { boxes, crowns };
}

export function Terrain({ blocks, seed }: { blocks: number; seed: number }) {
  const span = blocks * BLOCK_PERIOD + STREET_WIDTH;
  const texture = useMemo(() => groundTexture(span), [span]);
  useEffect(() => () => texture.dispose(), [texture]);
  const furniture = useMemo(() => streetFurniture(blocks, seed), [blocks, seed]);
  return (
    <>
      <mesh position={[span / 2, -0.74, span / 2]}>
        <boxGeometry args={[span, 1.46, span]} />
        <meshStandardMaterial color="#9c8874" roughness={1} />
      </mesh>
      <mesh position={[span / 2, 0.005, span / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[span, span]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <Scenery parts={furniture.boxes} />
      <Scenery parts={furniture.crowns} shape="crown" />
    </>
  );
}
