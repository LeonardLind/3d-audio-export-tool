import { useEffect, useMemo } from 'react';
import { appStore, type AppStore } from '../state/store.ts';
import { fetchManifest, fetchPublished, pickInitialDataset } from './manifest.ts';
import type { DatasetManifestEntry } from './types.ts';

export interface DatasetController {
  loadManifest(requestedId?: string | null): Promise<void>;
  loadRecording(entry: DatasetManifestEntry): Promise<void>;
  dispose(): void;
}

export function createDatasetController(store: AppStore = appStore): DatasetController {
  let generation = 0;
  let manifestAbort: AbortController | null = null;
  let recordingAbort: AbortController | null = null;
  async function loadRecording(entry: DatasetManifestEntry): Promise<void> {
    recordingAbort?.abort();
    const controller = new AbortController();
    recordingAbort = controller;
    const token = ++generation;
    const key = `pub:${entry.id}`;
    store.dispatch({ type: 'ACTIVE_LOADING', key });
    const intent = store.getState().loadRevision;
    try {
      const result = await fetchPublished(entry, controller.signal);
      if (controller.signal.aborted || token !== generation || intent !== store.getState().loadRevision) return;
      if (result.ok) store.dispatch({ type: 'ACTIVE_READY', key: result.recording.key, recording: result.recording });
      else store.dispatch({ type: 'ACTIVE_INVALID', key, reason: result.reason, newerVersion: result.newerVersion });
    } catch (error) {
      if (!controller.signal.aborted && token === generation && intent === store.getState().loadRevision) store.dispatch({ type: 'ACTIVE_ERROR', key, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  async function loadManifest(requestedId?: string | null): Promise<void> {
    manifestAbort?.abort();
    const controller = new AbortController();
    manifestAbort = controller;
    const token = ++generation;
    store.dispatch({ type: 'DATASETS_LOADING' });
    const intent = store.getState().loadRevision;
    try {
      const entries = await fetchManifest(controller.signal);
      if (controller.signal.aborted || token !== generation) return;
      store.dispatch({ type: 'DATASETS_READY', entries });
      if (intent !== store.getState().loadRevision) return;
      const initial = pickInitialDataset(entries, requestedId);
      if (initial) await loadRecording(initial);
    } catch (error) {
      if (!controller.signal.aborted && token === generation && intent === store.getState().loadRevision) store.dispatch({ type: 'DATASETS_ERROR', error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { loadManifest, loadRecording, dispose() { generation++; manifestAbort?.abort(); recordingAbort?.abort(); } };
}

export function useDatasets(store: AppStore = appStore): DatasetController {
  const controller = useMemo(() => createDatasetController(store), [store]);
  useEffect(() => {
    void controller.loadManifest(new URLSearchParams(window.location.search).get('dataset'));
    return () => controller.dispose();
  }, [controller]);
  return controller;
}
