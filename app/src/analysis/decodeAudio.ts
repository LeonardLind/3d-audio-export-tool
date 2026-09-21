import { ANALYSIS_SAMPLE_RATE } from "./pipeline";

// Decode step for the Upload tab. The offline generator shells out to
//   ffmpeg -i <file> -ac 1 -ar 22050 -f f32le
// which does three things: decode, downmix to mono, resample to the analysis rate. In the
// browser the equivalent is an OfflineAudioContext at the analysis rate (decodeAudioData
// resamples to the context's rate) followed by an explicit channel average.
//
// This is the ONE step of the pipeline that is not a port of the Node code: the resampler
// is the browser's, not ffmpeg's (libswresample). Both are legitimate band-limited
// resamplers and neither invents signal, but their filter kernels differ, so individual
// sample values can differ in the last few decimal places -- and therefore so can the
// derived numbers, very slightly. Everything downstream of here is bit-comparable to the
// exporter (verified against dataset_sample.json). The UI states this, and the exported
// JSON records it in `analyzedIn`.

export interface DecodedAudio {
  samples: Float32Array;
  // What the FILE says it holds, read out of its own header -- null for containers this
  // does not parse. decodeAudioData cannot report it: it hands back audio already
  // resampled to the context rate.
  sourceSampleRateHz: number | null;
  sourceChannels: number;
  durationSeconds: number;
  // Set when the downmix could not be made to match ffmpeg's (see below), so the UI can
  // say so rather than presenting amplitudes as comparable when they are not.
  downmixWarning: string | null;
}

export async function decodeToAnalysisRate(file: File): Promise<DecodedAudio> {
  const bytes = await file.arrayBuffer();
  const sourceSampleRateHz = readSourceSampleRate(new Uint8Array(bytes.slice(0, Math.min(bytes.byteLength, 65536))));

  // decodeAudioData detaches the ArrayBuffer it is given, and the header read above needs
  // its own copy anyway, so hand it a slice.
  const context = new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE);
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(bytes);
  } catch {
    throw new Error(
      `The browser could not decode "${file.name}". Supported here: whatever this browser decodes (wav, mp3, flac, m4a/aac, ogg). For anything else, run it through the offline generator (npm run generate).`,
    );
  }

  if (buffer.sampleRate !== ANALYSIS_SAMPLE_RATE) {
    throw new Error(
      `Decoded at ${buffer.sampleRate} Hz instead of ${ANALYSIS_SAMPLE_RATE} Hz -- this browser ignored the OfflineAudioContext rate, so the analysis band would not match an exported dataset.`,
    );
  }

  // Mono downmix. ffmpeg's -ac 1 is NOT a channel average: libswresample rematrixes with
  // energy-preserving coefficients, measured here as exactly 1/sqrt(2) per channel for a
  // stereo source (so a dual-mono file comes out sqrt(2) louder than (L+R)/2 -- a straight
  // average would put every uploaded amplitude 3 dB below an offline export of the same
  // file). Above two channels ffmpeg switches to layout-aware surround coefficients
  // (center/LFE/surround mix levels) that follow no single rule -- measured 0.748, 0.638
  // and 0.607 of the channel sum for 4, 6 and 8 channels -- so those get an
  // energy-preserving 1/sqrt(n) and downmixWarning says the absolute amplitude scale will
  // not match an offline export.
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const samples = new Float32Array(length);
  for (let c = 0; c < channels; c += 1) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) samples[i] += channel[i];
  }
  const weight = 1 / Math.sqrt(channels);
  if (channels > 1) for (let i = 0; i < length; i += 1) samples[i] *= weight;

  return {
    samples,
    sourceSampleRateHz,
    sourceChannels: channels,
    durationSeconds: length / ANALYSIS_SAMPLE_RATE,
    downmixWarning:
      channels > 2
        ? `${channels}-channel source downmixed as sum / √${channels}. ffmpeg uses layout-aware surround coefficients instead, so amplitude values here will not match an offline export of this file (centroid and position are unaffected -- they are amplitude-scale invariant).`
        : null,
  };
}

// --- Container header reads --------------------------------------------------------
// Only the formats whose rate sits in a fixed, unambiguous header field. Anything else
// returns null, which the payload records as "source Nyquist unknown" rather than
// guessing. Getting this right matters for one thing: whether the top of the 11.025 kHz
// analysis band holds real signal or only resampler output (frequencyRange.bandLimited).

function readSourceSampleRate(head: Uint8Array): number | null {
  return readWavSampleRate(head) ?? readMp3SampleRate(head);
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

// RIFF/WAVE: walk the chunk list to "fmt ", whose sample rate is a uint32 at chunk+12.
function readWavSampleRate(head: Uint8Array): number | null {
  if (head.length < 44 || ascii(head, 0, 4) !== "RIFF" || ascii(head, 8, 4) !== "WAVE") return null;
  let offset = 12;
  while (offset + 8 <= head.length) {
    const id = ascii(head, offset, 4);
    const size = readUint32LE(head, offset + 4);
    if (id === "fmt ") {
      if (offset + 12 + 4 > head.length) return null;
      const rate = readUint32LE(head, offset + 12);
      return rate > 0 ? rate : null;
    }
    if (size <= 0) return null;
    offset += 8 + size + (size % 2);
  }
  return null;
}

// MPEG audio frame header: 11 sync bits, then a 2-bit version and a 2-bit rate index.
const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000], // MPEG 2.5
};

function readMp3SampleRate(head: Uint8Array): number | null {
  let offset = 0;
  // Skip an ID3v2 tag if present: 10-byte header, then a 28-bit syncsafe size.
  if (head.length > 10 && ascii(head, 0, 3) === "ID3") {
    const size = (head[6] << 21) | (head[7] << 14) | (head[8] << 7) | head[9];
    offset = 10 + size;
  }
  for (let i = offset; i + 3 < head.length; i += 1) {
    if (head[i] !== 0xff || (head[i + 1] & 0xe0) !== 0xe0) continue;
    const version = (head[i + 1] & 0x18) >> 3;
    const rateIndex = (head[i + 2] & 0x0c) >> 2;
    const rates = MP3_RATES[version];
    if (!rates || rateIndex > 2) continue;
    return rates[rateIndex];
  }
  return null;
}
