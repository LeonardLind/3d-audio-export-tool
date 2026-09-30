import { useCallback, useContext, useEffect, useRef } from 'react';
import { decodeToAnalysisRate } from '../analysis/decodeAudio.ts';
import type { AnalyzeRequest, AnalyzeResponse } from '../analysis/analyzeWorker.ts';
import { putUploadClip } from '../audio/clipStore.ts';
import { toCloudRecording } from '../data/normalize.ts';
import { appStore, type AppStore } from '../state/store.ts';
import { ResourcesContext } from '../state/resources.ts';
import { uploadAssetId } from '../export/uploadExport.ts';
import { analysisAudioWav } from './analysisAudio.ts';

const STAGE: Record<string, string> = {
  decode: 'Decoding + resampling', stft: 'Short-time Fourier transform', windows: 'Sampling windows',
  pca: 'PCA (top 3 components)', edges: 'Similarity threads', done: 'Done',
};

export function useUploadRun(store: AppStore = appStore): (file: File) => void {
  const resources = useContext(ResourcesContext);
  const runIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const run = useCallback((file: File) => {
    const runId = ++runIdRef.current;
    workerRef.current?.terminate();
    workerRef.current = null;
    const key = `up:${runId}`;
    store.dispatch({ type: 'UPLOAD_START', runId, fileName: file.name });
    const intent = store.getState().loadRevision;
    const isCurrent = () => mountedRef.current && runId === runIdRef.current && intent === store.getState().loadRevision;
    const started = performance.now();
    void (async () => {
      try {
        const decoded = await decodeToAnalysisRate(file);
        if (!isCurrent()) return;
        const pcm = decoded.samples;
        const worker = new Worker(new URL('../analysis/analyzeWorker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        worker.onmessage = (event: MessageEvent<AnalyzeResponse>) => {
          if (!isCurrent()) { worker.terminate(); return; }
          const message = event.data;
          if (message.type === 'progress') {
            store.dispatch({ type: 'UPLOAD_PROGRESS', runId, progress: `${STAGE[message.progress.stage] ?? message.progress.stage} — ${message.progress.note}` });
            return;
          }
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          if (message.type === 'error') {
            store.dispatch({ type: 'UPLOAD_ERROR', runId, error: message.message });
            return;
          }
          const result = toCloudRecording(message.analysis, { key, origin: 'upload' });
          if (!result.ok) {
            store.dispatch({ type: 'UPLOAD_ERROR', runId, error: result.reason });
            return;
          }
          const audioUrl = URL.createObjectURL(new Blob([analysisAudioWav(pcm)], { type: 'audio/wav' }));
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = audioUrl;
          result.recording.audioUrl = audioUrl;
          putUploadClip(key, pcm, 22050);
          store.dispatch({ type: 'UPLOAD_RESULT', runId, recording: result.recording,
            elapsedMs: performance.now() - started, downmixWarning: decoded.downmixWarning });
        };
        worker.onerror = (event) => {
          if (!isCurrent()) { worker.terminate(); return; }
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          store.dispatch({ type: 'UPLOAD_ERROR', runId, error: event.message || 'Analysis worker failed' });
        };
        const copy = pcm.slice();
        const request: AnalyzeRequest = { samples: copy, audioId: uploadAssetId(file.name), commonName: file.name,
          filename: file.name, sourceSampleRateHz: decoded.sourceSampleRateHz, sourceChannels: decoded.sourceChannels };
        worker.postMessage(request, [copy.buffer]);
      } catch (error) {
        if (isCurrent()) store.dispatch({ type: 'UPLOAD_ERROR', runId, error: error instanceof Error ? error.message : String(error) });
      }
    })();
  }, [store]);

  useEffect(() => {
    mountedRef.current = true;
    resources?.setStartUpload(run);
    const stop = () => {
      mountedRef.current = false;
      runIdRef.current++;
      workerRef.current?.terminate();
      workerRef.current = null;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      resources?.setStartUpload(() => {});
    };
    return stop;
  }, [resources, run]);
  return run;
}
