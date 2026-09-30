import type { DatasetManifestEntry, NormalizeResult } from './types.ts';
import { toCloudRecording } from './normalize.ts';

export function parseManifest(raw: unknown): DatasetManifestEntry[] {
  if (!Array.isArray(raw)) throw new Error('Dataset manifest must be an array.');
  const ids = new Set<string>();
  return raw.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new Error(`Manifest entry ${index} must be an object.`);
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new Error(`Manifest entry ${index} has an invalid or duplicate id.`);
    if (typeof item.label !== 'string' || !item.label) throw new Error(`Manifest entry ${index} needs a label.`);
    if (!['sample', 'field', 'diagnostic'].includes(String(item.kind))) throw new Error(`Manifest entry ${index} has an invalid kind.`);
    if (typeof item.path !== 'string' || !item.path.startsWith('/') || item.path.startsWith('//')) throw new Error(`Manifest entry ${index} has an invalid path.`);
    if (typeof item.durationSeconds !== 'number' || !Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0) throw new Error(`Manifest entry ${index} has invalid durationSeconds.`);
    ids.add(item.id);
    return { id: item.id, label: item.label, kind: item.kind, path: item.path, durationSeconds: item.durationSeconds } as DatasetManifestEntry;
  });
}

export function pickInitialDataset(entries: DatasetManifestEntry[], requestedId?: string | null): DatasetManifestEntry | null {
  return entries.find((entry) => entry.id === requestedId) ?? entries.find((entry) => entry.kind === 'sample') ?? entries[0] ?? null;
}

export async function fetchManifest(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<DatasetManifestEntry[]> {
  const response = await fetcher('/data/manifest.json', { signal });
  if (!response.ok) throw new Error(`Manifest request failed: HTTP ${response.status}.`);
  return parseManifest(await response.json());
}

export async function fetchPublished(entry: DatasetManifestEntry, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<NormalizeResult> {
  const response = await fetcher(entry.path, { signal });
  if (!response.ok) throw new Error(`Recording request failed: HTTP ${response.status}.`);
  const result = toCloudRecording(await response.json(), { key: `pub:${entry.id}`, origin: 'published' });
  if (result.ok) result.recording.key = `pub:${entry.id}:${result.recording.audioId}`;
  return result;
}
