import { useLayoutEffect, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";

export type Point = [number, number, number];
export interface Part {
  position: Point;
  scale: Point;
  color: string;
  yaw?: number;
}

// Unit gable, centred at the origin with the ridge along Z.
const roofPoints = [
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0, 0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0, 0.5, -0.5, -0.5, -0.5,
  -0.5, -0.5, -0.5, 0.5, 0, 0.5, 0.5, -0.5, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5,
  0.5, -0.5, 0.5, 0, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
];
const roofVertices = new Float32Array(roofPoints);

export function Scenery({ parts, shape = "box" }: { parts: Part[]; shape?: "box" | "roof" | "crown" }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new Object3D();
    const color = new Color();
    parts.forEach((part, index) => {
      transform.position.set(...part.position);
      transform.scale.set(...part.scale);
      transform.rotation.y = part.yaw ?? 0;
      transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
      mesh.current!.setColorAt(index, color.set(part.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [parts]);
  if (!parts.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, parts.length]}>
      {shape === "box" ? (
        <boxGeometry />
      ) : shape === "crown" ? (
        <icosahedronGeometry args={[0.59, 0]} />
      ) : (
        <bufferGeometry onUpdate={(geometry) => geometry.computeVertexNormals()}>
          <bufferAttribute attach="attributes-position" args={[roofVertices, 3]} />
        </bufferGeometry>
      )}
      <meshStandardMaterial roughness={0.93} flatShading />
    </instancedMesh>
  );
}
