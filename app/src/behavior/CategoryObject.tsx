import { useMemo } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";

// Renders one behavioral category in the shared 3D feature space: its recordings' window
// cloud plus the covariance-ellipsoid "average shape" (a translucent solid + wireframe).
// The ellipsoid transform comes precomputed from the batch tool as a column-major 4x4
// (unit sphere -> ellipsoid); we decompose it into position/rotation/scale for r3f.
// Reused identically by the overview mini-canvases and the big Compare scene.
export function CategoryObject({
  points,
  color,
  ellipsoidMatrix,
  opacity = 1,
  showCloud = true,
  showEllipsoid = true,
  pointSize = 0.13,
}: {
  points: [number, number, number][];
  color: string;
  ellipsoidMatrix: number[] | null;
  opacity?: number;
  showCloud?: boolean;
  showEllipsoid?: boolean;
  pointSize?: number;
}) {
  const positions = useMemo(() => {
    const arr = new Float32Array(points.length * 3);
    points.forEach((p, i) => {
      arr[i * 3] = p[0];
      arr[i * 3 + 1] = p[1];
      arr[i * 3 + 2] = p[2];
    });
    return arr;
  }, [points]);

  const transform = useMemo(() => {
    if (!ellipsoidMatrix) return null;
    const m = new Matrix4().fromArray(ellipsoidMatrix);
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3();
    m.decompose(pos, quat, scl);
    return {
      position: [pos.x, pos.y, pos.z] as [number, number, number],
      quaternion: [quat.x, quat.y, quat.z, quat.w] as [number, number, number, number],
      scale: [scl.x, scl.y, scl.z] as [number, number, number],
    };
  }, [ellipsoidMatrix]);

  return (
    <group>
      {showEllipsoid && transform && (
        <>
          <mesh position={transform.position} quaternion={transform.quaternion} scale={transform.scale}>
            <sphereGeometry args={[1, 32, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.13 * opacity} depthWrite={false} />
          </mesh>
          <mesh position={transform.position} quaternion={transform.quaternion} scale={transform.scale}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.22 * opacity} depthWrite={false} />
          </mesh>
        </>
      )}
      {showCloud && points.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial color={color} size={pointSize} sizeAttenuation transparent opacity={0.92 * opacity} depthWrite={false} />
        </points>
      )}
    </group>
  );
}
