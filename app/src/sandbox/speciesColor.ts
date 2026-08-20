// Deterministic categorical color per species name, shared by every BirdNET overlay
// (Detection Timeline, Pitch Trajectory bands, Syllable Constellation rings) so the same
// species always reads as the same color across cards.
const PALETTE = [
  "#4ade80", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa",
  "#fb7185", "#34d399", "#facc15", "#60a5fa", "#f97316",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function speciesColor(scientificName: string): string {
  return PALETTE[hashString(scientificName) % PALETTE.length];
}
