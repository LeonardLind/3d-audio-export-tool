import type { CloudRecording } from '../data/types.ts';
import type { AudioBufferLike, ClipStatus, DecodedClip } from './types.ts';
import { decodeClip } from './decodeClip.ts';

const idle: ClipStatus = { status: 'idle' };
const clips = new Map<string, ClipStatus>();
const pending = new Map<string, Promise<ClipStatus>>();
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

export function getClipStatus(key: string | null): ClipStatus { return key ? clips.get(key) ?? idle : idle; }
export function subscribeClips(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function putUploadClip(key: string, pcm: Float32Array, sampleRate = 22050): DecodedClip {
  if (!key.startsWith('up:') || sampleRate !== 22050 || pcm.length < 1) throw new Error('Upload clip needs an up: key and 22050 Hz samples');
  const buffer: AudioBufferLike = {
    numberOfChannels: 1,
    length: pcm.length,
    sampleRate,
    getChannelData(channel) {
      if (channel !== 0) throw new RangeError('Upload clip has one channel');
      return pcm;
    },
  };
  const clip: DecodedClip = { key, origin: 'analysis-rate', buffer, mono: pcm, sampleRate };
  clips.set(key, { status: 'ready', clip });
  emit();
  return clip;
}

export function ensureClip(recording: CloudRecording): Promise<ClipStatus> {
  const existing = clips.get(recording.key);
  if (existing?.status === 'ready' || existing?.status === 'error') return Promise.resolve(existing);
  const inFlight = pending.get(recording.key);
  if (inFlight) return inFlight;
  if (recording.origin === 'upload') return Promise.resolve(existing ?? idle);
  clips.set(recording.key, { status: 'loading' });
  emit();
  const promise = decodeClip(recording).then<ClipStatus>((clip) => {
    const result: ClipStatus = { status: 'ready', clip };
    clips.set(recording.key, result);
    emit();
    return result;
  }).catch<ClipStatus>((error: unknown) => {
    const result: ClipStatus = { status: 'error', reason: error instanceof Error ? error.message : String(error) };
    clips.set(recording.key, result);
    emit();
    return result;
  }).finally(() => { pending.delete(recording.key); });
  pending.set(recording.key, promise);
  return promise;
}
