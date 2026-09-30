import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, LineBasicMaterial } from 'three';
import type { CloudRecording } from '../data/types.ts';
import type { AxisMask } from '../state/types.ts';
import { fitOrtho, gridLines, viewBasis } from './geometry.ts';

export function FlatGrid({ recording, axes, width, height }: { recording: CloudRecording; axes: AxisMask; width: number; height: number }) {
  const grid = useMemo(() => {
    const fit = fitOrtho(recording.points, axes, width, height);
    const basis = viewBasis(axes);
    const halfW = fit.worldWidth / 2, halfH = fit.worldHeight / 2;
    const minU = fit.center[0] - halfW, maxU = fit.center[0] + halfW;
    const minV = fit.center[1] - halfH, maxV = fit.center[1] + halfH;
    const uValues = gridLines(minU, maxU).values;
    const vValues = axes === 1 || axes === 2 || axes === 4 ? [0] : gridLines(minV, maxV).values;
    const coords: number[] = [];
    const add = (u: number, v: number) => {
      coords.push(basis.right[0] * u + basis.up[0] * v, basis.right[1] * u + basis.up[1] * v, basis.right[2] * u + basis.up[2] * v);
    };
    for (const u of uValues) { add(u, minV); add(u, maxV); }
    for (const v of vValues) { add(minU, v); add(maxU, v); }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(coords), 3));
    const material = new LineBasicMaterial({ color: '#5b6477', transparent: true, opacity: 0.13, depthWrite: false, depthTest: false });
    return { geometry, material };
  }, [recording, axes, width, height]);
  useEffect(() => () => { grid.geometry.dispose(); grid.material.dispose(); }, [grid]);
  return <lineSegments geometry={grid.geometry} material={grid.material} renderOrder={-2} />;
}
