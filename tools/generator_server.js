// Local web front-end for the acoustic asset generator.
//
// Why a server rather than a page: the processing is Node-side by design -- ffmpeg decodes
// the audio and BirdNET runs through onnxruntime-node, and 06_Technical_Architecture keeps
// the browser out of the analysis path entirely (the browser never runs an FFT). So the page
// is only a control surface: it posts a file, the server runs the same
// generate()/writePackage() functions the CLI uses, and the page renders the result.
//
// Dependency-free on purpose (node:http only, no express/multer). The upload is the raw file
// bytes in the request body with the filename in a header, which avoids multipart parsing
// altogether -- fine for a single-file, single-user internal tool.
//
//   node tools/generator_server.js [--port=5184]
//   -> http://127.0.0.1:5184

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { generate, writePackage, publishToApp, slug, PROFILES } = require("./generate_acoustic_assets");
const { SUPPORTED_EXTENSIONS } = require("./lib/audio_source");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = 5184;
// Uploads land here before analysis. Kept out of the repo (os temp, not ROOT) so a browse-
// and-discard session never leaves files in the project; the package keeps its own copy of
// whatever was actually exported.
const UPLOAD_DIR = path.join(os.tmpdir(), "birdsong-generator-uploads");
const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;
// The preview player is a real <audio> element, and browsers decide whether to even attempt
// decoding from the Content-Type. Serving everything as octet-stream makes the preview fail
// silently on formats that would otherwise play, so the type is mapped from the extension.
const AUDIO_MIME_TYPES = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".wma": "audio/x-ms-wma",
};

// One run's results, held between the "Run analysis" and "Save package" requests so the
// user can inspect a preview and only then decide to write files. Single-slot: this is a
// one-person tool and holding several multi-megabyte payloads would be pointless.
let lastRun = null;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(text) });
  res.end(text);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error(`Upload exceeds ${Math.round(limit / (1024 * 1024))} MB limit`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Strips any directory component from a browser-supplied filename before it is used as a
// path. A filename arrives from the client and is never trusted as a path.
function safeFilename(name) {
  let decoded = String(name || "recording");
  // The client percent-encodes the filename (HTTP headers cannot carry non-ASCII directly).
  // A malformed sequence should not take the request down, so fall back to the raw value.
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* keep the raw value */
  }
  const base = path.basename(decoded).replace(/[\r\n]/g, "");
  return base || "recording";
}

// The preview the page draws: enough to confirm the analysis is real, but not the whole
// multi-megabyte payload (the spectral centroid series alone is thousands of frames). The
// full payload stays server-side until the user saves.
function buildPreview({ payload, validation, assetId, packageDir, source, playbackFormat }) {
  const panels = payload.panels;
  // Downsample the per-frame centroid track for the preview graph. This is display-only
  // decimation for one SVG -- the exported series keeps every frame.
  const maxPreviewPoints = 600;
  const stride = Math.max(1, Math.ceil(panels.centroidTrack.length / maxPreviewPoints));
  const centroidPreview = [];
  for (let i = 0; i < panels.centroidTrack.length; i += stride) {
    centroidPreview.push([
      Number((i * panels.hopSeconds).toFixed(3)),
      panels.centroidTrack[i],
    ]);
  }

  return {
    assetId,
    packageDir,
    validation,
    playbackFormat,
    source,
    summary: {
      durationSeconds: payload.durationSeconds,
      pointCount: payload.pointCount,
      analysisSampleRateHz: payload.analysisSampleRateHz,
      fftSize: payload.fftSize,
      frequencyRange: payload.frequencyRange,
      pcaExplainedVarianceTotal: payload.pcaExplainedVarianceTotal,
      centroidMaxHz: payload.centroidMaxHz,
      frameCount: panels.centroidTrack.length,
      hopSeconds: panels.hopSeconds,
      syllableCount: payload.analysis?.syllables?.count ?? null,
      repetitionRate: payload.analysis?.syllables?.repetitionRate ?? null,
      aciTotal: payload.analysis?.aci?.total ?? null,
      commonName: payload.commonName,
    },
    spectralCentroid: centroidPreview,
    birdnet:
      payload.birdnetDetections?.detections?.slice(0, 5).map((d) => ({
        commonName: d.commonName,
        scientificName: d.scientificName,
        confidence: d.confidence,
        atSeconds: d.atSeconds,
      })) ?? null,
  };
}

