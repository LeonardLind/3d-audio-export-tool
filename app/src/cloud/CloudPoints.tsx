import { useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, NormalBlending, ShaderMaterial, Vector3 } from 'three';
import type { CloudRecording } from '../data/types.ts';
import type { AxisMask, RevealMode } from '../state/types.ts';
import { plasmaLinear } from './colorRamp.ts';
import { radiusFraction } from './channels.ts';
import { equivalentOrthoDepth } from './geometry.ts';
import { RECENT_SECONDS, SIZE_SCALE } from './constants.ts';
import { matteFragment, matteVertex } from './matteShader.ts';

export interface CloudPointsProps {
  recording: CloudRecording;
  audioRef: RefObject<HTMLAudioElement | null>;
  axes: AxisMask;
  reveal: RevealMode;
}

export function CloudPoints({ recording, audioRef, axes, reveal }: CloudPointsProps) {
  const { gl } = useThree();
  const built = useMemo(() => {
    const n = recording.points.length;
    const positions = new Float32Array(n * 3), colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n), emissions = new Float32Array(n), flux = new Float32Array(n);
    const amplitudeMax = recording.points.reduce((max, point) => Math.max(max, point.amplitude), 0);
    for (let i = 0; i < n; i++) {
      const point = recording.points[i];
      positions.set(point.position, i * 3);
      const color = plasmaLinear(recording.colorMaxHz > 0 ? point.spectralCentroidHz / recording.colorMaxHz : 0);
      colors.set(color, i * 3);
      sizes[i] = radiusFraction(point, amplitudeMax);
      emissions[i] = point.emissionTime;
      flux[i] = point.spectralFluxNorm;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aEmission', new BufferAttribute(emissions, 1));
    geometry.setAttribute('aFlux', new BufferAttribute(flux, 1));
    const indices = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    const order = new Uint32Array(n);
    const depth = new Float32Array(n);
    for (let i = 0; i < n; i++) { indices[i] = i; order[i] = i; }
    const index = new BufferAttribute(indices, 1);
    geometry.setIndex(index);
    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uRestMode: { value: 1 },
        uSizeScale: { value: SIZE_SCALE }, uRecent: { value: RECENT_SECONDS },
        uPixelRatio: { value: 1 }, uOrthoDepth: { value: 0 }, uFade: { value: 1 },
        uAxisMask: { value: new Vector3(1, 1, 1) },
      },
      vertexShader: matteVertex, fragmentShader: matteFragment,
      transparent: true, depthWrite: false, blending: NormalBlending,
    });
    return { geometry, material, positions, sizes, depth, order, index };
  }, [recording]);

  useEffect(() => () => { built.geometry.dispose(); built.material.dispose(); }, [built]);

  useFrame(({ camera }) => {
    const dpr = gl.getPixelRatio();
    const material = built.material;
    material.uniforms.uTime.value = audioRef.current?.currentTime ?? 0;
    material.uniforms.uRestMode.value = reveal === 'all' ? 1 : 0;
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uSizeScale.value = SIZE_SCALE * dpr;
    material.uniforms.uOrthoDepth.value = camera.type === 'OrthographicCamera'
      ? equivalentOrthoDepth(((camera as import('three').OrthographicCamera).top - (camera as import('three').OrthographicCamera).bottom) / (camera as import('three').OrthographicCamera).zoom) : 0;
    (material.uniforms.uAxisMask.value as Vector3).set(axes & 1 ? 1 : 0, axes & 2 ? 1 : 0, axes & 4 ? 1 : 0);

    const { positions, depth, order, index, sizes } = built;
    const m = camera.matrixWorldInverse.elements;
    for (let i = 0; i < order.length; i++) {
      const x = axes & 1 ? positions[i * 3] : 0;
      const y = axes & 2 ? positions[i * 3 + 1] : 0;
      const z = axes & 4 ? positions[i * 3 + 2] : 0;
      depth[i] = -(m[2] * x + m[6] * y + m[10] * z + m[14]);
      order[i] = i;
    }
    // Insertion sort avoids allocating a new order array every frame. Far dots draw first.
    for (let i = 1; i < order.length; i++) {
      const candidate = order[i]; let j = i - 1;
      while (j >= 0 && (axes === 7 ? depth[order[j]] < depth[candidate] : sizes[order[j]] < sizes[candidate])) {
        order[j + 1] = order[j]; j--;
      }
      order[j + 1] = candidate;
    }
    for (let i = 0; i < order.length; i++) (index.array as Uint16Array | Uint32Array)[i] = order[i];
    index.needsUpdate = true;
  }, -1);

  return <points geometry={built.geometry} material={built.material} frustumCulled={false} />;
}
