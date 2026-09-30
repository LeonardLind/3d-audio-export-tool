import assert from 'node:assert/strict';
import test from 'node:test';
import { axesFromSearch, initialState, reducer } from '../src/state/reducer.ts';
import type { CloudRecording } from '../src/data/types.ts';

const recording = { key: 'pub:a:a', points: [{}, {}, {}] } as CloudRecording;

test('all seven query views and garbage', () => {
  for (const [view, mask] of Object.entries({ x: 1, y: 2, z: 4, xy: 3, xz: 5, yz: 6, xyz: 7 }))
    assert.equal(axesFromSearch(`?view=${view}`), mask);
  assert.equal(axesFromSearch('?view=garbage'), 7);
});

test('last axis stays on with a hint', () => {
  const state = reducer(initialState(1), { type: 'TOGGLE_AXIS', axis: 1 });
  assert.equal(state.view.axes, 1);
  assert.match(state.view.hint ?? '', /at least one/);
});

test('new key resets selection, hover, playback and reveal', () => {
  let state = reducer(initialState(), { type: 'ACTIVE_READY', key: recording.key, recording });
  state = reducer(state, { type: 'SELECT_CLICK', index: 0 });
  state = reducer(state, { type: 'HOVER', index: 1, clientX: 10, clientY: 20 });
  state = reducer(state, { type: 'SLOT_PLAYING', slot: 'a' });
  state = reducer(state, { type: 'MAIN_SEEK' });
  state = reducer(state, { type: 'ACTIVE_LOADING', key: 'pub:b:b' });
  assert.deepEqual(state.selection, { a: null, b: null });
  assert.equal(state.pointer.hover, null);
  assert.equal(state.compare.playing, null);
  assert.deepEqual(state.playback, { main: 'idle', reveal: 'all' });
});

test('main and slot playback are exclusive', () => {
  let state = reducer(initialState(), { type: 'MAIN_PLAYING' });
  state = reducer(state, { type: 'SLOT_PLAYING', slot: 'b' });
  assert.equal(state.playback.main, 'paused');
  state = reducer(state, { type: 'MAIN_PLAYING' });
  assert.equal(state.compare.playing, null);
  assert.equal(reducer(state, { type: 'REVEAL_ALL' }), state);
});

test('stale upload action and production preview are ignored', () => {
  let state = reducer(initialState(), { type: 'UPLOAD_START', runId: 2, fileName: 'two.ogg' });
  assert.equal(reducer(state, { type: 'UPLOAD_ERROR', runId: 1, error: 'old' }), state);
  state = reducer(state, { type: 'SET_PREVIEW', enabled: true }, { build: 'prod' });
  assert.equal(state.dev.preview, false);
});
