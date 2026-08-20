import { useEffect, useMemo, useState } from "react";
import { BehaviorOverview } from "./BehaviorOverview";
import { CompareScene } from "./CompareScene";
import type { BehaviorComparison, BehaviorRecording } from "../types";

const FEATURE_LABELS: Record<string, string> = {
  dur: "duration (s)",
  repRate: "repetition rate",
  syllDur: "syllable length (s)",
  gap: "note spacing (s)",
  aciPerSec: "acoustic complexity",
  centroid: "pitch height (Hz)",
  centroidRange: "frequency range (Hz)",
  bandwidth: "bandwidth (Hz)",
  flatness: "noisiness",
  entropy: "spectral entropy",
  flux: "spectral flux",
  zcr: "zero-crossing rate",
  voicedFrac: "tonal fraction",
  pitchRange: "pitch range (Hz)",
};

// Detail panel for a clicked recording: its acoustic classification (with the honest,
// hedged framing), the full 4-way score breakdown, the top acoustic drivers, the
// recordist's independent tag, and an audio player so a non-expert can listen to why it
// landed where it did.
function RecordingDetail({ rec, onClose }: { rec: BehaviorRecording; onClose: () => void }) {
  return (
    <div className="rec-detail">
      <button className="rec-detail-close" onClick={onClose}>
        ×
      </button>
      <div className="rec-detail-head">
        <span className="rec-detail-id">{rec.xenoCantoId}</span>
        <a href={rec.sourceUrl} target="_blank" rel="noreferrer" className="rec-detail-src">
          xeno-canto ↗
        </a>
      </div>
      <p className="rec-detail-verdict">
        Behavioral classification: <strong>{rec.categoryName}</strong> — confidence {Math.round(rec.confidence * 100)}%
      </p>
      <p className="rec-detail-note">
        Exploratory acoustic estimate, not a definitive behaviour. Driven by: {rec.drivers.join(", ") || "—"}. Recordist
        tagged this recording as <strong>“{rec.xcType}”</strong>.
      </p>
      <div className="rec-detail-scores">
        {rec.scores.map((s) => (
          <div className="rec-detail-score" key={s.id}>
            <span>{s.name}</span>
            <span className="rec-detail-bar">
              <span style={{ width: `${s.probability * 100}%` }} />
            </span>
            <span className="rec-detail-pct">{Math.round(s.probability * 100)}%</span>
          </div>
        ))}
      </div>
      <audio src={rec.audioUrl} controls className="rec-detail-audio" />
      <div className="rec-detail-features">
        {Object.entries(rec.features).map(([k, v]) => (
          <div key={k}>
            <dt>{FEATURE_LABELS[k] ?? k}</dt>
            <dd>{v >= 100 ? Math.round(v) : v}</dd>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BehaviorMode() {
  const [data, setData] = useState<BehaviorComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "compare">("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/behavior_comparison.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`behavior data: ${r.status}`))))
      .then((payload: BehaviorComparison) => setData(payload))
      .catch((err: Error) => setError(err.message));
  }, []);

  const recordingsByCat = useMemo(() => {
    const map = new Map<string, BehaviorRecording[]>();
    if (!data) return map;
    for (const r of data.recordings) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return map;
  }, [data]);

  const selected = useMemo(() => data?.recordings.find((r) => r.id === selectedId) ?? null, [data, selectedId]);

  if (error) return <div className="behavior-mode"><p className="behavior-error">Could not load behavior data: {error}. Run <code>npm run behavior</code>.</p></div>;
  if (!data) return <div className="behavior-mode"><p>Loading behavior comparison…</p></div>;

  return (
    <div className="behavior-mode">
      <div className="behavior-header">
        <div>
          <h2>Vocalization Behavior Comparison</h2>
          <p className="behavior-sub">
            {data.recordingCount} recordings of <em>{data.species}</em> · shared-PCA feature space (
            {Math.round(data.sharedPcaExplainedVariance * 100)}% variance)
          </p>
        </div>
        <div className="behavior-viewtoggle">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            Overview
          </button>
          <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>
            Compare
          </button>
        </div>
      </div>

      <p className="behavior-framing">
        <strong>Exploratory.</strong> Categories are assigned by a transparent acoustic heuristic (not a trained model,
        no ground-truth labels); confidence is a softened score, never a claim of certainty. All recordings are the same
        species, so most cluster in song-related categories. “Recordist tag” is the independent Xeno-canto label, shown
        as a cross-check. Goal: explore whether behavioural categories form <em>distinguishable</em> shapes in our
        feature space — not to assert what any bird was doing.
      </p>

      {view === "overview" ? (
        <BehaviorOverview categories={data.categories} recordingsByCat={recordingsByCat} onSelect={setSelectedId} selectedId={selectedId} />
      ) : (
        <CompareScene categories={data.categories} recordingsByCat={recordingsByCat} />
      )}

      {selected && view === "overview" && <RecordingDetail rec={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
