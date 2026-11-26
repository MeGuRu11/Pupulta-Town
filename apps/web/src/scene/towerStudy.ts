import { Box3, Matrix4, OrthographicCamera, Quaternion, Ray, Vector3 } from "three";
import { BLOCK_CELLS, CELL_SIZE_M, footprint } from "@pupulta/shared";
import { DEFAULT_ZOOM, frameCityCamera } from "./camera.ts";
import type { SceneLot } from "./model.ts";
import type { Part } from "./Scenery.tsx";
import { BLOCK_PERIOD, STREET_WIDTH } from "./Terrain.tsx";

export const studyBlocks = 3;
const span = studyBlocks * BLOCK_PERIOD + STREET_WIDTH;
export const towerCenter = { x: span / 2, z: span / 2 };

// Row-major house numbers within each block, starting at the upper left. The
// middle block is reserved for the 6-cell tower and the lawn surrounding it.
const neighbourhood = [
  { street: "Берёзовая", numbers: [1, 3, 6, 7, 9] },
  { street: "Садовая", numbers: [1, 2, 4, 7, 9] },
  { street: "Речная", numbers: [1, 3, 7, 8] },
  { street: "Каштановая", numbers: [1, 3, 6, 7, 9] },
  null,
  { street: "Луговая", numbers: [1, 3, 4, 8, 9] },
  { street: "Мельничная", numbers: [1, 3, 7, 9] },
  { street: "Липовая", numbers: [1, 3, 6, 7, 9] },
  { street: "Полевая", numbers: [1, 3, 4, 9] },
];

const houseCells = footprint("M").width;
const houseWidth = houseCells * CELL_SIZE_M;
const housesAcross = BLOCK_CELLS / houseCells;
export const studyLots: SceneLot[] = neighbourhood.flatMap((block, blockIndex) => {
  if (!block) return [];
  const left = (blockIndex % studyBlocks) * BLOCK_PERIOD + STREET_WIDTH;
  const top = Math.floor(blockIndex / studyBlocks) * BLOCK_PERIOD + STREET_WIDTH;
  return block.numbers.map((number): SceneLot => {
    const col = (number - 1) % housesAcross;
    const row = Math.floor((number - 1) / housesAcross);
    const id = `study-${blockIndex}-${number}`;
    return {
      id, taskId: id, title: `${block.street}, ${number}`,
      size: "M", stage: "complete", decay: "none",
      x: left + (col + 0.5) * houseWidth, z: top + (row + 0.5) * houseWidth,
      width: houseWidth, depth: houseWidth,
      rotation: row === 0 ? Math.PI : row === housesAcross - 1 ? 0 : (col === 0 ? -1 : 1) * Math.PI / 2,
    };
  });
});

const unitBox = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
const up = new Vector3(0, 1, 0);

/** Addresses whose ground centre is behind at least one rendered tower part.
 * In an orthographic view every centre has the same ray direction to the camera. */
export function measureTowerOcclusion(rotation: number, parts: readonly Part[]): string[] {
  const camera = new OrthographicCamera();
  // The viewport dimensions affect the frustum, not the parallel sight lines.
  frameCityCamera(camera, 1440, 900, span, rotation, DEFAULT_ZOOM);
  const sightLine = new Ray(new Vector3(), camera.getWorldDirection(new Vector3()).negate());
  const localRay = new Ray();
  const position = new Vector3(), orientation = new Quaternion(), scale = new Vector3();
  const inverseParts = parts.map(part => new Matrix4().compose(
    position.fromArray(part.position),
    orientation.setFromAxisAngle(up, part.yaw ?? 0),
    scale.fromArray(part.scale),
  ).invert());
  return studyLots.filter(lot => {
    sightLine.origin.set(lot.x - towerCenter.x, 0, lot.z - towerCenter.z);
    return inverseParts.some(inverse => localRay.copy(sightLine).applyMatrix4(inverse).intersectsBox(unitBox));
  }).map(lot => lot.title);
}
