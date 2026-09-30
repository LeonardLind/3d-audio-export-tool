import { useRef } from 'react';
import type { CloudRecording, DatasetManifestEntry } from '../data/types.ts';
import { useAppState, dispatch } from '../state/store.ts';
import { useResources } from '../state/useResources.ts';
import { DatasetMenu } from './DatasetMenu.tsx';
import styles from './Ui.module.css';

export interface HeaderCardProps { recording: CloudRecording | null; onDataset?: (entry: DatasetManifestEntry) => void }
export function HeaderCard({ recording, onDataset }: HeaderCardProps) {
  const menuOpen = useAppState((state) => state.ui.menuOpen);
  const entries = useAppState((state) => state.datasets.entries);
  const input = useRef<HTMLInputElement>(null);
  const { startUpload } = useResources();
  return <header className={styles.panel}>
    <div className={styles.wordmark}>ACOUSTIC CLOUD</div>
    <button type="button" className={styles.titleButton} onClick={() => dispatch({ type: 'SET_UI', field: 'menuOpen', value: !menuOpen })} aria-expanded={menuOpen}>
      <span className={styles.titleText}>{recording?.commonName ?? 'Choose a recording'}</span> <span aria-hidden="true">⌄</span>
    </button>
    <div className={styles.subline}>{recording ? `${recording.durationSeconds.toFixed(1)} s · ${recording.points.length} dots` : 'A view of measured sound'}</div>
    {menuOpen && <DatasetMenu entries={entries} onSelect={(entry) => { onDataset?.(entry); dispatch({ type: 'SET_UI', field: 'menuOpen', value: false }); }} onUpload={() => input.current?.click()} />}
    <input ref={input} className={styles.hidden} type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.oga,.opus,.m4a,.aac,.aiff,.aif"
      onChange={(event) => { const file = event.target.files?.[0]; if (file) startUpload(file); event.target.value = ''; dispatch({ type: 'SET_UI', field: 'menuOpen', value: false }); }} />
  </header>;
}
