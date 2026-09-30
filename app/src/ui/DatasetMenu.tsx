import type { DatasetManifestEntry } from '../data/types.ts';
import styles from './Ui.module.css';

export function DatasetMenu({ entries, onSelect, onUpload }: { entries: DatasetManifestEntry[]; onSelect: (entry: DatasetManifestEntry) => void; onUpload: () => void }) {
  return <div className={styles.datasetMenu} role="menu">
    {entries.map((entry) => <button type="button" role="menuitem" key={entry.id} onClick={() => onSelect(entry)}>{entry.label}</button>)}
    <button type="button" role="menuitem" onClick={onUpload}>Analyse a file from this computer…</button>
  </div>;
}
