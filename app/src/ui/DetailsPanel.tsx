import type { CloudRecording } from '../data/types.ts';
import { useAppState } from '../state/store.ts';
import styles from './Ui.module.css';

export interface DetailsPanelProps { recording: CloudRecording | null }
export function DetailsPanel({ recording }: DetailsPanelProps) {
  const open = useAppState((state) => state.ui.detailsOpen);
  if (!recording || !open) return null;
  return <aside className={`${styles.panel} ${styles.details}`} aria-label="Recording details">
    <strong>This recording</strong>
    <dl>
      <dt>Dots</dt><dd>{recording.points.length}</dd>
      <dt>Duration</dt><dd>{recording.durationSeconds.toFixed(1)} s</dd>
      <dt>Sampling grid step</dt><dd>{recording.samplingHopSeconds.toFixed(3)} s</dd>
      <dt>Analysis rate</dt><dd>{recording.analysisSampleRateHz} Hz</dd>
      <dt>FFT size</dt><dd>{recording.fftSize}</dd>
      <dt>Source rate</dt><dd>{recording.source?.sampleRateHz ? `${recording.source.sampleRateHz} Hz` : 'Unknown'}</dd>
    </dl>
  </aside>;
}
