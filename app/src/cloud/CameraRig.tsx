import { useEffect, useMemo, useRef } from 'react';
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CloudRecording } from '../data/types.ts';
import type { AxisMask, AppState } from '../state/types.ts';
import { fitOrtho, viewBasis } from './geometry.ts';
import { equivalentOrthoDepth } from './geometry.ts';
import { easeInOutCubic } from './transition.ts';

export interface CameraRigProps {
  recording: CloudRecording;
  axes: AxisMask;
  width: number;
  height: number;
  autoRotate: boolean;
  fitRequest: number;
  pointerInside: boolean;
  transition: AppState['view']['transition'];
}

export function CameraRig({ recording, axes, width, height, autoRotate, fitRequest, pointerInside, transition }: CameraRigProps) {
  const flat = axes !== 7;
  const rotating = transition?.plan === 'rotate';
  const fit = useMemo(() => fitOrtho(recording.points, axes, width, height), [recording, axes, width, height]);
  const basis = useMemo(() => viewBasis(axes), [axes]);
  const orthoRef = useRef<import('three').OrthographicCamera>(null);
  const perspectiveRef = useRef<import('three').PerspectiveCamera>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const saved3dPose = useRef(new Vector3(8, 5, 9));
  const lastFit = useRef(-1);
  const lastSize = useRef({ width: 0, height: 0 });
  const direction = useMemo(() => new Vector3(), []);
  const lookTarget = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(
    basis.right[0] * fit.center[0] + basis.up[0] * fit.center[1],
    basis.right[1] * fit.center[0] + basis.up[1] * fit.center[1],
    basis.right[2] * fit.center[0] + basis.up[2] * fit.center[1],
  ), [basis, fit]);
  const endpoints = useMemo(() => {
    if (!transition || transition.plan !== 'rotate') return null;
    const fromBasis = viewBasis(transition.from), toBasis = viewBasis(transition.to);
    const fromFit = fitOrtho(recording.points, transition.from, width, height);
    const toFit = fitOrtho(recording.points, transition.to, width, height);
    const fromTarget = transition.from === 7 ? new Vector3() : new Vector3(
      fromBasis.right[0] * fromFit.center[0] + fromBasis.up[0] * fromFit.center[1],
      fromBasis.right[1] * fromFit.center[0] + fromBasis.up[1] * fromFit.center[1],
      fromBasis.right[2] * fromFit.center[0] + fromBasis.up[2] * fromFit.center[1]);
    const toTarget = transition.to === 7 ? new Vector3() : new Vector3(
      toBasis.right[0] * toFit.center[0] + toBasis.up[0] * toFit.center[1],
      toBasis.right[1] * toFit.center[0] + toBasis.up[1] * toFit.center[1],
      toBasis.right[2] * toFit.center[0] + toBasis.up[2] * toFit.center[1]);
    const fromDirection = transition.from === 7 ? saved3dPose.current.clone().normalize() : new Vector3(...fromBasis.back);
    const toDirection = transition.to === 7 ? saved3dPose.current.clone().normalize() : new Vector3(...toBasis.back);
    return { fromBasis, toBasis, fromTarget, toTarget, fromDirection, toDirection,
      fromDistance: transition.from === 7 ? saved3dPose.current.length() : equivalentOrthoDepth(fromFit.worldHeight),
      toDistance: transition.to === 7 ? saved3dPose.current.length() : equivalentOrthoDepth(toFit.worldHeight) };
  }, [transition, recording, width, height]);

  useEffect(() => {
    if (!flat || rotating || !orthoRef.current) return;
    const camera = orthoRef.current;
    camera.zoom = 1;
    const distance = Math.max(10, fit.worldHeight * 2);
    camera.up.set(...basis.up);
    camera.position.copy(target).addScaledVector(new Vector3(...basis.back), distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controlsRef.current?.target.copy(target);
    controlsRef.current?.update();
  }, [flat, rotating, axes, basis, fit, target, fitRequest]);

  useEffect(() => {
    if (flat || rotating || !perspectiveRef.current) return;
    const camera = perspectiveRef.current;
    camera.up.set(0, 1, 0);
    controlsRef.current?.target.set(0, 0, 0);
    if (lastFit.current !== fitRequest || lastSize.current.width !== width || lastSize.current.height !== height) {
      const radius = recording.points.reduce((max, point) => Math.max(max, Math.hypot(...point.position)), 0);
      const vertical = camera.fov * Math.PI / 360;
      const horizontal = Math.atan(Math.tan(vertical) * width / Math.max(1, height));
      const distance = Math.max(1, radius) * 1.12 / Math.sin(Math.min(vertical, horizontal));
      camera.position.set(8, 5, 9).normalize().multiplyScalar(distance);
      saved3dPose.current.copy(camera.position);
    }
    lastFit.current = fitRequest;
    lastSize.current = { width, height };
    controlsRef.current?.update();
  }, [flat, rotating, recording, fitRequest, width, height]);

  useFrame(() => {
    const camera = perspectiveRef.current;
    if (!camera) return;
    if (!transition || !endpoints) {
      if (axes === 7) saved3dPose.current.copy(camera.position);
      return;
    }
    const elapsed = Math.max(0, performance.now() - transition.startedAt);
    const progress = easeInOutCubic(Math.min(1, elapsed / 700));
    direction.copy(endpoints.fromDirection).lerp(endpoints.toDirection, progress).normalize();
    lookTarget.copy(endpoints.fromTarget).lerp(endpoints.toTarget, progress);
    camera.position.copy(direction).multiplyScalar(endpoints.fromDistance + (endpoints.toDistance - endpoints.fromDistance) * progress).add(lookTarget);
    camera.up.set(endpoints.fromBasis.up[0] + (endpoints.toBasis.up[0] - endpoints.fromBasis.up[0]) * progress,
      endpoints.fromBasis.up[1] + (endpoints.toBasis.up[1] - endpoints.fromBasis.up[1]) * progress,
      endpoints.fromBasis.up[2] + (endpoints.toBasis.up[2] - endpoints.fromBasis.up[2]) * progress).normalize();
    camera.lookAt(lookTarget);
    camera.updateMatrixWorld();
  }, -2);

  return <>
    <PerspectiveCamera ref={perspectiveRef} makeDefault={!flat || rotating} position={[8, 5, 9]} fov={52} near={0.01} far={10000} />
    <OrthographicCamera ref={orthoRef} makeDefault={flat && !rotating}
      left={-fit.worldWidth / 2} right={fit.worldWidth / 2}
      top={fit.worldHeight / 2} bottom={-fit.worldHeight / 2}
      near={0.01} far={10000} />
    <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08}
      enabled={!rotating}
      autoRotate={!flat && !rotating && autoRotate && !pointerInside} autoRotateSpeed={0.5}
      enableRotate={!flat && !rotating} enablePan={flat && !rotating} enableZoom={!rotating}
      target={flat ? target : undefined} />
  </>;
}
