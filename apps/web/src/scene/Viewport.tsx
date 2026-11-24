import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import World from "./World.tsx";
import type { SceneLot } from "./model.ts";
import { DEFAULT_ZOOM, limitZoom, MAX_ZOOM, MIN_ZOOM } from "./camera.ts";

export default function Viewport(props: {
  lots: SceneLot[]; blocks: number; seed: number; nowMs: number; fixedTime: boolean;
}) {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1);
      setZoom(previous => limitZoom(previous * Math.exp(-Math.max(-200, Math.min(200, pixels)) * 0.002)));
    };
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => surface.removeEventListener("wheel", wheel);
  }, []);
  return <>
    <Canvas ref={canvas} orthographic camera={{ position: [36, 45, 40] }} dpr={1}
      gl={{ antialias: true, powerPreference: "low-power" }}
      frameloop={props.fixedTime ? "demand" : "always"}>
      <World {...props} rotation={rotation} zoom={zoom} />
    </Canvas>
    <div className="scene-controls" role="group" aria-label="Управление камерой">
      <button type="button" aria-label="Повернуть влево" title="Повернуть влево"
        onClick={() => setRotation(r => r - 1)}>↶</button>
      <button type="button" aria-label="Повернуть вправо" title="Повернуть вправо"
        onClick={() => setRotation(r => r + 1)}>↷</button>
      <button type="button" aria-label="Отдалить карту" title="Отдалить карту" disabled={zoom <= MIN_ZOOM}
        onClick={() => setZoom(current => limitZoom(current / 1.25))}>−</button>
      <button type="button" aria-label="Приблизить карту" title="Приблизить карту" disabled={zoom >= MAX_ZOOM}
        onClick={() => setZoom(current => limitZoom(current * 1.25))}>+</button>
    </div>
  </>;
}
