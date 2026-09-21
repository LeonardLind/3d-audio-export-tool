import { useState } from "react";
import type { RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ParticleField } from "../components/ParticleField";
import { ParticleFieldV2 } from "../components/ParticleFieldV2";
import {
  LABEL_VALUE_LABEL,
  LABEL_VALUE_NOTE,
  SIZE_LEAD,
  SIZE_MODE_LABEL,
  SIZE_MODE_NOTE,
  type LabelValue,
  type SizeMode,
} from "../components/cloudChannels";
import { CLOUD_STYLES, DEFAULT_VERSION, cloudStyle, type CloudVersionId } from "../components/cloudStyles";
import type { CloudPayload } from "../types";

// The 3D manifold plus the controls for how it is drawn. Shared by the "Sample 2" tab (an
// exported dataset) and the "Upload" tab (a clip analysed in the browser), because both
// hand it the same two arrays.
//
// VERSION picks which look to draw, from cloudStyles.ts. Every version the cloud has had
// stays selectable: nothing is replaced when a new one is added, so comparing v0.4 against
// v0.2 is two clicks and reverting is one. v0.1 routes to the original ParticleField
// component rather than the parameterised renderer, so it stays exactly as it was.

const SIZE_MODES: SizeMode[] = ["energy", "amplitude", "legacy"];
const LABEL_VALUES: LabelValue[] = ["centroid", "dominant", "amplitude", "flux", "time", "none"];
const LABEL_COUNTS = [15, 40, 80, 1000];

// What the exported view file carries, and what it deliberately leaves out.
//
// Five fields were 431 KB of the 555 KB this export used to weigh, and not one of them is
// drawn by anything that reads this file. Each backs a panel that lives HERE, in this app,
// and those panels are fed by the live pipeline output in memory -- never by a re-imported
// view file, because there is no JSON import path (Upload mode takes audio, decodes it, and
// analyses it in the browser). So dropping them costs this app nothing at all:
//
//   panels.frames             285 KB  the Time Window spectrogram
//   analysis.selfSimilarity    57 KB  the self-similarity matrix
//   panels.descriptors         45 KB  the radar's instantaneous ("LIVE") shape
//   panels.chroma              42 KB  the Chromagram
//   birdnetDetections           2 KB  BirdNET's identification
//
// The reader this file exists for is Green Cubes' acoustics screen, which draws the 3D
// cloud, its similarity threads, the peak-frequency labels and the spectral-centroid
// legend. It has no spectrogram, chromagram or radar panel, and it does not want BirdNET's
// guess -- the species is already chosen from the IUCN record at upload time by the person
// who recorded the bird, so an automated guess beside it would only be a second, worse
// answer to a question already settled.
//
// Why it matters that this is small: the file is fetched from S3 by every visitor who opens
// a bird, so its size is a page-weight cost paid per visit rather than a disk cost paid
// once. Minified and trimmed it is ~122 KB against the 1.49 MB this export originally
// produced.
//
// What is deliberately KEPT even though nothing draws it yet, because it is cheap and it is
// the obvious next panel: `panels.centroidTrack` (3 KB, the red line over the Time Window
// spectrogram -- the time-domain view of the exact quantity the cloud is already coloured
// by), plus `analysis.syllables`, `analysis.pitch`, `analysis.indices` and `analysis.aci`,
// which together come to 8.5 KB and are the most bird-specific numbers in the payload.
//
// If a reader ever does need a dropped field, re-export from here with it restored rather
// than reconstructing it -- all five are pipeline output, not derived values.
const OMITTED_PANEL_FIELDS = ["frames", "chroma", "descriptors", "descriptorRanges"] as const;
const OMITTED_ANALYSIS_FIELDS = ["selfSimilarity"] as const;

function buildExportCloud(payload: CloudPayload): CloudPayload {
  // Shallow copies with the heavy fields deleted: the nested arrays that survive are shared
  // with the live payload rather than cloned, so exporting never duplicates the cloud in
  // memory. Safe because nothing here mutates them and JSON.stringify only reads.
  const cloud = { ...payload } as Record<string, unknown>;
  delete cloud.birdnetDetections;

  const panels = payload.panels as Record<string, unknown> | undefined;
  if (panels) {
    const trimmed = { ...panels };
    for (const field of OMITTED_PANEL_FIELDS) delete trimmed[field];
    cloud.panels = trimmed;
  }

  const analysis = (payload as Record<string, unknown>).analysis as
    | Record<string, unknown>
    | undefined;
  if (analysis) {
    const trimmed = { ...analysis };
    for (const field of OMITTED_ANALYSIS_FIELDS) delete trimmed[field];
    cloud.analysis = trimmed;
  }

  return cloud as unknown as CloudPayload;
}

