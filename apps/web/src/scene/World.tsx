import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, InstancedMesh, Object3D, OrthographicCamera } from "three";
import { simulate } from "@pupulta/sim";
import { sceneOrigin, type SceneLot } from "./model.ts";
import { BLOCK_PERIOD, STREET_WIDTH, Terrain } from "./Terrain.tsx";
import { Buildings } from "./Buildings.tsx";
import { makeLotBoundaries } from "./lotBoundaries.ts";
import { boundaryParts } from "./boundaryParts.ts";
import { Scenery } from "./Scenery.tsx";
import { advanceCameraTurn, frameCityCamera } from "./camera.ts";
import { Outskirts } from "./Outskirts.tsx";

function CameraRig({ span, rotation, zoom }: { span: number; rotation: number; zoom: number }) {
  const { camera, size, invalidate } = useThree();
  const motion = useRef({ rotation, velocity: 0 });
  const lastFrame = useRef(0);
  const preference = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)"), []);
  useLayoutEffect(() => {
    const onChange = () => invalidate();
    preference.addEventListener("change", onChange);
    return () => preference.removeEventListener("change", onChange);
  }, [invalidate, preference]);
  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera) || size.width <= 0 || size.height <= 0) return;
    lastFrame.current = performance.now();
    if (preference.matches) motion.current = { rotation, velocity: 0 };
    frameCityCamera(camera, size.width, size.height, span, motion.current.rotation, zoom);
    invalidate();
  }, [camera, size.width, size.height, span, rotation, zoom, invalidate, preference]);
  useFrame(() => {
    if (!(camera instanceof OrthographicCamera) || !size.width || !size.height) return;
    if (motion.current.rotation === rotation && motion.current.velocity === 0) return;
    const time = performance.now();
    motion.current = preference.matches ? { rotation, velocity: 0 } :
      advanceCameraTurn(motion.current, rotation, (time - lastFrame.current) / 1000);
    lastFrame.current = time;
    frameCityCamera(camera, size.width, size.height, span, motion.current.rotation, zoom);
    if (motion.current.rotation !== rotation || motion.current.velocity !== 0) invalidate();
  });
  return null;
}

interface ResidentsProps {
  seed: number;
  blocks: number;
  nowMs: number;
  fixedTime: boolean;
}
function Residents({ seed, blocks, nowMs, fixedTime }: ResidentsProps) {
  const bodies = useRef<InstancedMesh>(null),
    heads = useRef<InstancedMesh>(null);
  const anchor = useRef(0);
  const transform = useMemo(() => new Object3D(), []);
  const count = Math.min(48, blocks * blocks * 14);
  useLayoutEffect(() => {
    anchor.current = performance.now();
  }, [nowMs]);
  useLayoutEffect(() => {
    const coat = ["#7c4861", "#d88845", "#496780", "#6f8870", "#c25d50", "#685a85"];
    const face = ["#bd8961", "#e1b48a", "#916449", "#e2b78e"];
    const color = new Color();
    for (let i = 0; i < count; i++) {
      bodies.current!.setColorAt(i, color.set(coat[((i + seed) >>> 0) % coat.length]!));
      heads.current!.setColorAt(i, color.set(face[((i + seed) >>> 0) % face.length]!));
    }
    if (bodies.current!.instanceColor) bodies.current!.instanceColor.needsUpdate = true;
    if (heads.current!.instanceColor) heads.current!.instanceColor.needsUpdate = true;
  }, [seed, count]);
  useFrame(() => {
    if (!bodies.current || !heads.current) return;
    const time = fixedTime ? nowMs : nowMs + (performance.now() - anchor.current);
    for (const person of simulate(seed, time, { blocks, residents: count })) {
      const bob = 0.035 * (1 + Math.sin(time * 0.009 + person.id));
      transform.rotation.y = -person.heading;
      transform.position.set(person.x, 0.65 + bob, person.z);
      transform.updateMatrix();
      bodies.current.setMatrixAt(person.id, transform.matrix);
      transform.position.y = 1.47 + bob;
      transform.updateMatrix();
      heads.current.setMatrixAt(person.id, transform.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh args={[undefined, undefined, count]} ref={bodies} frustumCulled={false}>
        <capsuleGeometry args={[0.29, 0.65, 2, 6]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, count]} ref={heads} frustumCulled={false}>
        <icosahedronGeometry args={[0.29, 0]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
    </>
  );
}

interface WorldProps extends ResidentsProps {
  lots: SceneLot[];
  rotation: number;
  zoom: number;
}
export default function World({ lots, blocks, seed, nowMs, fixedTime, rotation, zoom }: WorldProps) {
  const origin = useMemo(() => sceneOrigin(lots), [lots]);
  const boundaries = useMemo(() => boundaryParts(makeLotBoundaries(lots), origin), [lots, origin]);
  const span = blocks * BLOCK_PERIOD + STREET_WIDTH;
  return (
    <>
      <color attach="background" args={["#151c1b"]} />
      <hemisphereLight args={["#f6eacb", "#9c9592", 1.35]} />
      <directionalLight position={[-20, 44, 18]} intensity={2.1} color="#ffe6b5" />
      <CameraRig span={span} rotation={rotation} zoom={zoom} />
      <Outskirts span={span} seed={seed} />
      <Terrain blocks={blocks} seed={seed} />
      <Buildings lots={lots} origin={origin} />
      <Scenery parts={boundaries} />
      <Residents seed={seed} blocks={blocks} nowMs={nowMs} fixedTime={fixedTime} />
    </>
  );
}
