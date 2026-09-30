import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { BrowserAnalysis } from '../analysis/pipeline.ts';
import { useAppState } from '../state/store.ts';
import { buildUploadExport, uploadExportFilename } from '../export/uploadExport.ts';
import { saveJson } from '../export/download.ts';
import { useUploadRun } from './useUploadRun.ts';
import styles from './Upload.module.css';

export function UploadPanel() {
  const start = useUploadRun();
  const input = useRef<HTMLInputElement>(null);
  const [assetId, setAssetId] = useState('');
  const [caption, setCaption] = useState('');
  const upload = useAppState((state) => state.upload);
  const active = useAppState((state) => state.active);
  const analysis = active.status === 'ready' && active.recording.origin === 'upload'
    ? active.recording.raw as unknown as BrowserAnalysis : null;

  function picked(file: File) {
    setAssetId('');
    setCaption('');
    start(file);
  }
  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) picked(file);
    event.target.value = '';
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) picked(file);
  }
  function download() {
    if (!analysis) return;
    const payload = buildUploadExport(analysis, assetId, caption);
    saveJson(payload, uploadExportFilename(payload), true);
  }
  return <section className={styles.panel} aria-label="Analyse a file" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <input ref={input} className={styles.hiddenInput} type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.oga,.opus,.m4a,.aac,.aiff,.aif" onChange={onInput} />
    <button type="button" onClick={() => input.current?.click()}>Analyse a file</button>
    {upload.progress && <p role="status">{upload.progress}</p>}
    {upload.error && <p role="alert">{upload.error}</p>}
    {analysis && <details><summary>Analysis ready · {analysis.pointCount} dots</summary><div className={styles.details}>
      <p>{analysis.pointCount} dots from {analysis.pointsBeforeAmplitudeFilter} windows · {analysis.durationSeconds.toFixed(1)} s · {analysis.samplingHopSeconds.toFixed(3)} s sampling grid step</p>
      <p>Analysed at {analysis.analysisSampleRateHz} Hz, FFT {analysis.fftSize}. Decoded and resampled in this browser.</p>
      {upload.downmixWarning && <p>{upload.downmixWarning}</p>}
      <label>Asset id <input value={assetId} onChange={(event) => setAssetId(event.target.value)} placeholder={analysis.audioId} /></label>
      <label>Caption <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={analysis.commonName} /></label>
      <button type="button" onClick={download}>Download analysis (JSON)</button>
    </div></details>}
  </section>;
}
