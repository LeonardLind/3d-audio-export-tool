// Reads what an audio file ACTUALLY contains, before any resampling. The pipeline decodes
// every recording to a fixed analysis sample rate via ffmpeg, which happily UPSAMPLES a
// narrow-band file -- so after decoding there is no way to tell a genuine 22.05 kHz
// recording from a 16 kHz one that was stretched to fit. The difference matters: the STFT
// bins above the source's own Nyquist contain resampler artifacts, not signal, and a
// frequency axis drawn to the analysis Nyquist would present that empty top band as if it
// were measured. Probing the source first is what lets the export state an honest
// frequency range (see frequencyRange in the payload).

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Containers ffmpeg decodes for analysis. The pipeline itself accepts anything ffmpeg can
// read -- this list only drives the file picker's filter and the "supported formats" hint.
const SUPPORTED_EXTENSIONS = [".wav", ".mp3", ".flac", ".ogg", ".oga", ".m4a", ".aac", ".aiff", ".aif", ".wma", ".opus"];

// Containers a browser <audio> element can be relied on to play. WAV/MP3/OGG/M4A are safe;
// FLAC and WMA are not universally supported, so the exporter flags those for transcoding.
const BROWSER_SAFE_EXTENSIONS = [".wav", ".mp3", ".ogg", ".oga", ".m4a", ".aac", ".opus"];

function probeAudioSource(audioPath) {
  if (!fs.existsSync(audioPath)) throw new Error(`Audio file not found: ${audioPath}`);

  let raw;
  try {
    raw = execFileSync(
      "ffprobe",
      [
        "-hide_banner", "-loglevel", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels,codec_name,bits_per_raw_sample:format=duration,format_name,size",
        "-of", "json",
        audioPath,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
  } catch (err) {
    throw new Error(`ffprobe could not read ${path.basename(audioPath)}: ${err.message}`);
  }

  const parsed = JSON.parse(raw);
  const stream = parsed.streams?.[0];
  if (!stream) throw new Error(`No audio stream found in ${path.basename(audioPath)}`);

  const sampleRateHz = Number(stream.sample_rate) || null;
  const durationSeconds = Number(parsed.format?.duration) || null;
  const extension = path.extname(audioPath).toLowerCase();

  return {
    filename: path.basename(audioPath),
    extension,
    codec: stream.codec_name ?? null,
    container: parsed.format?.format_name ?? null,
    sampleRateHz,
    channels: Number(stream.channels) || null,
    durationSeconds,
    sizeBytes: Number(parsed.format?.size) || fs.statSync(audioPath).size,
    browserPlayable: BROWSER_SAFE_EXTENSIONS.includes(extension),
  };
}

module.exports = { probeAudioSource, SUPPORTED_EXTENSIONS, BROWSER_SAFE_EXTENSIONS };
