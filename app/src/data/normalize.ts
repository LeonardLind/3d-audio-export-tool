import type { CloudPoint, CloudRecording, FrequencyRange, NormalizeResult, RecordingOrigin, SourceInfo } from './types.ts';

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

export function toCloudRecording(input: unknown, options: { key: string; origin: RecordingOrigin }): NormalizeResult {
  if (!object(input)) return { ok: false, reason: 'Recording must be an object.' };
  const raw = input.kind === 'birdsong-cloud-view' ? input.cloud : input;
  if (!object(raw)) return { ok: false, reason: 'Recording cloud must be an object.' };
  const version = raw.contractVersion ?? 1;
  if (!Number.isInteger(version) || !finite(version) || version < 1) return { ok: false, reason: 'Invalid contractVersion.' };
  if (version > 2) return { ok: false, reason: `Unsupported contractVersion ${version}.`, newerVersion: version };
  if (!Array.isArray(raw.points) || raw.points.length === 0) return { ok: false, reason: 'Recording has no points.' };
  for (const [name, value] of Object.entries({ sampleRate: raw.sampleRate, fftSize: raw.fftSize, durationSeconds: raw.durationSeconds,
    samplingWindowSeconds: raw.samplingWindowSeconds, samplingHopSeconds: raw.samplingHopSeconds })) {
    if (!positive(value)) return { ok: false, reason: `${name} must be a positive finite number.` };
  }
  if (!Number.isInteger(raw.sampleRate) || !Number.isInteger(raw.fftSize)) return { ok: false, reason: 'sampleRate and fftSize must be integers.' };
  if (raw.analysisSampleRateHz !== undefined && !positive(raw.analysisSampleRateHz)) return { ok: false, reason: 'analysisSampleRateHz must be a positive finite number.' };
  if (raw.centroidMaxHz !== undefined && (!finite(raw.centroidMaxHz) || raw.centroidMaxHz < 0)) return { ok: false, reason: 'centroidMaxHz must be a nonnegative finite number.' };
  const points: CloudPoint[] = [];
  let prior = -Infinity;
  for (let i = 0; i < raw.points.length; i += 1) {
    const point = raw.points[i];
    if (!object(point)) return { ok: false, reason: `Point ${i} must be an object.` };
    if (typeof point.id !== 'string' || !point.id) return { ok: false, reason: `Point ${i} has invalid id.` };
    if (!Array.isArray(point.position) || point.position.length !== 3 || !point.position.every(finite)) {
      return { ok: false, reason: `Point ${i} position must contain three finite numbers.` };
    }
    if (!finite(point.emissionTime) || point.emissionTime < 0 || point.emissionTime > (raw.durationSeconds as number)) {
      return { ok: false, reason: `Point ${i} emissionTime is outside the recording.` };
    }
    if (point.emissionTime < prior) return { ok: false, reason: `Point ${i} emissionTime is before point ${i - 1}.` };
    prior = point.emissionTime;
    for (const name of ['amplitude', 'amplitudeNorm', 'dominantFrequencyHz', 'colorT', 'spectralCentroidHz',
      'centroidNorm', 'spectralFlux', 'spectralFluxNorm']) {
      const nonnegative = ['amplitude', 'dominantFrequencyHz', 'spectralCentroidHz', 'spectralFlux'].includes(name);
      if (!finite(point[name]) || (nonnegative && point[name] < 0)) {
        return { ok: false, reason: `Point ${i} ${name} must be ${nonnegative ? 'nonnegative and ' : ''}finite.` };
      }
    }
    const copy = { ...point } as unknown as CloudPoint;
    if (!finite(point.audioStartSeconds)) delete copy.audioStartSeconds;
    if (!finite(point.audioEndSeconds)) delete copy.audioEndSeconds;
    points.push(copy);
  }
  const warnings: string[] = [];
  if (raw.pointCount !== undefined && raw.pointCount !== points.length) warnings.push(`pointCount ${String(raw.pointCount)} differs from ${points.length} points.`);
  const edges: [number, number][] = [];
  let droppedEdges = 0;
  if (raw.similarityEdges !== undefined && !Array.isArray(raw.similarityEdges)) return { ok: false, reason: 'similarityEdges must be an array.' };
  for (const edge of (raw.similarityEdges ?? []) as unknown[]) {
    if (!Array.isArray(edge) || edge.length !== 2 || !edge.every(Number.isInteger) || edge.some((index: number) => index < 0 || index >= points.length || !Number.isSafeInteger(index)) || edge[0] === edge[1]) {
      droppedEdges++;
    } else edges.push([edge[0] as number, edge[1] as number]);
  }
  const colorMaxHz = Math.max(...points.map((point) => point.spectralCentroidHz));
  const centroidMaxHz = finite(raw.centroidMaxHz) && raw.centroidMaxHz >= 0 ? raw.centroidMaxHz : colorMaxHz;
  if (Math.abs(colorMaxHz - centroidMaxHz) > 1e-9) warnings.push('centroidMaxHz differs from the point maximum.');
  const source = object(raw.source) ? raw.source as unknown as SourceInfo
    : (raw.kind === 'browser-upload-partial' || raw.sourceSampleRateHz !== undefined) ? {
      filename: typeof raw.generatedFrom === 'string' ? raw.generatedFrom : '',
      extension: '', codec: null, container: null,
      sampleRateHz: positive(raw.sourceSampleRateHz) ? raw.sourceSampleRateHz : null,
      channels: positive(raw.sourceChannels) ? raw.sourceChannels : null,
      durationSeconds: raw.durationSeconds as number, sizeBytes: 0, browserPlayable: true,
    } : null;
  const range = object(raw.frequencyRange) ? raw.frequencyRange as unknown as FrequencyRange : null;
  const analysisSampleRateHz = positive(raw.analysisSampleRateHz) ? raw.analysisSampleRateHz : raw.sampleRate as number;
  const recording: CloudRecording = {
    key: options.key, origin: options.origin, audioId: typeof raw.audioId === 'string' ? raw.audioId : options.key,
    audioUrl: typeof raw.audioUrl === 'string' ? raw.audioUrl : null,
    commonName: typeof raw.commonName === 'string' ? raw.commonName : options.key,
    durationSeconds: raw.durationSeconds as number, sampleRate: raw.sampleRate as number, analysisSampleRateHz,
    fftSize: raw.fftSize as number, samplingWindowSeconds: raw.samplingWindowSeconds as number,
    samplingHopSeconds: raw.samplingHopSeconds as number, pointCount: points.length, points,
    similarityEdges: edges, droppedEdges, centroidMaxHz, colorMaxHz, frequencyRange: range, source,
    contractVersion: version as 1 | 2, evidence: raw.evidence ?? null, raw, warnings,
  };
  return { ok: true, recording };
}
