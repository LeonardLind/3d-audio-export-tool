import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CategoryObject } from "./CategoryObject";
import type { BehaviorCategory, BehaviorRecording } from "../types";

// Compare Mode: renders the category average-shapes together in one shared 3D scene so you
// can see where behavioural categories overlap and where they separate. Each category can
// be toggled on/off and faded independently; the scene rotates/pans/zooms; Reset restores
// camera + visibility. Reuses the same CategoryObject as the overview so the shapes are
// identical, just overlaid.
export function CompareScene({
  categories,
  recordingsByCat,
}: {
  categories: BehaviorCategory[];
  recordingsByCat: Map<string, BehaviorRecording[]>;
}) {
  const withShapes = useMemo(() => categories.filter((c) => c.ellipsoidMatrix && c.count > 0), [categories]);
  const pointsByCat = useMemo(() => {
    const map = new Map<string, [number, number, number][]>();
    for (const c of withShapes) map.set(c.id, (recordingsByCat.get(c.id) ?? []).flatMap((r) => r.points));
    return map;
  }, [withShapes, recordingsByCat]);

  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(withShapes.map((c) => [c.id, true])));
  const [opacity, setOpacity] = useState<Record<string, number>>(() => Object.fromEntries(withShapes.map((c) => [c.id, 1])));
  const [showClouds, setShowClouds] = useState(true);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  const reset = () => {
    setVisible(Object.fromEntries(withShapes.map((c) => [c.id, true])));
    setOpacity(Object.fromEntries(withShapes.map((c) => [c.id, 1])));
    setShowClouds(true);
    controlsRef.current?.reset();
  };

  return (
    <div className="compare-wrap">
      <Canvas camera={{ position: [9, 6, 9], fov: 52 }} dpr={[1, 2]} className="compare-canvas">
        <color attach="background" args={["#05060a"]} />
        {withShapes.map((cat) =>
          visible[cat.id] ? (
            <CategoryObject
              key={cat.id}
              points={pointsByCat.get(cat.id) ?? []}
              color={cat.color}
              ellipsoidMatrix={cat.ellipsoidMatrix}
              opacity={opacity[cat.id]}
              showCloud={showClouds}
            />
          ) : null,
        )}
        <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} />
      </Canvas>

      <div className="compare-controls">
        <div className="compare-controls-head">
          <span>Categories</span>
          <button className="reset-btn" onClick={reset}>
            Reset
          </button>
        </div>
        {withShapes.map((cat) => (
          <div className={`compare-cat ${visible[cat.id] ? "" : "off"}`} key={cat.id}>
            <button className="compare-cat-toggle" onClick={() => setVisible((v) => ({ ...v, [cat.id]: !v[cat.id] }))}>
              <span className="compare-swatch" style={{ background: cat.color, opacity: visible[cat.id] ? 1 : 0.25 }} />
              <span className="compare-cat-name">{cat.name}</span>
              <span className="compare-cat-count">{cat.count}</span>
            </button>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={opacity[cat.id]}
              disabled={!visible[cat.id]}
              onChange={(e) => setOpacity((o) => ({ ...o, [cat.id]: Number(e.target.value) }))}
              style={{ accentColor: cat.color }}
            />
          </div>
        ))}
        <label className="compare-clouds">
          <input type="checkbox" checked={showClouds} onChange={(e) => setShowClouds(e.target.checked)} />
          show point clouds
        </label>
        <p className="compare-hint">drag to rotate · scroll to zoom · right-drag to pan</p>
      </div>
    </div>
  );
}
