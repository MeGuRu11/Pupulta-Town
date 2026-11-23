import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { DecayStage } from "@pupulta/shared";
import { plotDimensions, type SceneLot } from "./model.ts";
import { Scenery, type Part } from "./Scenery.tsx";

type Warning = Exclude<DecayStage, "none">;
const warnings: Record<Warning, { color: string; icon: string }> = {
  dirt: { color: "#836045", icon: "M32 13 Q28 22 21 30 C12 46 33 54 40 41 Q44 31 32 13Z" },
  graffiti: {
    color: "#965b99",
    icon: "M16 29 L37 16 L42 20 L29 32 L47 24 L50 30 L26 47 L21 44 L32 33 L19 38Z",
  },
  defect: { color: "#b96037", icon: "M33 10 L20 34 L30 34 L23 52 L45 26 L34 27 L40 10Z" },
  repair: {
    color: "#a96c21",
    icon: "M40 12 L34 23 L40 29 L51 21 Q53 38 38 39 L23 53 L15 45 L30 30 Q24 14 40 12Z",
  },
  fire: {
    color: "#c14635",
    icon: "M31 10 Q34 24 40 27 L44 19 Q54 37 43 47 Q35 55 29 51 Q36 46 31 38 Q24 42 24 48 Q10 41 18 28 Q20 33 23 33 Q30 26 31 10Z",
  },
};

