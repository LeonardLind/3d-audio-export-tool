import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "../components/AudioPlayer";
import { CentroidLegend } from "../components/CentroidLegend";
import { CloudSceneV2 } from "../scene2/CloudSceneV2";
import { decodeToAnalysisRate } from "../analysis/decodeAudio";
import { ANALYSIS_SAMPLE_RATE, type BrowserAnalysis, type Progress } from "../analysis/pipeline";
import type { AnalyzeRequest, AnalyzeResponse } from "../analysis/analyzeWorker";

// Upload tab: analyze a clip that has never been through the offline generator, look at
// its 3D manifold and its spectral-centroid bar, then download the numbers as JSON.
//
// Scope is deliberately the two things asked for. The spectrogram, chromagram, descriptor
// gauges, sandbox gallery and BirdNET species classification are NOT computed here -- the
// downloaded JSON lists them under `omittedFields` instead of shipping placeholder zeros.
// For a complete asset package (all panels, BirdNET, playback transcode, validation) the
// offline generator is still the tool: `npm run generate:ui`.

const STAGE_LABEL: Record<Progress["stage"], string> = {
  decode: "Decoding + resampling",
  stft: "Short-time Fourier transform",
  windows: "Sampling windows",
  pca: "PCA (top 3 components)",
  edges: "Similarity threads",
  done: "Done",
};

function slug(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "uploaded_clip";
}

