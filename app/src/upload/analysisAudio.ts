// IEEE float WAV preserves every retained mono sample without quantization.
export function analysisAudioWav(samples: Float32Array, sampleRate = 22050): ArrayBuffer {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || sampleRate > 192000) throw new Error('Invalid sample rate');
  if (!samples.length || samples.length > (0xffffffff - 48) / 4) throw new Error('Invalid audio length');
  const buffer = new ArrayBuffer(56 + samples.length * 4);
  const view = new DataView(buffer);
  const tag = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  tag(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); tag(8, 'WAVE');
  tag(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 3, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 32, true);
  tag(36, 'fact'); view.setUint32(40, 4, true); view.setUint32(44, samples.length, true);
  tag(48, 'data'); view.setUint32(52, samples.length * 4, true);
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) throw new Error('Non-finite audio sample');
    view.setFloat32(56 + i * 4, samples[i], true);
  }
  return buffer;
}
