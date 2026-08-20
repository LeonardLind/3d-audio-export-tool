import type { ReactNode } from "react";

// Wrapper for each experimental visualization: title, a REAL/DEMO provenance badge, the
// viz itself, and a short description (what it shows / how it's derived / why it's useful).
// Keeps every prototype self-describing and uniformly framed so the gallery reads as a
// research sandbox rather than a finished dashboard.
export function GalleryCard({
  title,
  badge,
  children,
  description,
  wide,
}: {
  title: string;
  badge: "real" | "demo";
  children: ReactNode;
  description: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "card card-wide" : "card"}>
      <div className="card-head">
        <h3>{title}</h3>
        <span className={`badge badge-${badge}`}>{badge === "real" ? "REAL AUDIO" : "DEMO DATA"}</span>
      </div>
      <div className="card-viz">{children}</div>
      <div className="card-desc">{description}</div>
    </div>
  );
}
