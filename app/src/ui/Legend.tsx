import type { CloudRecording } from '../data/types.ts';
import { restingDotDisplayRgb } from '../cloud/colorRamp.ts';
import { useAppState } from '../state/store.ts';
import styles from './Ui.module.css';

export interface LegendProps { recording: CloudRecording | null }
const ramp = Array.from({ length: 17 }, (_, i) => {
  const rgb = restingDotDisplayRgb(i / 16).map((value) => Math.round(value * 255));
  return `rgb(${rgb.join(',')}) ${i * 100 / 16}%`;
}).join(', ');

export function Legend({ recording }: LegendProps) {
  const main = useAppState((state) => state.playback.main);
  const axes = useAppState((state) => state.view.axes);
  if (!recording) return null;
  return <aside className={`${styles.panel} ${styles.legend}`} aria-label="Cloud key">
    <div className={styles.eyebrow}>SPECTRAL CENTROID</div>
    <div className={styles.ramp} style={{ background: `linear-gradient(90deg, ${ramp})` }} />
    <div className={styles.rampEnds}><span>Low</span><span>{(recording.colorMaxHz / 1000).toFixed(2)} kHz</span></div>
    <p>{axes === 7 ? 'Dot size shows signal strength and changes with perspective.' : 'Dot size shows signal strength.'} Numbers show peak frequency.</p>
    {main === 'playing' && <p>New dots appear with the sound.</p>}
  </aside>;
}