function warningBadge(stage: Warning) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, Math.PI * 2);
  ctx.fillStyle = "#fff4da";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(32, 32, 25, 0, Math.PI * 2);
  ctx.fillStyle = warnings[stage].color;
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.fill(new Path2D(warnings[stage].icon));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function makeBuildings(lots: SceneLot[], origin: { x: number; z: number }) {
  const boxes: Part[] = [],
    roofs: Part[] = [];
  const badges: { id: string; stage: Warning; x: number; y: number; z: number }[] = [];
  for (const lot of lots) {
    const { setback, entranceWidth } = plotDimensions[lot.size];
    const w = lot.width - 2 * setback,
      d = lot.depth - 2 * setback,
      small = lot.size === "S";
    const x = lot.x - origin.x,
      z = lot.z - origin.z;
    const sin = Math.sin(lot.rotation),
      cos = Math.cos(lot.rotation);
    const add = (
      dx: number,
      y: number,
      dz: number,
      width: number,
      height: number,
      depth: number,
      color: string,
      parts = boxes,
    ) => {
      // All building parts are measured against the inset plinth, including the roof.
      const lx = dx * w,
        lz = dz * d;
      parts.push({
        position: [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos],
        scale: [width * w, height, depth * d],
        color,
        yaw: lot.rotation,
      });
    };
    const finished = lot.stage === "complete";
    const yardColor = finished ? (small ? "#bdafa0" : "#90ae78") : "#bc9d78";
    boxes.push({
      position: [x, 0.02, z],
      scale: [lot.width - 0.1, 0.025, lot.depth - 0.1],
      color: yardColor,
    });
    if (finished) {
      const facade = d * 0.35;
      const frontEdge = lot.depth / 2;
      const middle = (facade + frontEdge) / 2;
      boxes.push({
        position: [x + middle * sin, 0.044, z + middle * cos],
        scale: [entranceWidth, 0.026, frontEdge - facade],
        color: small ? "#ebd6ae" : "#d3bf9e", yaw: lot.rotation,
      });
    }
    const faded = lot.decay === "none" ? "#d4b896" : warnings[lot.decay].color;
    add(0, 0.09, 0, 1, 0.16, 1, "#b8aa91");
    add(0, 0.23, 0, 0.85, 0.18, 0.81, lot.stage === "foundation" ? faded : "#b7aaa0");
    let top: number;
    if (lot.stage === "foundation") {
      // Raised shuttering leaves the inside of the concrete footing visible.
      for (const side of [-1, 1]) {
        add(0, 0.48, side * 0.37, 0.84, 0.42, 0.07, faded);
        add(side * 0.385, 0.48, 0, 0.07, 0.42, 0.68, faded);
        add(side * 0.34, 0.83, -0.31, 0.045, 0.7, 0.045, "#776354");
      }
      top = 1.18;
    } else if (lot.stage === "construction") {
      const height = small ? 1.55 : 3.15;
      for (const side of [-1, 1]) {
        for (const end of [-1, 1])
          add(side * 0.36, 0.3 + height / 2, end * 0.33, 0.065, height, 0.075, "#94683e");
        add(0, 0.3 + height, side * 0.33, 0.8, 0.25, 0.085, "#d4a05d");
        add(side * 0.36, 0.3 + height, 0, 0.07, 0.25, 0.75, "#e4b879");
        add(side * 0.36, height * 0.62, 0, 0.075, 0.15, 0.74, "#c69764");
      }
      add(0, height * 0.54, -0.33, 0.76, height * 0.43, 0.08, lot.decay === "none" ? "#c87859" : faded);
      add(-0.19, height + 0.4, 0, 0.17, 0.1, 0.8, "#e3c495");
      top = height + 0.56;
    } else if (small) {
      add(0, 1.02, 0, 0.78, 1.42, 0.7, "#d9ac65");
      add(0, 1.45, 0.36, 0.56, 0.53, 0.04, "#486477");
      add(0, 1.2, 0.39, 0.72, 0.14, 0.14, "#fae1ae");
      add(0, 1.92, 0, 0.98, 0.22, 0.93, "#a75147");
      add(0, 2.17, 0, 0.91, 0.38, 0.87, "#ca7059", roofs);
      top = 2.4;
    } else {
      add(0, 1.74, 0, 0.78, 2.9, 0.7, "#eed5a4");
      add(0, 3.92, 0, 0.92, 1.56, 0.86, "#b5604f", roofs);
      add(0.22, 4.39, -0.17, 0.09, 1.23, 0.1, "#925b4a");
      add(0, 1.26, 0.355, 0.17, 1.88, 0.04, "#77645a");
      for (const side of [-1, 1]) {
        add(side * 0.245, 1.86, 0.362, 0.18, 1.08, 0.04, "#f7e9ce");
        add(side * 0.245, 1.86, 0.387, 0.137, 0.78, 0.018, "#648191");
        add(side * 0.245, 1.86, -0.355, 0.14, 0.86, 0.032, "#648191");
        add(side * 0.394, 1.82, 0, 0.025, 0.89, 0.17, "#648191");
      }
      top = 5.0;
    }
    if (lot.decay !== "none") badges.push({ id: lot.id, stage: lot.decay, x, y: top + 1.45, z });
  }
  return { boxes, roofs, badges };
}

function WarningBadges({ badges }: { badges: ReturnType<typeof makeBuildings>["badges"] }) {
  const textures = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(warnings) as Warning[]).map((stage) => [stage, warningBadge(stage)]),
      ) as Record<Warning, CanvasTexture>,
    [],
  );
  useEffect(() => () => Object.values(textures).forEach((t) => t.dispose()), [textures]);
  return (
    <>
      {badges.map((b) => (
        <sprite key={b.id} position={[b.x, b.y, b.z]} scale={[2.4, 2.4, 1]} renderOrder={2}>
          <spriteMaterial
            map={textures[b.stage]}
            transparent
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  );
}

export function Buildings({ lots, origin }: { lots: SceneLot[]; origin: { x: number; z: number } }) {
  const parts = useMemo(() => makeBuildings(lots, origin), [lots, origin]);
  return (
    <>
      <Scenery parts={parts.boxes} />
      <Scenery parts={parts.roofs} shape="roof" />
      {parts.badges.length > 0 && <WarningBadges badges={parts.badges} />}
    </>
  );
}
