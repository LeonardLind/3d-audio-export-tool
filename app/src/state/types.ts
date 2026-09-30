import type { DatasetManifestEntry, CloudRecording } from '../data/types.ts';

export type AxisMask = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type RevealMode = 'all' | 'follow';
export interface Selection { a: number | null; b: number | null }
export type ActiveRecording =
  | { status: 'none' }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; recording: CloudRecording }
  | { status: 'invalid'; key: string; reason: string; newerVersion?: number }
  | { status: 'error'; key: string; reason: string };

export type TransitionPlan = 'rotate' | 'fade' | 'instant';
export interface AppState {
  loadRevision: number;
  datasets: { status: 'idle' | 'loading' | 'ready' | 'error'; entries: DatasetManifestEntry[]; error?: string };
  active: ActiveRecording;
  upload: { runId: number; fileName: string | null; progress: string | null; error: string | null; elapsedMs: number | null; downmixWarning: string | null };
  view: { axes: AxisMask; transition: { from: AxisMask; to: AxisMask; plan: TransitionPlan; startedAt: number } | null; autoRotate: boolean; fitRequest: number; hint: string | null };
  playback: { main: 'idle' | 'playing' | 'paused' | 'ended'; reveal: RevealMode };
  pointer: { hover: { index: number; clientX: number; clientY: number } | null };
  selection: Selection;
  compare: { playing: 'a' | 'b' | 'sequence' | null; loop: boolean; sharedScale: boolean };
  ui: { detailsOpen: boolean; helpOpen: boolean; menuOpen: boolean; keyCollapsed: boolean; compareHintSeen: boolean };
  dev: { preview: boolean };
}

export type Action =
  | { type: 'DATASETS_LOADING' }
  | { type: 'DATASETS_READY'; entries: DatasetManifestEntry[] }
  | { type: 'DATASETS_ERROR'; error: string }
  | { type: 'ACTIVE_LOADING'; key: string }
  | { type: 'ACTIVE_READY'; key: string; recording: CloudRecording }
  | { type: 'ACTIVE_INVALID'; key: string; reason: string; newerVersion?: number }
  | { type: 'ACTIVE_ERROR'; key: string; reason: string }
  | { type: 'UPLOAD_START'; runId: number; fileName: string }
  | { type: 'UPLOAD_PROGRESS'; runId: number; progress: string }
  | { type: 'UPLOAD_RESULT'; runId: number; recording: CloudRecording; elapsedMs: number; downmixWarning?: string | null }
  | { type: 'UPLOAD_ERROR'; runId: number; error: string }
  | { type: 'TOGGLE_AXIS'; axis: 1 | 2 | 4; startedAt?: number; reducedMotion?: boolean }
  | { type: 'SET_AXES'; axes: AxisMask; startedAt?: number; reducedMotion?: boolean }
  | { type: 'END_TRANSITION' }
  | { type: 'SET_AUTO_ROTATE'; enabled: boolean }
  | { type: 'FIT_VIEW' }
  | { type: 'CLEAR_VIEW_HINT' }
  | { type: 'MAIN_PLAYING' | 'MAIN_PAUSED' | 'MAIN_ENDED' | 'MAIN_IDLE' | 'MAIN_SEEK' | 'REVEAL_ALL' }
  | { type: 'HOVER'; index: number; clientX: number; clientY: number }
  | { type: 'HOVER_CLEAR' }
  | { type: 'SELECT_CLICK'; index: number; shift?: boolean }
  | { type: 'SELECT_CLEAR' }
  | { type: 'SLOT_PLAYING'; slot: 'a' | 'b' | 'sequence' }
  | { type: 'SLOT_STOPPED' }
  | { type: 'SET_LOOP'; enabled: boolean }
  | { type: 'SET_SHARED_SCALE'; enabled: boolean }
  | { type: 'SET_UI'; field: keyof AppState['ui']; value: boolean }
  | { type: 'SET_PREVIEW'; enabled: boolean };
