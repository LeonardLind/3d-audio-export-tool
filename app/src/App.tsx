import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ParticleField } from "./components/ParticleField";
import { AudioPlayer } from "./components/AudioPlayer";
import { CentroidLegend } from "./components/CentroidLegend";
import { AudioSourceSwitch } from "./components/AudioSourceSwitch";
import { SpectralDescriptorsPanel } from "./components/SpectralDescriptorsPanel";
import { CentroidAmplitudePanel } from "./components/CentroidAmplitudePanel";
import { SpectrogramPanel } from "./components/SpectrogramPanel";
import { ChromagramPanel } from "./components/ChromagramPanel";
import { SandboxGallery } from "./sandbox/SandboxGallery";
import { BehaviorMode } from "./behavior/BehaviorMode";
import { CloudSceneV2 } from "./scene2/CloudSceneV2";
import { UploadMode } from "./upload/UploadMode";
import type { DatasetManifestEntry, RecordingPayload } from "./types";
import { displayMaxHz } from "./frequencyRange";
import "./App.css";

type Mode = "scene" | "scene2" | "sandbox" | "behavior" | "upload";

function App() {
  const [datasets, setDatasets] = useState<DatasetManifestEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [data, setData] = useState<RecordingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [mode, setMode] = useState<Mode>("scene");
  // Owned here, shared with the audio element, the particle field, and the panels so they
  // all read playback time directly (60fps) instead of via slow React state.
  const audioRef = useRef<HTMLAudioElement>(null);

  // Discover every exported dataset (Audio Source Switch). Each export script upserts
  // itself into this manifest via tools/lib/manifest.js -- sample audio, real field
  // recordings, diagnostics all show up automatically, no hardcoded paths here.
  useEffect(() => {
    fetch("/data/manifest.json")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`manifest: ${response.status}`))))
      .then((entries: DatasetManifestEntry[]) => {
        setDatasets(entries);
        const requested = new URLSearchParams(window.location.search).get("dataset");
        const preferred = entries.find((e) => e.id === requested) ?? entries.find((e) => e.id === "sample") ?? entries[0];
        if (preferred) setActiveId(preferred.id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const entry = datasets.find((d) => d.id === activeId);
    if (!entry) return;
    setCurrentTime(0);
    fetch(entry.path)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load dataset: ${response.status}`);
        return response.json();
      })
      .then((payload: RecordingPayload) => setData(payload))
      .catch((err: Error) => setError(err.message));
  }, [activeId, datasets]);

  // The 3D view reveals points itself (in-shader, by emissionTime), so it doesn't need
  // this. The Centroid-Amplitude scatter still reveals progressively via currentTime.
  const visiblePoints = useMemo(
    () => (data ? data.points.filter((point) => point.emissionTime <= currentTime) : []),
    [data, currentTime],
  );

  const scatterDomain = useMemo(() => ({ centroidMaxHz: data?.centroidMaxHz ?? 1 }), [data]);

  return (
    <div className="viewer">
      <div className="overlay">
        {/* Behavior mode has its own header + per-recording audio, and Upload brings its
            own file + player, so the single-recording title/player/legend are hidden in
            both -- only the mode toggle stays. */}
        {mode !== "behavior" && mode !== "upload" && (
          <>
            <h1>Bird Song Acoustic Manifold</h1>
            <p>
              {data
                ? `${data.audioId} — ${data.pointCount} points · ${Math.round(data.sampleRate / 1000)}kHz / ${data.fftSize}-FFT · ${data.durationSeconds.toFixed(0)}s`
                : error
                  ? error
                  : "Loading dataset…"}
            </p>
            {data && <AudioPlayer key={data.audioId} src={data.audioUrl} audioRef={audioRef} onTimeChange={setCurrentTime} />}
          </>
        )}
        {data && (mode === "scene" || mode === "scene2") && <CentroidLegend maxHz={data.centroidMaxHz} />}
        {data && mode === "scene" && (
          <div className="overlay-panels">
            <CentroidAmplitudePanel points={visiblePoints} domain={scatterDomain} total={data.pointCount} />
            <SpectrogramPanel panels={data.panels} audioRef={audioRef} maxHz={displayMaxHz(data)} />
            <ChromagramPanel panels={data.panels} audioRef={audioRef} />
          </div>
        )}
      </div>

      {/* Top-center nav: audio source switch + mode toggle, always reachable regardless of mode. */}
      <div className="top-nav">
        {mode !== "behavior" && mode !== "upload" && (
          <AudioSourceSwitch datasets={datasets} activeId={activeId} onChange={setActiveId} />
        )}
        <div className="mode-toggle">
          {/* "Sample 2" is the same dataset through the v2 renderer, kept as its own tab so
              the original 3D Scene stays available side by side for comparison. */}
          <button className={mode === "scene" ? "active" : ""} disabled={!data} onClick={() => setMode("scene")}>
            3D Scene
          </button>
          <button className={mode === "scene2" ? "active" : ""} disabled={!data} onClick={() => setMode("scene2")}>
            Sample 2
          </button>
          <button className={mode === "sandbox" ? "active" : ""} disabled={!data} onClick={() => setMode("sandbox")}>
            Sandbox
          </button>
          <button className={mode === "behavior" ? "active" : ""} onClick={() => setMode("behavior")}>
            Behavior
          </button>
          {/* Analyzes a file the offline generator has never seen, in this tab. */}
          <button className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}>
            Upload
          </button>
        </div>
      </div>

      {data && mode === "scene" && (
        <>
          <Canvas key={data.audioId} camera={{ position: [8, 5, 9], fov: 52 }} dpr={[1, 2]}>
            <color attach="background" args={["#04050a"]} />
            <ParticleField payload={data} audioRef={audioRef} />
            <OrbitControls enableDamping dampingFactor={0.08} autoRotate autoRotateSpeed={0.5} enablePan={false} />
          </Canvas>

          <div className="side-panels">
            <SpectralDescriptorsPanel panels={data.panels} baseline={data.spectralDescriptors} audioRef={audioRef} />
          </div>

          <div className="multiscale">
            <div className="multiscale-title">MULTI-SCALE ANALYSIS</div>
            <div className="species-caption">{data.commonName}</div>
          </div>
        </>
      )}

      {data && mode === "scene2" && (
        <CloudSceneV2 payload={data} audioRef={audioRef} sceneKey={data.audioId} caption={data.commonName} />
      )}

      {data && mode === "sandbox" && <SandboxGallery payload={data} audioRef={audioRef} />}

      {mode === "behavior" && <BehaviorMode />}

      {mode === "upload" && <UploadMode />}
    </div>
  );
}

export default App;
