import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CloudRecording } from '../data/types.ts';
import type { Selection } from '../state/types.ts';
import type { ClipStatus } from '../audio/types.ts';
import type { OpenGate } from '../evidence/types.ts';
import type { MomentSpan, RangeHandle } from '../audio/engine.ts';
import { playRange, playSequence, stopPlayback, toSampleRange } from '../audio/engine.ts';
import { useClip } from '../audio/useClip.ts';
import { useResources } from '../state/useResources.ts';
import { dispatch, useAppState } from '../state/store.ts';
import { sharedPeak } from './waveformMath.ts';
import { compareFootnote } from './measuredRows.ts';
import { SlotCard } from './SlotCard.tsx';
import { COMPARE_COPY } from '../copy/compare.ts';
import styles from './Compare.module.css';

export interface CompareTrayProps {
  recording: CloudRecording | null;
  selection: Selection;
  clipStatus?: ClipStatus;
  audioGate?: OpenGate<unknown>;
  playbackSpans?: { a?: MomentSpan; b?: MomentSpan };
  previewNotice?: string;
  linkedGate?: OpenGate<unknown>;
}

export function CompareTray({ recording, selection, clipStatus: providedStatus, audioGate, playbackSpans, previewNotice, linkedGate }: CompareTrayProps) {
  const loadedStatus = useClip(recording);
  const clipStatus = providedStatus ?? loadedStatus;
  const { audioRef, engineRef } = useResources();
  const compare = useAppState((state) => state.compare);
  const axes = useAppState((state) => state.view.axes);
  const [handle, setHandle] = useState<RangeHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clip = recording && clipStatus.status === 'ready' && clipStatus.clip.key === recording.key ? clipStatus.clip : null;
  const audioOpen = !!audioGate && !!clip;
  const pointA = recording && selection.a !== null ? recording.points[selection.a] ?? null : null;
  const pointB = recording && selection.b !== null ? recording.points[selection.b] ?? null : null;
  const spanA = audioOpen ? playbackSpans?.a : undefined;
  const spanB = audioOpen ? playbackSpans?.b : undefined;
  const rangeA = useMemo(() => clip && spanA ? toSampleRange(spanA, clip) : null,
    [clip, spanA]);
  const rangeB = useMemo(() => clip && spanB ? toSampleRange(spanB, clip) : null,
    [clip, spanB]);

  const peaks = useMemo(() => {
    if (!clip) return { a: 1, b: 1 };
    const a = rangeA ? clip.mono.subarray(rangeA.start, rangeA.end) : new Float32Array(0);
    const b = rangeB ? clip.mono.subarray(rangeB.start, rangeB.end) : new Float32Array(0);
    if (compare.sharedScale) {
      const peak = sharedPeak(a, b).peak;
      return { a: peak, b: peak };
    }
    return { a: sharedPeak(a, []).peak, b: sharedPeak(b, []).peak };
  }, [clip, rangeA, rangeB, compare.sharedScale]);

  useEffect(() => {
    stopPlayback();
    engineRef.current = null;
    setHandle(null);
    setError(null);
  }, [recording?.key, selection.a, selection.b, audioOpen, engineRef]);

  const ended = useCallback(() => {
    dispatch({ type: 'SLOT_STOPPED' });
    setHandle(null);
  }, []);

  const playSlot = useCallback(async (slot: 'a' | 'b') => {
    if (!audioOpen || !clip) return;
    if (compare.playing === slot) { engineRef.current?.stop(); return; }
    const span = slot === 'a' ? spanA : spanB;
    const range = slot === 'a' ? rangeA : rangeB;
    if (!span || !range) return;
    setError(null);
    try {
      const next = await playRange(clip, span, audioRef.current, { slot, loop: compare.loop, onEnded: ended });
      engineRef.current = next;
      setHandle(next);
      dispatch({ type: 'SLOT_PLAYING', slot });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [audioOpen, clip, compare.playing, compare.loop, spanA, spanB, rangeA, rangeB, audioRef, engineRef, ended]);

  const playBoth = useCallback(async () => {
    if (!audioOpen || !clip || !spanA || !spanB || !rangeA || !rangeB) return;
    if (compare.playing === 'sequence') { engineRef.current?.stop(); return; }
    setError(null);
    try {
      const next = await playSequence(clip, spanA, spanB, audioRef.current, { onEnded: ended });
      engineRef.current = next;
      setHandle(next);
      dispatch({ type: 'SLOT_PLAYING', slot: 'sequence' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [audioOpen, clip, spanA, spanB, rangeA, rangeB, compare.playing, audioRef, engineRef, ended]);

  const toggleLoop = useCallback(() => {
    const enabled = !compare.loop;
    dispatch({ type: 'SET_LOOP', enabled });
    if (compare.playing !== 'sequence') handle?.setLoop(enabled);
  }, [compare.loop, compare.playing, handle]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
      if (event.key === 'Escape') {
        if (selection.a !== null || selection.b !== null) {
          event.preventDefault();
          stopPlayback();
          dispatch({ type: 'SELECT_CLEAR' });
        }
      } else if (audioOpen && event.key === '1') { event.preventDefault(); void playSlot('a'); }
      else if (audioOpen && event.key === '2') { event.preventDefault(); void playSlot('b'); }
      else if (audioOpen && (event.key === 'l' || event.key === 'L')) { event.preventDefault(); toggleLoop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection.a, selection.b, audioOpen, playSlot, toggleLoop, engineRef]);

  const linked = useMemo(() => {
    if (!linkedGate || axes !== 7 || !recording || selection.a === null) return [];
    return recording.similarityEdges.flatMap(([a, b]) => a === selection.a ? [b] : b === selection.a ? [a] : []);
  }, [linkedGate, axes, recording, selection.a]);

  if (!recording || (selection.a === null && selection.b === null)) return null;
  return <aside className={styles.tray} aria-label="Compare moments">
    <div className={styles.cards}>
      <SlotCard slot="a" point={pointA} recording={recording} clip={clip} range={rangeA} audioOpen={audioOpen}
        peak={peaks.a} playing={compare.playing === 'a' || compare.playing === 'sequence'} loop={compare.loop} handle={handle}
        onPlay={() => void playSlot('a')} onLoop={toggleLoop} />
      <SlotCard slot="b" point={pointB} recording={recording} clip={clip} range={rangeB} audioOpen={audioOpen}
        peak={peaks.b} playing={compare.playing === 'b' || compare.playing === 'sequence'} loop={compare.loop} handle={handle}
        onPlay={() => void playSlot('b')} onLoop={toggleLoop} />
    </div>
    {audioOpen && (rangeA || rangeB) && <div className={styles.sharedControls}>
      {rangeA && rangeB && <button type="button" onClick={() => void playBoth()}>{COMPARE_COPY.sequence.en}</button>}
      <label><input type="checkbox" checked={compare.sharedScale} onChange={(event) => dispatch({ type: 'SET_SHARED_SCALE', enabled: event.target.checked })} />{COMPARE_COPY.sharedScale.en}</label>
    </div>}
    {audioOpen && previewNotice && <p className={styles.notice}>{previewNotice}</p>}
    {audioOpen && clip && clip.buffer.numberOfChannels > 1 && <p className={styles.notice}>{COMPARE_COPY.multichannel.en}</p>}
    {audioOpen && recording.origin === 'upload' && <p className={styles.notice}>{COMPARE_COPY.uploadListening.en}</p>}
    {error && audioOpen && <p role="alert" className={styles.notice}>{error}</p>}
    {linked.length > 0 && <div className={styles.linked}>
      <strong>{COMPARE_COPY.linked.en}</strong>
      {linked.map((index) => <button key={index} type="button" onClick={() => dispatch({ type: 'SELECT_CLICK', index })}>{recording.points[index]?.emissionTime.toFixed(2)} s</button>)}
    </div>}
    <p className={styles.footnote}>{compareFootnote(recording)}</p>
  </aside>;
}
