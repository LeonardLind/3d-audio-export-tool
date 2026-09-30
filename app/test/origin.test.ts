import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPlaybackSource, formatGroup } from '../src/audio/origin.ts';
import type { SourceInfo } from '../src/data/types.ts';

const source: SourceInfo = { filename: 'bird song.ogg', extension: '.ogg', codec: 'vorbis', container: 'ogg', sampleRateHz: 48000, channels: 2, durationSeconds: 4, sizeBytes: 100, browserPlayable: true };

test('source origin requires the same decoded basename and browser playability', () => {
  assert.equal(classifyPlaybackSource('/audio/bird%20song.ogg', source), 'source-file');
  assert.equal(classifyPlaybackSource('/audio/bird%20song_playback.mp3', source), 'transcode');
  assert.equal(classifyPlaybackSource('/audio/other.ogg', source), 'unknown');
  assert.equal(classifyPlaybackSource('/audio/bird%20song.ogg', { ...source, browserPlayable: false }), 'unknown');
  assert.equal(classifyPlaybackSource(null, source), 'unknown');
  assert.equal(classifyPlaybackSource('/audio/bird%20song.ogg', null), 'unknown');
});

test('format groups include the corpus extensions', () => {
  for (const [extension, group] of [['mp3', 'mp3'], ['mpga', 'mp3'], ['aac', 'aac'], ['m4a', 'aac'], ['wav', 'wav'], ['ogg', 'ogg'], ['flac', 'flac']] as const) {
    assert.equal(formatGroup({ ...source, extension }), group);
  }
  assert.equal(formatGroup(null), 'unknown');
});
