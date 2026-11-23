import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, InstancedMesh, Object3D, OrthographicCamera, Vector3 } from "three";
import { simulate } from "@pupulta/sim";
import { sceneOrigin, type SceneLot } from "./model.ts";
import { BLOCK_PERIOD, STREET_WIDTH, Terrain } from "./Terrain.tsx";
import { Buildings } from "./Buildings.tsx";
import { makeLotBoundaries } from "./lotBoundaries.ts";
import { boundaryParts } from "./boundaryParts.ts";
import { Scenery } from "./Scenery.tsx";

function CameraRig({ span, rotation }: { span: number; rotation: number }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera) || size.width <= 0 || size.height <= 0) return;
    const angle = Math.PI * (0.16 + rotation / 2);
    const range = span * 2 + 20;
    camera.position.set(span / 2 + range * Math.sin(angle), range * 0.93, span / 2 + range * Math.cos(angle));
    camera.lookAt(span / 2, 1.3, span / 2);
    camera.updateMatrixWorld(true);
    const p = new Vector3();
    let halfHeight = 0;
    const aspect = size.width / size.height;
    for (const x of [0, span])
      for (const z of [0, span])
        for (const y of [-1.5, 7]) {
          p.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
          halfHeight = Math.max(halfHeight, Math.abs(p.y), Math.abs(p.x) / aspect);
        }
    halfHeight *= 1.045;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.zoom = 1;
    camera.near = 0.1;
    camera.far = range * 4;
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, span, rotation, invalidate]);
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
}
export default function World({ lots, blocks, seed, nowMs, fixedTime, rotation }: WorldProps) {
  const origin = useMemo(() => sceneOrigin(lots), [lots]);
  const boundaries = useMemo(() => boundaryParts(makeLotBoundaries(lots), origin), [lots, origin]);
  const span = blocks * BLOCK_PERIOD + STREET_WIDTH;
  return (
    <>
      <color attach="background" args={["#dde3d5"]} />
      <hemisphereLight args={["#fff6dc", "#d0bcc2", 1.65]} />
      <directionalLight position={[20, 48, 28]} intensity={2.2} color="#fff3d9" />
      <CameraRig span={span} rotation={rotation} />
      <Terrain blocks={blocks} seed={seed} />
      <Buildings lots={lots} origin={origin} />
      <Scenery parts={boundaries} />
      <Residents seed={seed} blocks={blocks} nowMs={nowMs} fixedTime={fixedTime} />
    </>
  );
}
