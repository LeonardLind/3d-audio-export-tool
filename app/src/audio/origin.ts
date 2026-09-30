import type { AudioOrigin } from './types.ts';
import type { SourceInfo } from '../data/types.ts';

function basename(url: string): string | null {
  try {
    const path = new URL(url, 'https://viewer.invalid').pathname;
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
  } catch {
    return null;
  }
}

export function classifyPlaybackSource(audioUrl: string | null, source: SourceInfo | null): AudioOrigin {
  if (!audioUrl || !source) return 'unknown';
  const name = basename(audioUrl);
  if (!name) return 'unknown';
  if (name.endsWith('_playback.mp3')) return 'transcode';
  return source.browserPlayable && name === source.filename ? 'source-file' : 'unknown';
}

export type FormatGroup = 'mp3' | 'aac' | 'wav' | 'ogg' | 'flac' | 'unknown';
export function formatGroup(source: SourceInfo | null): FormatGroup {
  if (!source) return 'unknown';
  const extension = source.extension.replace(/^\./, '').toLowerCase();
  if (extension === 'mp3' || extension === 'mpga') return 'mp3';
  if (extension === 'aac' || extension === 'm4a') return 'aac';
  if (extension === 'wav' || extension === 'wave') return 'wav';
  if (extension === 'ogg' || extension === 'oga') return 'ogg';
  if (extension === 'flac') return 'flac';
  return 'unknown';
}
