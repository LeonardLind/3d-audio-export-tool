import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { PanelSeries } from "../types";

// Maps live playback time to the current panel-frame index at ~display rate, but only
// triggers a React re-render when the index actually changes (≤ ~43/sec at a 23ms hop).
// Lets SVG/HTML panels animate in sync with the audio without a per-rAF-frame state pump.
export function useCurrentFrame(panels: PanelSeries, audioRef: RefObject<HTMLAudioElement | null>): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let raf = 0;
    const lastFrame = panels.frames.length - 1;
    const tick = () => {
      const t = audioRef.current?.currentTime ?? 0;
      const index = Math.min(lastFrame, Math.max(0, Math.round(t / panels.hopSeconds)));
      setFrame((prev) => (prev === index ? prev : index));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [panels, audioRef]);
  return frame;
}