export function CloudSceneV2({
  payload,
  audioRef,
  sceneKey,
  caption,
}: {
  payload: CloudPayload;
  audioRef: RefObject<HTMLAudioElement | null>;
  // Remounts the Canvas when the underlying recording changes, so nothing carries over.
  sceneKey: string;
  caption: string;
}) {
  const [version, setVersion] = useState<CloudVersionId>(DEFAULT_VERSION);
  const [sizeMode, setSizeMode] = useState<SizeMode>("energy");
  const [labelValue, setLabelValue] = useState<LabelValue>("centroid");
  const [labelCount, setLabelCount] = useState(40);
  const [showEdges, setShowEdges] = useState(true);

  const style = cloudStyle(version);
  const downloadCurrentView = () => {
    // Keep the cloud data and the chosen presentation together, so this file can
    // recreate the cloud a collaborator was looking at -- minus the panel data
    // listed below, which no reader of this file draws. See buildExportCloud.
    const exportPayload = {
      kind: "birdsong-cloud-view",
      exportedAt: new Date().toISOString(),
      caption,
      displaySettings: {
        version,
        sizeMode,
        labelValue,
        labelCount,
        showEdges,
      },
      styleDefinition: style,
      cloud: buildExportCloud(payload),
    };
    // Minified, not pretty-printed. This file is fetched by a viewer per visit
    // (Green Cubes' acoustics screen reads it to draw the cloud), and the
    // indentation was 63% of its bytes -- 1.49 MB of whitespace-inflated JSON
    // against 555 KB of the same numbers. Nothing here is meant to be read by
    // eye, and any editor will re-format it on demand.
    const blob = new Blob([JSON.stringify(exportPayload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${caption.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "birdsong"}-cloud-view.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  // v0.1 predates all three display-channel controls -- it has its own size mapping, its
  // own thread colouring and no numbers at all -- so they are disabled rather than left
  // looking as though they do something.
  const original = style.original === true;
  const labelled = labelValue === "none" ? 0 : Math.min(labelCount, payload.points.length);

  return (
    <>
      <Canvas key={sceneKey} camera={{ position: [8, 5, 9], fov: 52 }} dpr={[1, 2]}>
        <color attach="background" args={["#04050a"]} />
        {original ? (
          <ParticleField payload={payload} audioRef={audioRef} />
        ) : (
          <ParticleFieldV2
            payload={payload}
            audioRef={audioRef}
            style={style}
            sizeMode={sizeMode}
            labelValue={labelValue}
            labelCount={labelCount}
            showEdges={showEdges}
          />
        )}
        <OrbitControls enableDamping dampingFactor={0.08} autoRotate autoRotateSpeed={0.5} enablePan={false} />
      </Canvas>

      <div className="side-panels">
        <div className="panel cloud-controls">
          <div className="panel-head">
            <h2>Display channels</h2>
          </div>

          <div className="control-row">
            <span className="control-label">VERSION</span>
            <div className="control-buttons">
              {CLOUD_STYLES.map((candidate) => (
                <button
                  key={candidate.id}
                  className={candidate.id === version ? "active" : ""}
                  onClick={() => setVersion(candidate.id)}
                  title={candidate.name}
                >
                  {candidate.id}
                </button>
              ))}
            </div>
          </div>
          <p className="panel-note">
            <strong>{style.name}.</strong> {style.note}
          </p>

          <div className="control-row">
            <span className="control-label">SIZE</span>
            <div className="control-buttons">
              {SIZE_MODES.map((mode) => (
                <button
                  key={mode}
                  className={mode === sizeMode ? "active" : ""}
                  disabled={original}
                  onClick={() => setSizeMode(mode)}
                >
                  {SIZE_MODE_LABEL[mode]}
                </button>
              ))}
            </div>
          </div>
          <p className="panel-note">
            <strong>{SIZE_LEAD}</strong> {SIZE_MODE_NOTE[sizeMode]}
          </p>

          <div className="control-row">
            <span className="control-label">NUMBER</span>
            <div className="control-buttons">
              {LABEL_VALUES.map((value) => (
                <button
                  key={value}
                  className={value === labelValue ? "active" : ""}
                  disabled={original}
                  onClick={() => setLabelValue(value)}
                >
                  {LABEL_VALUE_LABEL[value]}
                </button>
              ))}
            </div>
          </div>
          <p className="panel-note">{LABEL_VALUE_NOTE[labelValue]}</p>

          <div className="control-row">
            <span className="control-label">LABELS</span>
            <div className="control-buttons">
              {LABEL_COUNTS.map((count) => (
                <button
                  key={count}
                  className={count === labelCount ? "active" : ""}
                  disabled={original || labelValue === "none"}
                  onClick={() => setLabelCount(count)}
                >
                  {count >= payload.points.length ? "all" : count}
                </button>
              ))}
            </div>
          </div>
          <p className="panel-note">
            How many points get a number. Only the {labelled} loudest of {payload.points.length} are offered one —
            numbering all of them would be an unreadable pile. If two would overlap, the quieter one&apos;s number is
            hidden rather than drawn half-covered, so rotating the cloud shows you a slightly different set.
          </p>

          <div className="control-row">
            <span className="control-label">THREADS</span>
            <div className="control-buttons">
              <button className={showEdges ? "active" : ""} disabled={original} onClick={() => setShowEdges(true)}>
                on
              </button>
              <button className={!showEdges ? "active" : ""} disabled={original} onClick={() => setShowEdges(false)}>
                off
              </button>
            </div>
          </div>
          <p className="panel-note">
            <strong>A thread joins two moments that sound alike.</strong> Not two moments that happen next to each other
            — they have to be at least 1.5 s apart, so a thread means the sound genuinely came back rather than simply
            carried on. From v0.2 each one fades from the colour of the ball at one end to the colour at the other, so
            you can see which two it links. {payload.similarityEdges.length} of them here.
          </p>

          <button className="cloud-download" onClick={downloadCurrentView}>
            Download view JSON
          </button>
          <p className="panel-note cloud-download-note">
            Saves this sound&apos;s cloud data, the selected display settings, and the complete {version.toUpperCase()} style definition.
          </p>
        </div>
      </div>

      <div className="multiscale">
        <div className="multiscale-title">MULTI-SCALE ANALYSIS · {version.toUpperCase()}</div>
        <div className="species-caption">{caption}</div>
      </div>
    </>
  );
}
