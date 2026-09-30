import type { ActiveRecording } from '../state/types.ts';
import { useAppState } from '../state/store.ts';
import styles from './Ui.module.css';

export interface CenterStateProps { active: ActiveRecording }
export function CenterState({ active }: CenterStateProps) {
  const datasets = useAppState((state) => state.datasets);
  if (active.status === 'ready') return null;
  let message = 'No recording is loaded.';
  if (datasets.status === 'loading') message = 'Loading recordings…';
  if (datasets.status === 'error') message = datasets.error ?? 'Could not load recordings.';
  if (active.status === 'loading') message = 'Loading recording…';
  if (active.status === 'error' || active.status === 'invalid') message = active.reason;
  if (active.status === 'invalid' && active.newerVersion) message = `This file uses format version ${active.newerVersion}; this viewer reads versions 1 and 2.`;
  return <div role="status" className={styles.center}>{message}</div>;
}
