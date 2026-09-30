import { useEffect, useMemo } from 'react';
import type { CloudRecording } from '../data/types.ts';
import type { FeatureId, GateState, PreviewData } from '../evidence/types.ts';
import { dispatch, useAppState } from '../state/store.ts';
import { devSpans, PREVIEW_SENTINEL } from './devSpans.ts';
import styles from './Dev.module.css';

export interface OwnerPanelProps {
  recording: CloudRecording | null;
  gates: Record<FeatureId, GateState>;
  onPreviewData: (value: PreviewData | null) => void;
}

export default function OwnerPanel({ recording, gates, onPreviewData }: OwnerPanelProps) {
  const preview = useAppState((state) => state.dev.preview);
  useEffect(() => { if (new URLSearchParams(location.search).has('preview')) dispatch({ type: 'SET_PREVIEW', enabled: true }); }, []);
  const value = useMemo<PreviewData | null>(() => {
    if (!preview || !recording) return null;
    const spans = devSpans(recording) ?? [];
    return { key: recording.key, spans,
      notice: 'UNVERIFIED: preview only. Lines and moment timing have not passed their experiment checks.' };
  }, [preview, recording]);
  useEffect(() => { onPreviewData(value); return () => onPreviewData(null); }, [value, onPreviewData]);
  return <>
    {preview && <div className={styles.frame} data-mode={PREVIEW_SENTINEL}><div className={styles.banner}>UNVERIFIED · Owner preview · experiment results are pending</div></div>}
    <details className={styles.panel}><summary>Owner preview</summary>
      <label><input type="checkbox" checked={preview} onChange={(event) => dispatch({ type: 'SET_PREVIEW', enabled: event.target.checked })} /> Preview available data</label>
      <p>These controls are available only in development.</p>
      <dl>{Object.entries(gates).map(([feature, gate]) => <div key={feature}><dt>{feature}</dt>
        <dd>{gate.status === 'hidden' ? gate.reasons.join(', ') : gate.status}</dd></div>)}</dl>
    </details>
  </>;
}
