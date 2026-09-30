import type { CloudRecording } from '../data/types.ts';
import type { DecodedClip } from './types.ts';
import { classifyPlaybackSource } from './origin.ts';

type WebkitWindow = Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext };

export async function decodeClip(recording: CloudRecording): Promise<DecodedClip> {
  if (!recording.audioUrl) throw new Error('This recording has no audio URL');
  const response = await fetch(recording.audioUrl);
  if (!response.ok) throw new Error(`Audio request failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  const sourceRate = recording.source?.sampleRateHz;
  const channels = recording.source?.channels;
  const Offline = window.OfflineAudioContext ?? (window as WebkitWindow).webkitOfflineAudioContext;
  if (!Offline) throw new Error('Offline audio decoding is unavailable');

  let decodeRate = sourceRate && sourceRate > 0 ? sourceRate : 48000;
  let browserResampled = !sourceRate;
  let context: OfflineAudioContext;
  try {
    context = new Offline({ numberOfChannels: channels && channels > 0 ? channels : 1, length: 1, sampleRate: decodeRate });
  } catch {
    // Some browsers refuse high source rates. The 48 kHz result may draw the
    // full-file transport, but moment playback will be blocked by provenance.
    decodeRate = 48000;
    browserResampled = true;
    context = new Offline({ numberOfChannels: channels && channels > 0 ? channels : 1, length: 1, sampleRate: decodeRate });
  }
  const buffer = await context.decodeAudioData(bytes);
  if (buffer.sampleRate !== decodeRate) throw new Error(`Decoded at ${buffer.sampleRate} Hz instead of requested ${decodeRate} Hz`);
  if (!browserResampled && buffer.sampleRate !== sourceRate) throw new Error('Decoded rate differs from source rate');
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return {
    key: recording.key,
    origin: browserResampled ? 'browser-resampled' : classifyPlaybackSource(recording.audioUrl, recording.source),
    buffer,
    mono,
    sampleRate: buffer.sampleRate,
  };
}
