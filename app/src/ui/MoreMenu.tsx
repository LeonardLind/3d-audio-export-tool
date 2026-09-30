import { useState } from 'react';
import { dispatch, useAppState } from '../state/store.ts';
import { buildViewExport } from '../export/viewExport.ts';
import { saveJson } from '../export/download.ts';
import { captureCloud } from '../cloud/capture.ts';
import { HelpPopover } from './HelpPopover.tsx';
import styles from './Ui.module.css';

export function MoreMenu({ captureNotice }: { captureNotice?: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useAppState((state) => state.active);
  const axes = useAppState((state) => state.view.axes);
  const helpOpen = useAppState((state) => state.ui.helpOpen);
  const recording = active.status === 'ready' ? active.recording : null;
  const slug = recording?.commonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'birdsong';
  return <div className={styles.panel} style={{ position: 'relative' }}>
    <button type="button" aria-label="More options" aria-expanded={open} onClick={() => setOpen(!open)}>⋯</button>
    {open && <div className={`${styles.panel} ${styles.popover}`}>
      <button type="button" onClick={() => dispatch({ type: 'SET_UI', field: 'helpOpen', value: !helpOpen })}>Help</button>
      <button type="button" onClick={() => { dispatch({ type: 'SET_UI', field: 'detailsOpen', value: true }); setOpen(false); }}>Recording details</button>
      <button type="button" disabled={!recording} onClick={() => { if (recording) saveJson(buildViewExport(recording, { axes }), `${slug}-cloud-view.json`); setOpen(false); }}>Download view (JSON)</button>
      <button type="button" disabled={!recording} onClick={() => {
        const container = document.querySelector('main');
        if (!container) return;
        setError(null);
        void captureCloud(container, captureNotice).then((blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${slug}-cloud.png`; anchor.click(); URL.revokeObjectURL(url);
        }).catch(() => setError('Could not save this picture. Try again once the cloud has loaded.'));
        setOpen(false);
      }}>Save picture (PNG)</button>
    </div>}
    {helpOpen && <HelpPopover onClose={() => dispatch({ type: 'SET_UI', field: 'helpOpen', value: false })} />}
    {error && <p role="alert" className={`${styles.panel} ${styles.popover}`}>{error}</p>}
  </div>;
}
