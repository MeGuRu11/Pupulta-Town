import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import World from "./World.tsx";
import type { SceneLot } from "./model.ts";

export default function Viewport(props: {
  lots: SceneLot[]; blocks: number; seed: number; nowMs: number; fixedTime: boolean;
}) {
  const [rotation, setRotation] = useState(0);
  return <>
    <Canvas orthographic camera={{ position: [36, 45, 40] }} dpr={1}
      gl={{ antialias: true, powerPreference: "low-power" }}
      frameloop={props.fixedTime ? "demand" : "always"}>
      <World {...props} rotation={rotation} />
    </Canvas>
    <div className="scene-controls" role="group" aria-label="Поворот карты">
      <button type="button" aria-label="Повернуть влево" title="Повернуть влево"
        onClick={() => setRotation(r => (r + 3) % 4)}>↶</button>
      <button type="button" aria-label="Повернуть вправо" title="Повернуть вправо"
        onClick={() => setRotation(r => (r + 1) % 4)}>↷</button>
    </div>
  </>;
}
