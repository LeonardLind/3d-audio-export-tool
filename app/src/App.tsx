import { Suspense, useEffect, useState } from 'react';
import { ResourcesProvider } from './state/ResourcesContext.tsx';
import { useResources } from './state/useResources.ts';
import { useAppState, dispatch } from './state/store.ts';
import { CloudCanvas } from './cloud/CloudCanvas.tsx';
import { HeaderCard } from './ui/HeaderCard.tsx';
import { ViewBar } from './ui/ViewBar.tsx';
import { Legend } from './ui/Legend.tsx';
import { Tooltip } from './ui/Tooltip.tsx';
import { TransportBar } from './ui/TransportBar.tsx';
import { CenterState } from './ui/CenterState.tsx';
import { MoreMenu } from './ui/MoreMenu.tsx';
import { DetailsPanel } from './ui/DetailsPanel.tsx';
import { CompareTray } from './compare/CompareTray.tsx';
import { UploadPanel } from './upload/UploadPanel.tsx';
import { loadOwnerPanel } from './devHook.ts';
import { useDatasets } from './data/useDatasets.ts';
import { useClip } from './audio/useClip.ts';
import { stopPlayback } from './audio/engine.ts';
import { useGates } from './evidence/useGates.ts';
import type { PreviewData } from './evidence/types.ts';
import { certifiedSpan } from './data/pointSpan.ts';
import { useKeyboard } from './ui/useKeyboard.ts';
import styles from './App.module.css';

const OwnerPanel = loadOwnerPanel;

function Viewer() {
  const { audioRef, engineRef } = useResources();
  const active = useAppState((state) => state.active);
  const selection = useAppState((state) => state.selection);
  const axes = useAppState((state) => state.view.axes);
  const preview = useAppState((state) => state.dev.preview);
  const datasets = useDatasets();
  const recording = active.status === 'ready' ? active.recording : null;
  const clipStatus = useClip(recording);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const currentPreview = preview && previewData?.key === recording?.key ? previewData : null;
  const gates = useGates(recording, clipStatus, axes, preview, currentPreview?.spans);
  const audioGate = gates.momentPlayback;
  const allowUpload = recording?.origin === 'upload' && audioGate.status !== 'hidden';
  useKeyboard({ recording, audioRef, allowUpload });
  const spanFor = (index: number | null) => {
    if (index === null || !recording || audioGate.status === 'hidden') return undefined;
    return audioGate.status === 'preview' ? currentPreview?.spans[index]
      : certifiedSpan(recording.points[index], recording.durationSeconds) ?? undefined;
  };

  useEffect(() => {
    engineRef.current?.stop();
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [recording?.key, audioRef, engineRef]);

  useEffect(() => {
    if (recording?.origin === 'upload' && !allowUpload) audioRef.current?.pause();
  }, [recording?.origin, allowUpload, audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const playing = () => { stopPlayback(); dispatch({ type: 'MAIN_PLAYING' }); };
    const paused = () => dispatch({ type: 'MAIN_PAUSED' });
    const ended = () => dispatch({ type: 'MAIN_ENDED' });
    const seeked = () => dispatch({ type: 'MAIN_SEEK' });
    audio.addEventListener('play', playing);
    audio.addEventListener('pause', paused);
    audio.addEventListener('ended', ended);
    audio.addEventListener('seeked', seeked);
    return () => {
      audio.removeEventListener('play', playing); audio.removeEventListener('pause', paused);
      audio.removeEventListener('ended', ended); audio.removeEventListener('seeked', seeked);
    };
  }, [audioRef, engineRef]);

  return <main className={styles.viewer}>
    <audio ref={audioRef} className={styles.hiddenAudio} src={recording?.audioUrl ?? undefined} preload="metadata" />
    {recording && <CloudCanvas key={recording.key} recording={recording} audioRef={audioRef}
      showEdges={gates.similarityLines.status !== 'hidden'} preview={gates.similarityLines.status === 'preview'} />}
    <div className={styles.header}><HeaderCard recording={recording} onDataset={(entry) => { void datasets.loadRecording(entry); }} /></div>
    <div className={styles.views}><ViewBar /></div>
    <div className={styles.tools}><MoreMenu captureNotice={currentPreview?.notice} /></div>
    <div className={styles.key}><Legend recording={recording} /></div>
    <div className={styles.details}><DetailsPanel recording={recording} /></div>
    <div className={styles.compare}><CompareTray recording={recording} selection={selection} clipStatus={clipStatus}
      audioGate={audioGate.status === 'hidden' ? undefined : audioGate.value}
      playbackSpans={{ a: spanFor(selection.a), b: spanFor(selection.b) }}
      previewNotice={audioGate.status === 'preview' ? currentPreview?.notice : undefined}
      linkedGate={gates.linkedMoments.status === 'hidden' ? undefined : gates.linkedMoments.value} /></div>
    <div className={styles.transport}><TransportBar recording={recording} audioRef={audioRef}
      allowUpload={allowUpload} allowWaveform={audioGate.status !== 'hidden'} /></div>
    <CenterState active={active} />
    <Tooltip recording={recording} />
    <UploadPanel />
    {OwnerPanel && <Suspense fallback={null}><OwnerPanel recording={recording} gates={gates} onPreviewData={setPreviewData} /></Suspense>}
  </main>;
}

export default function App() { return <ResourcesProvider><Viewer /></ResourcesProvider>; }
