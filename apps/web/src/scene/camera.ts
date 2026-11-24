import type { OrthographicCamera } from "three";

export const MIN_ZOOM = 0.72;
export const DEFAULT_ZOOM = 1;
export const MAX_ZOOM = 2;

export function limitZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

interface Turn { rotation: number; velocity: number }

/** Exact critically damped spring, in quarter-turns and seconds. Carry the
 * velocity across input changes so an interrupted turn never resets the camera. */
export function advanceCameraTurn(current: Turn, target: number, seconds: number): Turn {
  const rate = 14;
  const offset = current.rotation - target;
  const impulse = current.velocity + rate * offset;
  const decay = Math.exp(-rate * seconds);
  const remaining = (offset + impulse * seconds) * decay;
  const velocity = (current.velocity - rate * impulse * seconds) * decay;
  if (Math.abs(remaining) < 0.0004 && Math.abs(velocity) < 0.006) return { rotation: target, velocity: 0 };
  return { rotation: target + remaining, velocity };
}

export function frameCityCamera(
  camera: OrthographicCamera, width: number, height: number, span: number, rotation: number, zoom: number,
) {
  const homeAngle = Math.PI * 0.16;
  const angle = homeAngle + (rotation % 4) * Math.PI / 2;
  const range = span * 2 + 20;
  camera.position.set(span / 2 + range * Math.sin(angle), range * 0.93, span / 2 + range * Math.cos(angle));
  camera.lookAt(span / 2, 1.3, span / 2);
  camera.updateMatrixWorld(true);

  // Fit the projected board into the area between the HUD bars. On a phone the
  // available width, rather than the height of the canvas, determines the scale.
  const sideMargin = Math.min(48, width * 0.075);
  const barMargin = Math.min(114, height * 0.22);
  // Size the frustum for the settled view once per geometry, independently of
  // the current angle. Refitting at every intermediate angle pumps the zoom.
  const halfWidth = span / 2 * (Math.sin(homeAngle) + Math.cos(homeAngle));
  const pitch = Math.atan2(range * 0.93 - 1.3, range);
  const halfHeight = halfWidth * Math.sin(pitch) + (7 - 1.3) * Math.cos(pitch);
  const unitsPerPixel = Math.max(halfWidth / (width / 2 - sideMargin), halfHeight / (height / 2 - barMargin));
  camera.right = unitsPerPixel * width / 2;
  camera.left = -camera.right;
  camera.top = unitsPerPixel * height / 2;
  camera.bottom = -camera.top;
  camera.zoom = limitZoom(zoom);
  camera.near = 0.1;
  camera.far = range * 4;
  camera.updateProjectionMatrix();
}
