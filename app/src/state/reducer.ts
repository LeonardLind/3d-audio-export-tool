import type { Action, AppState, AxisMask, TransitionPlan } from './types.ts';
import { applyClick } from './selection.ts';

const VIEW_MASKS: Record<string, AxisMask> = { x: 1, y: 2, z: 4, xy: 3, xz: 5, yz: 6, xyz: 7 };
export function axesFromSearch(search: string): AxisMask {
  const raw = new URLSearchParams(search).get('view');
  return raw ? VIEW_MASKS[raw] ?? 7 : 7;
}

export function initialState(axes: AxisMask = 7): AppState {
  return {
    loadRevision: 0, datasets: { status: 'idle', entries: [] }, active: { status: 'none' },
    upload: { runId: 0, fileName: null, progress: null, error: null, elapsedMs: null, downmixWarning: null },
    view: { axes, transition: null, autoRotate: true, fitRequest: 0, hint: null },
    playback: { main: 'idle', reveal: 'all' }, pointer: { hover: null },
    selection: { a: null, b: null }, compare: { playing: null, loop: false, sharedScale: true },
    ui: { detailsOpen: false, helpOpen: false, menuOpen: false, keyCollapsed: false, compareHintSeen: false },
    dev: { preview: false },
  };
}

function resetForKey(state: AppState, key: string): AppState {
  if (state.active.status !== 'none' && state.active.key === key) return state;
  return { ...state, selection: { a: null, b: null }, pointer: { hover: null },
    compare: { ...state.compare, playing: null }, playback: { main: 'idle', reveal: 'all' } };
}

function withAxes(state: AppState, axes: AxisMask, startedAt = 0, reducedMotion = false): AppState {
  if (axes === state.view.axes) return state;
  const from = state.view.axes;
  const oneDimensional = (mask: AxisMask) => mask === 1 || mask === 2 || mask === 4;
  const plan: TransitionPlan = reducedMotion ? 'instant' : oneDimensional(from) || oneDimensional(axes) ? 'fade' : 'rotate';
  return { ...state, view: { ...state.view, axes, hint: null,
    transition: plan === 'instant' ? null : { from, to: axes, plan, startedAt } }, pointer: { hover: null } };
}

export function reducer(state: AppState, action: Action, env: { build: 'dev' | 'prod' } = { build: 'prod' }): AppState {
  switch (action.type) {
    case 'DATASETS_LOADING': return { ...state, datasets: { ...state.datasets, status: 'loading' } };
    case 'DATASETS_READY': return { ...state, datasets: { status: 'ready', entries: action.entries } };
    case 'DATASETS_ERROR': return { ...state, datasets: { ...state.datasets, status: 'error', error: action.error } };
    case 'ACTIVE_LOADING': return { ...resetForKey(state, action.key), loadRevision: state.loadRevision + 1, upload: { ...state.upload, progress: null }, active: { status: 'loading', key: action.key } };
    case 'ACTIVE_READY': {
      const next = resetForKey(state, action.key);
      return { ...next, active: { status: 'ready', key: action.key, recording: action.recording },
        selection: { a: next.selection.a !== null && next.selection.a < action.recording.points.length ? next.selection.a : null,
          b: next.selection.b !== null && next.selection.b < action.recording.points.length ? next.selection.b : null } };
    }
    case 'ACTIVE_INVALID': return { ...resetForKey(state, action.key), active: { status: 'invalid', key: action.key, reason: action.reason, newerVersion: action.newerVersion } };
    case 'ACTIVE_ERROR': return { ...resetForKey(state, action.key), active: { status: 'error', key: action.key, reason: action.reason } };
    case 'UPLOAD_START': return { ...state, loadRevision: state.loadRevision + 1, upload: { runId: action.runId, fileName: action.fileName, progress: 'Starting', error: null, elapsedMs: null, downmixWarning: null } };
    case 'UPLOAD_PROGRESS': return action.runId === state.upload.runId ? { ...state, upload: { ...state.upload, progress: action.progress } } : state;
    case 'UPLOAD_RESULT': return action.runId === state.upload.runId ? { ...resetForKey(state, action.recording.key),
      active: { status: 'ready', key: action.recording.key, recording: action.recording },
      upload: { ...state.upload, progress: null, elapsedMs: action.elapsedMs, downmixWarning: action.downmixWarning ?? null } } : state;
    case 'UPLOAD_ERROR': return action.runId === state.upload.runId ? { ...state, upload: { ...state.upload, progress: null, error: action.error } } : state;
    case 'TOGGLE_AXIS': {
      const next = state.view.axes ^ action.axis;
      return next === 0 ? { ...state, view: { ...state.view, hint: 'Keep at least one axis on.' } } : withAxes(state, next as AxisMask, action.startedAt, action.reducedMotion);
    }
    case 'SET_AXES': return withAxes(state, action.axes, action.startedAt, action.reducedMotion);
    case 'END_TRANSITION': return { ...state, view: { ...state.view, transition: null } };
    case 'SET_AUTO_ROTATE': return { ...state, view: { ...state.view, autoRotate: action.enabled } };
    case 'FIT_VIEW': return { ...state, view: { ...state.view, fitRequest: state.view.fitRequest + 1 } };
    case 'CLEAR_VIEW_HINT': return { ...state, view: { ...state.view, hint: null } };
    case 'MAIN_PLAYING': return { ...state, playback: { main: 'playing', reveal: 'follow' }, compare: { ...state.compare, playing: null } };
    case 'MAIN_PAUSED': return { ...state, playback: { ...state.playback, main: 'paused' } };
    case 'MAIN_ENDED': return { ...state, playback: { main: 'ended', reveal: 'all' } };
    case 'MAIN_IDLE': return { ...state, playback: { main: 'idle', reveal: 'all' } };
    case 'MAIN_SEEK': return { ...state, playback: { ...state.playback, reveal: 'follow' } };
    case 'REVEAL_ALL': return state.playback.main === 'playing' ? state : { ...state, playback: { ...state.playback, reveal: 'all' } };
    case 'HOVER': return state.active.status === 'ready' && action.index >= 0 && action.index < state.active.recording.points.length
      ? { ...state, pointer: { hover: { index: action.index, clientX: action.clientX, clientY: action.clientY } } } : state;
    case 'HOVER_CLEAR': return { ...state, pointer: { hover: null } };
    case 'SELECT_CLICK': return state.active.status === 'ready' ? { ...state, selection: applyClick(state.selection, action.index, state.active.recording.points.length, action.shift) } : state;
    case 'SELECT_CLEAR': return { ...state, selection: { a: null, b: null }, compare: { ...state.compare, playing: null } };
    case 'SLOT_PLAYING': return { ...state, compare: { ...state.compare, playing: action.slot }, playback: { ...state.playback, main: state.playback.main === 'playing' ? 'paused' : state.playback.main } };
    case 'SLOT_STOPPED': return { ...state, compare: { ...state.compare, playing: null } };
    case 'SET_LOOP': return { ...state, compare: { ...state.compare, loop: action.enabled } };
    case 'SET_SHARED_SCALE': return { ...state, compare: { ...state.compare, sharedScale: action.enabled } };
    case 'SET_UI': return { ...state, ui: { ...state.ui, [action.field]: action.value } };
    case 'SET_PREVIEW': return { ...state, dev: { preview: env.build === 'dev' && action.enabled } };
  }
}
