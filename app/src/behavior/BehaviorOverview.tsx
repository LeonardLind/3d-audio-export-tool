import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CategoryObject } from "./CategoryObject";
import type { BehaviorCategory, BehaviorRecording } from "../types";

function MiniCategoryCanvas({ category, points }: { category: BehaviorCategory; points: [number, number, number][] }) {
  // Wrapper owns the height: r3f's Canvas sets an inline height:100% that would override a
  // class, so the fixed 150px lives on this div and the Canvas fills it.
  return (
    <div className="mini-canvas">
      <Canvas camera={{ position: [7, 4, 7], fov: 50 }} dpr={[1, 2]} style={{ width: "100%", height: "100%" }}>
        <color attach="background" args={["#06070c"]} />
        <CategoryObject points={points} color={category.color} ellipsoidMatrix={category.ellipsoidMatrix} pointSize={0.16} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.9} />
      </Canvas>
    </div>
  );
}

// Four-category overview: each card shows the category's average 3D shape (covariance
// ellipsoid) over its recordings' point cloud, the count + mean confidence, and the
// contributing recordings with per-recording confidence and the independent Xeno-canto
// recordist tag as a cross-check. Deliberately exploratory framing throughout.
export function BehaviorOverview({
  categories,
  recordingsByCat,
  onSelect,
  selectedId,
}: {
  categories: BehaviorCategory[];
  recordingsByCat: Map<string, BehaviorRecording[]>;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="behavior-grid">
      {categories.map((cat) => {
        const members = (recordingsByCat.get(cat.id) ?? []).slice().sort((a, b) => b.confidence - a.confidence);
        const points = members.flatMap((r) => r.points);
        return (
          <div className="behavior-card" key={cat.id} style={{ borderTopColor: cat.color }}>
            <div className="behavior-card-head">
              <span className="behavior-dot" style={{ background: cat.color }} />
              <h3>{cat.name}</h3>
            </div>
            <div className="behavior-card-meta">
              <span>
                <strong>{cat.count}</strong> recording{cat.count === 1 ? "" : "s"}
              </span>
              {cat.count > 0 && <span>mean confidence {Math.round(cat.meanConfidence * 100)}%</span>}
            </div>

            {cat.count > 0 ? (
              <MiniCategoryCanvas category={cat} points={points} />
            ) : (
              <div className="mini-canvas empty">no recordings classified here</div>
            )}

            <div className="behavior-reclist">
              {members.map((r) => (
                <button
                  key={r.id}
                  className={`rec-row ${selectedId === r.id ? "selected" : ""}`}
                  onClick={() => onSelect(r.id)}
                  title={`${r.recordist} — recordist tag: ${r.xcType}`}
                >
                  <span className="rec-id">
                    {r.id === cat.representativeId ? "★ " : ""}
                    {r.xenoCantoId}
                  </span>
                  <span className="rec-conf-track">
                    <span className="rec-conf-fill" style={{ width: `${r.confidence * 100}%`, background: cat.color }} />
                  </span>
                  <span className="rec-conf-val">{Math.round(r.confidence * 100)}%</span>
                  <span className="rec-xc">{r.xcType}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
