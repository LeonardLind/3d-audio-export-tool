import { useSyncExternalStore } from 'react';
import { axesFromSearch, initialState, reducer } from './reducer.ts';
import type { Action, AppState, AxisMask } from './types.ts';

export interface AppStore {
  getState(): AppState;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
}

export function createAppStore(options: { axes?: AxisMask; build?: 'dev' | 'prod' } = {}): AppStore {
  let state = initialState(options.axes ?? 7);
  const listeners = new Set<() => void>();
  const build = options.build ?? 'prod';
  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action, { build });
      if (next !== state) { state = next; for (const listener of listeners) listener(); }
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export const appStore = createAppStore({
  axes: typeof window === 'undefined' ? 7 : axesFromSearch(window.location.search),
  build: import.meta.env.DEV ? 'dev' : 'prod',
});

export function useAppState<T>(selector: (state: AppState) => T, store: AppStore = appStore): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}

export const dispatch = (action: Action) => appStore.dispatch(action);
export const getState = () => appStore.getState();
