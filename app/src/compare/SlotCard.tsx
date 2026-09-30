import type { CloudPoint, CloudRecording } from '../data/types.ts';
import type { DecodedClip } from '../audio/types.ts';
import type { RangeHandle, SampleRange } from '../audio/engine.ts';
import { measuredRows } from './measuredRows.ts';
import { MomentWaveform } from './MomentWaveform.tsx';
import { COMPARE_COPY } from '../copy/compare.ts';
import styles from './Compare.module.css';

export interface SlotCardProps {
  slot: 'a' | 'b';
  point: CloudPoint | null;
  recording: CloudRecording;
  clip: DecodedClip | null;
  range: SampleRange | null;
  audioOpen: boolean;
  peak: number;
  playing: boolean;
  loop: boolean;
  handle: RangeHandle | null;
  onPlay(): void;
  onLoop(): void;
}

export function SlotCard({ slot, point, recording, clip, range, audioOpen, peak, playing, loop, handle, onPlay, onLoop }: SlotCardProps) {
  const color = slot === 'a' ? '#4dd9ff' : '#7cf29a';
  return <section className={`${styles.card} ${playing ? styles.cardPlaying : ''}`} aria-label={`Moment ${slot.toUpperCase()}`}>
    <h3 className={styles.cardTitle}><span className={styles.slotBadge} style={{ color }}>{slot.toUpperCase()}</span> {point ? `${point.emissionTime.toFixed(2)} s` : 'Choose a dot'}</h3>
    {point && <dl className={styles.rows}>{measuredRows(point, recording).map((row) => <div key={row.id} className={styles.row}>
      <dt>{row.label}</dt><dd>{row.value}</dd>
    </div>)}</dl>}
    {point && audioOpen && clip && range && <div className={styles.audioArea}>
      <MomentWaveform samples={clip.mono} start={range.start} end={range.end} sampleRate={clip.sampleRate} peak={peak} color={color} slot={slot} handle={handle} />
      <div className={styles.cardControls}>
        <button type="button" onClick={onPlay} aria-label={`${playing ? COMPARE_COPY.stop.en : COMPARE_COPY.play.en} moment ${slot.toUpperCase()}`}>{playing ? COMPARE_COPY.stop.en : COMPARE_COPY.play.en}</button>
        <button type="button" onClick={onLoop} aria-pressed={loop}>{COMPARE_COPY.loop.en}</button>
      </div>
    </div>}
  </section>;
}