async function handleAnalyze(req, res) {
  const filename = safeFilename(req.headers["x-filename"]);
  const extension = path.extname(filename).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    sendJson(res, 400, { error: `Unsupported audio format "${extension}". Supported: ${SUPPORTED_EXTENSIONS.join(" ")}` });
    return;
  }

  const body = await readBody(req, MAX_UPLOAD_BYTES);
  if (body.length === 0) {
    sendJson(res, 400, { error: "Empty upload." });
    return;
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const uploadPath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(uploadPath, body);

  const species = req.headers["x-species"] ? decodeURIComponent(String(req.headers["x-species"])) : undefined;
  const label = req.headers["x-label"] ? decodeURIComponent(String(req.headers["x-label"])) : undefined;
  const idHeader = req.headers["x-asset-id"] ? decodeURIComponent(String(req.headers["x-asset-id"])) : "";
  const rateHeader = Number(req.headers["x-analysis-rate"]);
  const runBirdnet = req.headers["x-birdnet"] !== "0";

  const result = await generate({
    audioPath: uploadPath,
    id: idHeader ? slug(idHeader) : undefined,
    label,
    species,
    analysisSampleRate: Number.isFinite(rateHeader) && rateHeader > 0 ? rateHeader : undefined,
    runBirdnet,
  });

  lastRun = { ...result, audioPath: uploadPath, label, species };
  sendJson(res, 200, buildPreview(lastRun));
}

function handleSave(req, res, { publish, profile }) {
  if (!lastRun) {
    sendJson(res, 409, { error: "No analysis has been run in this session yet." });
    return;
  }
  if (!lastRun.validation.ok) {
    sendJson(res, 422, { error: "Validation failed; refusing to export incomplete data.", errors: lastRun.validation.errors });
    return;
  }
  if (!PROFILES.includes(profile)) {
    sendJson(res, 400, { error: `Unknown profile "${profile}". Expected one of: ${PROFILES.join(", ")}` });
    return;
  }

  const { index } = writePackage({ ...lastRun, profile, species: lastRun.species });
  const response = {
    packageDir: lastRun.packageDir,
    files: index.files,
    profile,
    analysisBytes: index.analysisBytes,
    upload: index.upload,
    published: null,
  };
  if (publish) {
    response.published = publishToApp({ ...lastRun, label: lastRun.label });
  }
  sendJson(res, 200, response);
}

// Serves the uploaded file back so the preview page can play the exact audio that was
// analyzed, before anything is written to disk.
function handlePreviewAudio(res) {
  if (!lastRun) {
    res.writeHead(404).end();
    return;
  }
  const stat = fs.statSync(lastRun.audioPath);
  const extension = path.extname(lastRun.audioPath).toLowerCase();
  res.writeHead(200, {
    "content-type": AUDIO_MIME_TYPES[extension] ?? "application/octet-stream",
    "content-length": stat.size,
    "cache-control": "no-store",
  });
  fs.createReadStream(lastRun.audioPath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = fs.readFileSync(path.join(__dirname, "generator_ui.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/config") {
      sendJson(res, 200, {
        supportedExtensions: SUPPORTED_EXTENSIONS,
        outputRoot: path.join(ROOT, "output"),
        profiles: PROFILES,
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/analyze") {
      await handleAnalyze(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/save") {
      handleSave(req, res, {
        publish: url.searchParams.get("publish") === "1",
        profile: url.searchParams.get("profile") || "full",
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/preview-audio") {
      handlePreviewAudio(res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message });
  }
});

const portArg = process.argv.slice(2).find((arg) => arg.startsWith("--port="));
const port = portArg ? Number(portArg.split("=")[1]) : DEFAULT_PORT;

// The usual cause is a generator left running in another terminal. Say so plainly instead of
// dying in an unhandled 'error' event, the same reasoning as strictPort in app/vite.config.ts.
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use -- another generator is probably still running.`);
    console.error(`Stop that one, or pick another port: node tools/generator_server.js --port=${port + 1}`);
    process.exit(1);
  }
  throw err;
});

// Bound to loopback only: this endpoint runs ffmpeg on whatever it is handed and writes into
// the repo, which has no business being reachable from the network.
server.listen(port, "127.0.0.1", () => {
  console.log(`Acoustic Asset Generator: http://127.0.0.1:${port}`);
  console.log(`Packages are written to ${path.join(ROOT, "output")}`);
});
