import type { DatasetManifestEntry } from "../types";

const KIND_LABEL: Record<DatasetManifestEntry["kind"], string> = {
  sample: "Sample",
  field: "Field",
  diagnostic: "Diagnostic",
};

// Lets you switch between exported datasets (sample audio vs. real field recordings vs.
// diagnostics) so every visualization -- 3D scene and sandbox alike -- can be compared
// clean-audio-vs-real-audio. Populated from app/public/data/manifest.json, which each
// export script (tools/export_*.js) upserts itself into via tools/lib/manifest.js.
export function AudioSourceSwitch({
  datasets,
  activeId,
  onChange,
}: {
  datasets: DatasetManifestEntry[];
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  if (datasets.length <= 1) return null;
  return (
    <div className="source-switch">
      {datasets.map((d) => (
        <button key={d.id} className={d.id === activeId ? "active" : ""} onClick={() => onChange(d.id)} title={d.label}>
          {KIND_LABEL[d.kind]} <span className="source-duration">{Math.round(d.durationSeconds)}s</span>
        </button>
      ))}
    </div>
  );
}
