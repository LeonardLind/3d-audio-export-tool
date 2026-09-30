import type { CloudRecording } from '../data/types.ts';
import { measuredRows } from '../compare/measuredRows.ts';
import { useAppState } from '../state/store.ts';
import styles from './Ui.module.css';

export interface TooltipProps { recording: CloudRecording | null }
export function Tooltip({ recording }: TooltipProps) {
  const hover = useAppState((state) => state.pointer.hover);
  const transition = useAppState((state) => state.view.transition);
  if (!recording || !hover || transition || !recording.points[hover.index]) return null;
  const x = Math.min(window.innerWidth - 240, Math.max(8, hover.clientX + 14));
  const y = Math.min(window.innerHeight - 180, Math.max(8, hover.clientY + 14));
  return <aside className={`${styles.panel} ${styles.tooltip}`} style={{ left: x, top: y }} role="tooltip">
    {measuredRows(recording.points[hover.index], recording).map((row) => <div key={row.id} className={styles.valueRow}><span>{row.label}</span><strong>{row.value}</strong></div>)}
  </aside>;
}
