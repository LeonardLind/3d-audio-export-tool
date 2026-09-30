import type { CloudPoint } from '../data/types.ts';

export interface SpanCheck { status: 'passed' | 'failed'; matched: number; total: number; firstMismatch: number | null }

// Mirrors pipeline.ts frameRms: 512-sample hops, six 1024-sample frames per
// point, and the same left-to-right Float64 accumulation before sqrt.
export function verifyAnalysisSpans(samples: Float32Array, points: readonly CloudPoint[]): SpanCheck {
  let matched = 0;
  let firstMismatch: number | null = null;
  for (let p = 0; p < points.length; p += 1) {
    const point = points[p];
    const gridFrame = point.emissionTime * 22050 / 512;
    const startFrame = Math.round(gridFrame);
    const start = startFrame * 512;
    let energy = 0;
    if (!Number.isFinite(gridFrame) || Math.abs(gridFrame - startFrame) > 1e-9 || start < 0 || start + 3584 > samples.length) {
      if (firstMismatch === null) firstMismatch = p;
      continue;
    }
    for (let i = 0; i < 3584; i += 1) {
      const value = samples[start + i] ?? 0;
      energy += value * value;
    }
    if (Math.sqrt(energy / 3584) === point.amplitude) matched += 1;
    else if (firstMismatch === null) firstMismatch = p;
  }
  return { status: matched === points.length ? 'passed' : 'failed', matched, total: points.length, firstMismatch };
}
