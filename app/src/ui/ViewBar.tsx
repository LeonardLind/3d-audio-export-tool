import { dispatch, useAppState } from '../state/store.ts';
import styles from './Ui.module.css';

export function ViewBar() {
  const axes = useAppState((state) => state.view.axes);
  const hint = useAppState((state) => state.view.hint);
  return <div className={`${styles.panel} ${styles.viewBar}`} aria-label="View axes">
    {(['X', 'Y', 'Z'] as const).map((label, index) => {
      const axis = (1 << index) as 1 | 2 | 4;
      const selected = Boolean(axes & axis);
      return <button key={label} type="button" aria-pressed={selected} aria-disabled={selected && axes === axis} title={`${label}: PCA direction ${index + 1}`}
        onClick={() => dispatch({ type: 'TOGGLE_AXIS', axis, startedAt: performance.now(), reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches })}
        className={selected ? styles.axisOn : styles.axisOff}>{label}</button>;
    })}
    <button type="button" onClick={() => dispatch({ type: 'FIT_VIEW' })}>Fit</button>
    {hint && <span role="status" className={styles.hint}>{hint}</span>}
  </div>;
}
