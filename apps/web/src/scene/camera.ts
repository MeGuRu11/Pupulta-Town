import { type OrthographicCamera, Vector3 } from "three";

export const MIN_ZOOM = 0.72;
export const DEFAULT_ZOOM = 1;
export const MAX_ZOOM = 2;

export function limitZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

export function frameCityCamera(
  camera: OrthographicCamera, width: number, height: number, span: number, rotation: number, zoom: number,
) {
  const angle = Math.PI * (0.16 + rotation / 2);
  const range = span * 2 + 20;
  camera.position.set(span / 2 + range * Math.sin(angle), range * 0.93, span / 2 + range * Math.cos(angle));
  camera.lookAt(span / 2, 1.3, span / 2);
  camera.updateMatrixWorld(true);

  // Fit the projected board into the area between the HUD bars. On a phone the
  // available width, rather than the height of the canvas, determines the scale.
  const sideMargin = Math.min(48, width * 0.075);
  const barMargin = Math.min(114, height * 0.22);
  const point = new Vector3();
  let unitsPerPixel = 0;
  for (const x of [0, span]) for (const z of [0, span]) for (const y of [-1.5, 7]) {
    point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    unitsPerPixel = Math.max(unitsPerPixel,
      Math.abs(point.x) / (width / 2 - sideMargin),
      Math.abs(point.y) / (height / 2 - barMargin),
    );
  }
  camera.right = unitsPerPixel * width / 2;
  camera.left = -camera.right;
  camera.top = unitsPerPixel * height / 2;
  camera.bottom = -camera.top;
  camera.zoom = limitZoom(zoom);
  camera.near = 0.1;
  camera.far = range * 4;
  camera.updateProjectionMatrix();
}
