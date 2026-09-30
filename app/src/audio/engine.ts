import type { DecodedClip, PlayHandle } from './types.ts';
import { toSampleRange as validatedRange } from '../data/pointSpan.ts';

export interface MomentSpan { startSeconds: number; endSeconds: number }
export interface SampleRange { start: number; end: number }
export interface RangeHandle extends PlayHandle {
  readonly startAt: number;
  readonly durationSeconds: number;
  readonly loop: boolean;
  readonly segments: readonly { slot: 'a' | 'b'; startAt: number; durationSeconds: number }[];
  setLoop(enabled: boolean): void;
}

let context: AudioContext | null = null;
let current: RangeHandle | null = null;
let requestSerial = 0;

export function toSampleRange(span: MomentSpan, clip: DecodedClip): SampleRange | null {
  return validatedRange(span, clip.buffer.sampleRate, clip.buffer.length);
}

function makeSlice(ctx: AudioContext, clip: DecodedClip, range: SampleRange): AudioBuffer {
  const output = ctx.createBuffer(clip.buffer.numberOfChannels, range.end - range.start, clip.buffer.sampleRate);
  for (let channel = 0; channel < clip.buffer.numberOfChannels; channel += 1) {
    output.copyToChannel(new Float32Array(clip.buffer.getChannelData(channel).subarray(range.start, range.end)), channel);
  }
  return output;
}

function heardTime(ctx: AudioContext): number {
  const stamp = ctx.getOutputTimestamp?.();
  if (stamp && typeof stamp.contextTime === 'number' && typeof stamp.performanceTime === 'number'
    && Number.isFinite(stamp.contextTime) && Number.isFinite(stamp.performanceTime) && stamp.performanceTime > 0) {
    return stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000;
  }
  return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
}

async function readyContext(): Promise<AudioContext> {
  context ??= new AudioContext();
  await context.resume();
  return context;
}

function stopCurrent(): void { current?.stop(); }

export async function playRange(
  clip: DecodedClip,
  span: MomentSpan,
  mainAudio: HTMLAudioElement | null,
  options: { loop?: boolean; slot?: 'a' | 'b'; onEnded?: () => void } = {},
): Promise<RangeHandle> {
  const range = toSampleRange(span, clip);
  if (!range) throw new RangeError('Moment is outside the decoded audio buffer');
  if (clip.origin !== 'source-file' && clip.origin !== 'analysis-rate') throw new Error('Moment playback requires verified source audio');
  const serial = ++requestSerial;
  stopCurrent();
  mainAudio?.pause();
  const ctx = await readyContext();
  if (serial !== requestSerial) throw new Error('Playback request was superseded');
  mainAudio?.pause();
  const source = ctx.createBufferSource();
  source.buffer = makeSlice(ctx, clip, range);
  source.loop = !!options.loop;
  source.connect(ctx.destination);
  const startAt = ctx.currentTime + 0.02;
  const durationSeconds = (range.end - range.start) / clip.buffer.sampleRate;
  let playing = true;
  const handle: RangeHandle = {
    startAt, durationSeconds, get loop() { return source.loop; },
    segments: [{ slot: options.slot ?? 'a', startAt, durationSeconds }],
    get playing() { return playing; },
    setLoop(enabled) { source.loop = enabled; },
    heardTime: () => playing ? heardTime(ctx) : null,
    stop() {
      if (!playing) return;
      playing = false;
      source.onended = null;
      try { source.stop(); } catch { /* source may have ended already */ }
      source.disconnect();
      if (current === handle) current = null;
      options.onEnded?.();
    },
  };
  source.onended = () => handle.stop();
  current = handle;
  try { source.start(startAt); } catch (error) { handle.stop(); throw error; }
  return handle;
}

export async function playSequence(
  clip: DecodedClip,
  spanA: MomentSpan,
  spanB: MomentSpan,
  mainAudio: HTMLAudioElement | null,
  options: { onEnded?: () => void } = {},
): Promise<RangeHandle> {
  const a = toSampleRange(spanA, clip);
  const b = toSampleRange(spanB, clip);
  if (!a || !b) throw new RangeError('A moment is outside the decoded audio buffer');
  if (clip.origin !== 'source-file' && clip.origin !== 'analysis-rate') throw new Error('Moment playback requires verified source audio');
  const serial = ++requestSerial;
  stopCurrent();
  mainAudio?.pause();
  const ctx = await readyContext();
  if (serial !== requestSerial) throw new Error('Playback request was superseded');
  mainAudio?.pause();
  const first = ctx.createBufferSource();
  const second = ctx.createBufferSource();
  first.buffer = makeSlice(ctx, clip, a);
  second.buffer = makeSlice(ctx, clip, b);
  first.connect(ctx.destination);
  second.connect(ctx.destination);
  const startAt = ctx.currentTime + 0.02;
  const aDuration = (a.end - a.start) / clip.buffer.sampleRate;
  const bDuration = (b.end - b.start) / clip.buffer.sampleRate;
  const secondAt = startAt + aDuration + 0.3;
  let playing = true;
  const handle: RangeHandle = {
    startAt, durationSeconds: aDuration + 0.3 + bDuration, loop: false,
    segments: [{ slot: 'a', startAt, durationSeconds: aDuration }, { slot: 'b', startAt: secondAt, durationSeconds: bDuration }],
    get playing() { return playing; },
    setLoop() { /* sequence playback ends after B */ },
    heardTime: () => playing ? heardTime(ctx) : null,
    stop() {
      if (!playing) return;
      playing = false;
      first.onended = null;
      second.onended = null;
      for (const source of [first, second]) {
        try { source.stop(); } catch { /* source may have ended already */ }
        source.disconnect();
      }
      if (current === handle) current = null;
      options.onEnded?.();
    },
  };
  second.onended = () => handle.stop();
  current = handle;
  try {
    first.start(startAt);
    second.start(secondAt);
  } catch (error) { handle.stop(); throw error; }
  return handle;
}

export function stopPlayback(): void { ++requestSerial; stopCurrent(); }
