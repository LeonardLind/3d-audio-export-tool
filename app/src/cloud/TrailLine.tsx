import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Line, ShaderMaterial, Vector3 } from 'three';
import type { CloudRecording } from '../data/types.ts';
import type { AxisMask, RevealMode } from '../state/types.ts';
import { plasmaLinear } from './colorRamp.ts';
import { TRAIL_SECONDS } from './constants.ts';
import { lineFragment, trailVertex } from './matteShader.ts';

export function TrailLine({ recording, audioRef, axes, reveal }: { recording: CloudRecording; audioRef: RefObject<HTMLAudioElement | null>; axes: AxisMask; reveal: RevealMode }) {
  const built = useMemo(() => {
    const n = recording.points.length;
    const positions = new Float32Array(n * 3), colors = new Float32Array(n * 3), emissions = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const point = recording.points[i];
      positions.set(point.position, i * 3);
      const c = plasmaLinear(recording.colorMaxHz > 0 ? point.spectralCentroidHz / recording.colorMaxHz : 0);
      colors.set([Math.min(1, c[0] * 0.9 + 0.2), Math.min(1, c[1] * 0.9 + 0.25), Math.min(1, c[2] * 0.9 + 0.35)], i * 3);
      emissions[i] = point.emissionTime;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aEmission', new BufferAttribute(emissions, 1));
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTrail: { value: TRAIL_SECONDS }, uOpacity: { value: 0.5 },
        uRestMode: { value: 1 }, uAxisMask: { value: new Vector3(1, 1, 1) } },
      vertexShader: trailVertex, fragmentShader: lineFragment, transparent: true,
      depthWrite: false, blending: AdditiveBlending,
    });
    return { geometry, material, line: new Line(geometry, material) };
  }, [recording]);
  useEffect(() => () => { built.geometry.dispose(); built.material.dispose(); }, [built]);
  useFrame(() => {
    built.material.uniforms.uTime.value = audioRef.current?.currentTime ?? 0;
    built.material.uniforms.uRestMode.value = reveal === 'all' ? 1 : 0;
    (built.material.uniforms.uAxisMask.value as Vector3).set(axes & 1 ? 1 : 0, axes & 2 ? 1 : 0, axes & 4 ? 1 : 0);
  });
  built.line.frustumCulled = false;
  return axes === 1 || axes === 2 || axes === 4 ? null : <primitive object={built.line} />;
}
