import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { CloudRecording } from '../data/types.ts';
import { overviewColumns } from '../audio/overview.ts';
import { useClip } from '../audio/useClip.ts';
import { dispatch, useAppState } from '../state/store.ts';
import styles from './Ui.module.css';

export interface TransportBarProps { recording: CloudRecording | null; audioRef: RefObject<HTMLAudioElement | null>; allowUpload?: boolean; allowWaveform?: boolean }
function clock(seconds: number): string { const value = Math.max(0, seconds); return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`; }

export function TransportBar({ recording, audioRef, allowUpload = false, allowWaveform = false }: TransportBarProps) {
  const playback = useAppState((state) => state.playback.main);
  const autoRotate = useAppState((state) => state.view.autoRotate);
  const [error, setError] = useState<string | null>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clip = useClip(recording);
  const playable = recording?.origin !== 'upload' || allowUpload;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    const fail = () => setError('Playback unavailable. Try loading this recording again.');
    const clear = () => setError(null);
    audio.addEventListener('playbackerror', fail);
    audio.addEventListener('error', fail);
    audio.addEventListener('playing', clear);
    return () => { audio.removeEventListener('playbackerror', fail); audio.removeEventListener('error', fail); audio.removeEventListener('playing', clear); };
  }, [audioRef, recording?.key]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || clip.status !== 'ready' || !playable || !allowWaveform) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const columns = overviewColumns(clip.clip.mono, canvas.width);
    const peak = Math.max(1e-12, ...columns.map((column) => Math.max(Math.abs(column.min), Math.abs(column.max))));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#687b9d';
    const center = canvas.height / 2;
    const scale = (canvas.height * .43) / peak;
    columns.forEach((column, x) => context.fillRect(x, center - column.max * scale, 1, Math.max(1, (column.max - column.min) * scale)));
  }, [clip, playable, allowWaveform]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let frame = 0;
    const update = () => {
      const now = audio.currentTime || 0;
      if (progressRef.current && recording?.durationSeconds) progressRef.current.style.width = `${Math.min(100, 100 * now / recording.durationSeconds)}%`;
      if (timeRef.current) timeRef.current.textContent = clock(now);
      seekRef.current?.setAttribute('aria-valuenow', String(Math.round(now)));
      seekRef.current?.setAttribute('aria-valuetext', clock(now));
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [audioRef, recording?.key, recording?.durationSeconds]);
  if (!recording) return null;
  const audio = audioRef.current;
  const seek = (fraction: number) => { if (audio) { audio.currentTime = Math.max(0, Math.min(recording.durationSeconds, fraction * recording.durationSeconds)); dispatch({ type: 'MAIN_SEEK' }); } };
  return <div className={`${styles.panel} ${styles.transport}`}>
    <button type="button" disabled={!playable} aria-label={playback === 'playing' ? 'Pause' : 'Play'} onClick={() => { if (!audio || !playable) return; if (audio.paused) void audio.play().catch(() => audio.dispatchEvent(new Event('playbackerror'))); else audio.pause(); }}>{playback === 'playing' ? 'Pause' : 'Play'}</button>
    <span ref={timeRef}>0:00</span>
    <div ref={seekRef} className={styles.seek} role="slider" tabIndex={playable ? 0 : -1} aria-disabled={!playable} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(recording.durationSeconds)} aria-valuenow={0}
      onClick={(event) => { if (playable) seek((event.clientX - event.currentTarget.getBoundingClientRect().left) / event.currentTarget.clientWidth); }}
      onKeyDown={(event) => { if (playable && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) { event.preventDefault(); seek(((audio?.currentTime ?? 0) + (event.key === 'ArrowRight' ? 1 : -1)) / recording.durationSeconds); } }}>
      {allowWaveform && <canvas ref={canvasRef} className={styles.waveform} width={512} height={32} aria-hidden="true" />}
      <div className={`${styles.seekProgress} ${allowWaveform ? styles.waveformProgress : ''}`} ref={progressRef} />
    </div>
    <span>{clock(recording.durationSeconds)}</span>
    <button type="button" disabled={playback === 'playing'} onClick={() => dispatch({ type: 'REVEAL_ALL' })}>Show all</button>
    <button type="button" aria-pressed={autoRotate} onClick={() => dispatch({ type: 'SET_AUTO_ROTATE', enabled: !autoRotate })}>Rotate</button>
    {error && <span role="alert" className={styles.transportError}>{error}</span>}
  </div>;
}