export function UploadMode() {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [analysis, setAnalysis] = useState<BrowserAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState("");
  const [species, setSpecies] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [downmixWarning, setDownmixWarning] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // The <audio> element plays straight off the local file; nothing is uploaded anywhere.
  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const run = useCallback(async (picked: File) => {
    workerRef.current?.terminate();
    setFile(picked);
    setAnalysis(null);
    setError(null);
    setElapsedMs(null);
    setAssetId(slug(picked.name));
    setSpecies("");
    setDownmixWarning(null);
    setAudioUrl(URL.createObjectURL(picked));
    setProgress({ stage: "decode", fraction: 0, note: `${(picked.size / 1024 / 1024).toFixed(1)} MB` });

    const started = performance.now();
    let decoded;
    try {
      decoded = await decodeToAnalysisRate(picked);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setDownmixWarning(decoded.downmixWarning);

    const worker = new Worker(new URL("../analysis/analyzeWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<AnalyzeResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        setProgress(message.progress);
      } else if (message.type === "result") {
        setAnalysis(message.analysis);
        setProgress(null);
        setElapsedMs(performance.now() - started);
        worker.terminate();
      } else {
        setProgress(null);
        setError(message.message);
        worker.terminate();
      }
    };
    worker.onerror = (event) => {
      setProgress(null);
      setError(event.message || "Analysis worker failed");
    };

    const request: AnalyzeRequest = {
      samples: decoded.samples,
      audioId: slug(picked.name),
      commonName: picked.name,
      filename: picked.name,
      sourceSampleRateHz: decoded.sourceSampleRateHz,
      sourceChannels: decoded.sourceChannels,
    };
    worker.postMessage(request, [decoded.samples.buffer]);
  }, []);

  const download = useCallback(() => {
    if (!analysis) return;
    const id = assetId.trim() || analysis.audioId;
    const payload: BrowserAnalysis = {
      ...analysis,
      audioId: id,
      commonName: species.trim() || analysis.commonName,
      audioUrl: `/assets/${analysis.generatedFrom}`,
      // Point ids are `<audioId>_<emissionTime>`, so renaming the asset has to carry
      // through or the file contradicts itself.
      points:
        id === analysis.audioId
          ? analysis.points
          : analysis.points.map((point) => ({ ...point, id: `${id}_${point.emissionTime.toFixed(3)}` })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${id}_cloud.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [analysis, assetId, species]);

  const busy = progress !== null;

  return (
    <>
      {analysis && audioUrl && (
        <CloudSceneV2
          payload={analysis}
          audioRef={audioRef}
          sceneKey={analysis.audioId + analysis.generatedAt}
          caption={species.trim() || analysis.generatedFrom}
        />
      )}

      <div className="overlay">
        <h1>Upload &amp; Analyze</h1>
        <p>
          {file
            ? `${file.name} — ${(file.size / 1024 / 1024).toFixed(2)} MB`
            : "Pick an audio file. It is decoded, analyzed and rendered here in the browser — nothing is uploaded."}
        </p>

        <div className="upload-controls">
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.ogg,.oga,.opus,.m4a,.aac,.aiff,.aif"
            style={{ display: "none" }}
            onChange={(event) => {
              const picked = event.target.files?.[0];
              if (picked) void run(picked);
              event.target.value = "";
            }}
          />
          <button className="upload-button" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Analyzing…" : file ? "Choose another file" : "Choose audio file"}
          </button>
        </div>

        {progress && (
          <div className="upload-progress">
            <div className="upload-progress-label">
              {STAGE_LABEL[progress.stage]} — {progress.note}
            </div>
            <div className="upload-progress-track">
              <div
                className="upload-progress-fill"
                style={{ width: `${Math.round(Math.min(1, Math.max(0, progress.fraction)) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {error && <p className="upload-error">{error}</p>}

        {analysis && audioUrl && (
          <>
            <AudioPlayer key={audioUrl} src={audioUrl} audioRef={audioRef} onTimeChange={() => {}} />
            <CentroidLegend maxHz={analysis.centroidMaxHz} />
          </>
        )}

        {analysis && (
          <div className="overlay-panels">
            <div className="panel">
              <div className="panel-head">
                <h2>Download</h2>
              </div>
              <label className="upload-field">
                <span>Asset id</span>
                <input value={assetId} onChange={(event) => setAssetId(event.target.value)} spellCheck={false} />
              </label>
              <label className="upload-field">
                <span>Species / caption</span>
                <input
                  value={species}
                  onChange={(event) => setSpecies(event.target.value)}
                  placeholder={analysis.generatedFrom}
                />
              </label>
              <button className="upload-button" onClick={download}>
                Download JSON
              </button>
              <p className="panel-note">
                <code>{`${assetId.trim() || analysis.audioId}_cloud.json`}</code> — point positions, per-point
                measurements, the similarity edge list and the per-frame centroid track, with the pipeline settings that
                produced them. Field names match <code>RecordingPayload</code> in{" "}
                <code>app/src/types.ts</code>; <code>kind</code> is <code>browser-upload-partial</code> so a consumer
                can tell it apart from a full offline export.
              </p>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>What was measured</h2>
              </div>
              <dl className="upload-facts">
                <div>
                  <dt>Points</dt>
                  <dd>
                    {analysis.pointCount} of {analysis.pointsBeforeAmplitudeFilter} windows
                  </dd>
                </div>
                <div>
                  <dt>Dropped as quiet</dt>
                  <dd>
                    {analysis.pointsBeforeAmplitudeFilter - analysis.pointCount} below RMS{" "}
                    {analysis.amplitudeFilterThreshold.toFixed(5)}
                  </dd>
                </div>
                <div>
                  <dt>Threads</dt>
                  <dd>{analysis.similarityEdges.length}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{analysis.durationSeconds.toFixed(2)} s</dd>
                </div>
                <div>
                  <dt>Window / hop</dt>
                  <dd>
                    {analysis.samplingWindowSeconds.toFixed(2)} s / {analysis.samplingHopSeconds.toFixed(3)} s
                  </dd>
                </div>
                <div>
                  <dt>Analysis rate</dt>
                  <dd>
                    {(analysis.analysisSampleRateHz / 1000).toFixed(2)} kHz · {analysis.fftSize}-FFT ·{" "}
                    {analysis.binWidthHz.toFixed(1)} Hz/bin
                  </dd>
                </div>
                <div>
                  <dt>Source rate</dt>
                  <dd>
                    {analysis.sourceSampleRateHz
                      ? `${(analysis.sourceSampleRateHz / 1000).toFixed(1)} kHz · ${analysis.sourceChannels ?? "?"} ch`
                      : `header not read · ${analysis.sourceChannels ?? "?"} ch`}
                  </dd>
                </div>
                <div>
                  <dt>Honest band</dt>
                  <dd>
                    0 – {(analysis.frequencyRange.maxHz / 1000).toFixed(2)} kHz
                    {analysis.frequencyRange.bandLimited ? " (source band-limited)" : ""}
                  </dd>
                </div>
                <div>
                  <dt>Max centroid</dt>
                  <dd>{(analysis.centroidMaxHz / 1000).toFixed(2)} kHz</dd>
                </div>
                <div>
                  <dt>PCA variance</dt>
                  <dd>
                    {(analysis.pcaExplainedVarianceTotal * 100).toFixed(1)}% in 3 (
                    {analysis.pcaExplainedVarianceRatio.map((r) => `${(r * 100).toFixed(1)}`).join(" / ")}%)
                  </dd>
                </div>
                {elapsedMs !== null && (
                  <div>
                    <dt>Compute time</dt>
                    <dd>{(elapsedMs / 1000).toFixed(2)} s in this tab</dd>
                  </div>
                )}
              </dl>

              <p className="panel-note">
                Analysis rate is fixed at {(ANALYSIS_SAMPLE_RATE / 1000).toFixed(2)} kHz so the frequency band matches
                every exported dataset. Everything from the STFT onwards is the same code as{" "}
                <code>tools/export_single_recording_dataset.js</code> and was checked point-for-point against its output.
                Decode and resample are the browser&apos;s, not ffmpeg&apos;s: on the project sample clip that moves
                per-window centroid by ~1% and leaves amplitude and dominant frequency unchanged.
              </p>
              {downmixWarning && <p className="upload-warning">{downmixWarning}</p>}
              <p className="panel-note">
                Not computed here: spectrogram + chromagram frames, the 12 descriptor series, the sandbox analysis, and
                BirdNET species classification — they are listed in the download under <code>omittedFields</code> rather
                than filled with zeros. Run <code>npm run generate:ui</code> for the full asset package.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
