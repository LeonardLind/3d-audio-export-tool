// Resolves the ffmpeg / ffprobe binaries every script spawns.
//
// Order: FFMPEG_PATH / FFPROBE_PATH env override -> the npm-bundled binary
// (ffmpeg-static, @ffprobe-installer/ffprobe) -> the bare name on PATH. Results depend on
// libswresample, so exports and benchmark results record `ffmpegVersion()` alongside the
// numbers they produce.

const { execFileSync } = require("child_process");

function bundled(moduleName, pick) {
  try {
    return pick(require(moduleName)) || null;
  } catch {
    return null;
  }
}

const FFMPEG =
  process.env.FFMPEG_PATH || bundled("ffmpeg-static", (mod) => mod) || "ffmpeg";
const FFPROBE =
  process.env.FFPROBE_PATH ||
  bundled("@ffprobe-installer/ffprobe", (mod) => mod.path) ||
  "ffprobe";

let cachedVersion;
function ffmpegVersion() {
  if (cachedVersion === undefined) {
    try {
      cachedVersion = execFileSync(FFMPEG, ["-version"], { encoding: "utf8" }).split("\n")[0].trim();
    } catch {
      cachedVersion = null;
    }
  }
  return cachedVersion;
}

module.exports = { FFMPEG, FFPROBE, ffmpegVersion };
