import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, NormalBlending, ShaderMaterial, Vector3 } from 'three';
import type { CloudRecording } from '../data/types.ts';
import type { AxisMask, RevealMode } from '../state/types.ts';
import { legibleEdgeLinear } from './colorRamp.ts';
import { MATTE } from './constants.ts';
import { edgeVertex, lineFragment } from './matteShader.ts';

export function EdgeLines({ recording, audioRef, axes, reveal }: { recording: CloudRecording; audioRef: RefObject<HTMLAudioElement | null>; axes: AxisMask; reveal: RevealMode }) {
  const built = useMemo(() => {
    const positions = new Float32Array(recording.similarityEdges.length * 6);
    const colors = new Float32Array(positions.length);
    const emissions = new Float32Array(recording.similarityEdges.length * 2);
    for (let i = 0; i < recording.similarityEdges.length; i++) {
      const [a, b] = recording.similarityEdges[i];
      const first = recording.points[a], second = recording.points[b];
      positions.set(first.position, i * 6); positions.set(second.position, i * 6 + 3);
      colors.set(legibleEdgeLinear(first.centroidNorm), i * 6);
      colors.set(legibleEdgeLinear(second.centroidNorm), i * 6 + 3);
      const later = Math.max(first.emissionTime, second.emissionTime);
      emissions[i * 2] = later; emissions[i * 2 + 1] = later;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aEmission', new BufferAttribute(emissions, 1));
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uRestMode: { value: 1 }, uOpacity: { value: MATTE.edgeOpacity }, uAxisMask: { value: new Vector3(1, 1, 1) } },
      vertexShader: edgeVertex, fragmentShader: lineFragment, transparent: true, depthWrite: false,
      depthTest: false, blending: NormalBlending,
    });
    return { geometry, material };
  }, [recording]);
  useEffect(() => () => { built.geometry.dispose(); built.material.dispose(); }, [built]);
  useFrame(() => {
    built.material.uniforms.uTime.value = audioRef.current?.currentTime ?? 0;
    built.material.uniforms.uRestMode.value = reveal === 'all' ? 1 : 0;
    (built.material.uniforms.uAxisMask.value as Vector3).set(axes & 1 ? 1 : 0, axes & 2 ? 1 : 0, axes & 4 ? 1 : 0);
  });
  return axes === 7 ? <lineSegments geometry={built.geometry} material={built.material} renderOrder={-1} frustumCulled={false} /> : null;
}
