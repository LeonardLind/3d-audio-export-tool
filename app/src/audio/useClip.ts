import { useEffect, useSyncExternalStore } from 'react';
import type { CloudRecording } from '../data/types.ts';
import type { ClipStatus } from './types.ts';
import { ensureClip, getClipStatus, subscribeClips } from './clipStore.ts';

export function useClip(recording: CloudRecording | null): ClipStatus {
  const key = recording?.key ?? null;
  const status = useSyncExternalStore(subscribeClips, () => getClipStatus(key), () => getClipStatus(key));
  useEffect(() => { if (recording) void ensureClip(recording); }, [recording]);
  return status;
}
