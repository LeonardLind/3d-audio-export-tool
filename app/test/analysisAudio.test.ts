import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisAudioWav } from '../src/upload/analysisAudio.ts';

test('upload listening WAV retains exact mono float samples and declares their rate', () => {
  const samples = Float32Array.from([0, -0, -.713421, .000031, 1.25, -1.25]);
  const bytes = analysisAudioWav(samples);
  const view = new DataView(bytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint32(4, true), bytes.byteLength - 8);
  assert.equal(view.getUint16(20, true), 3);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 22050);
  assert.equal(view.getUint32(44, true), samples.length);
  assert.equal(view.getUint32(52, true), samples.byteLength);
  for (let i = 0; i < samples.length; i++) assert.ok(Object.is(view.getFloat32(56 + i * 4, true), samples[i]));
  assert.throws(() => analysisAudioWav(Float32Array.of(NaN)), /Non-finite/);
});
