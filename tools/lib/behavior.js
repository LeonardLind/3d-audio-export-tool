// EXPERIMENTAL behavioral classification of bird vocalizations from acoustic features.
//
// SCIENTIFIC FRAMING (read this before trusting any output): mapping acoustics -> behaviour
// is genuinely hard and context/species dependent. There is NO ground-truth behaviour label
// for these recordings. This is a TRANSPARENT, RULE-BASED heuristic scorer -- deliberately
// not a black-box trained model -- so every classification can be explained by which
// measured features drove it. It encodes broad, literature-informed acoustic tendencies of
// four ethological categories; it is exploratory and must never be presented as definitive
// ("Behavioral classification: Territorial — 72% confidence", never "this bird is angry").
//
// The categories and their acoustic rationale (see 08_Visualization_Sandbox docs for
// sources; Catchpole & Slater, "Bird Song"; Marler; alarm-call literature):
//   Territorial/Aggressive  -> song is primarily territorial in songbirds: long, sustained,
//                              highly repeated, complex (high ACI), broad-band, tonal.
//   Mate Attraction/Courtship -> elaborate, wide pitch/frequency modulation, complex, tonal,
//                              long; acoustically OVERLAPS territorial song (in many species
//                              song serves both) -- that overlap is a real finding to surface.
//   Flock/Social/Contact    -> short, simple, frequently repeated contact notes; narrow-band,
//                              low complexity.
//   Alarm/Distress          -> harsh/broadband OR very high-frequency, noisy (high spectral
//                              flatness/entropy), abrupt (high flux/ZCR), short.
//
// Classification runs on per-recording SUMMARY features (means of the descriptor series +
// syllable/pitch/complexity stats). It is intentionally INDEPENDENT of the 3D shape: the
// acoustics drive the label, and the shared-PCA visualization then lets us explore whether
// those acoustic categories are visually distinguishable -- not the other way round.

// --- per-recording summary features ----------------------------------------------------
function mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
}

// Collapse one recording's full analysis into a flat, comparable acoustic fingerprint.
function summaryFeatures({ durationSeconds, panels, analysis }) {
  const d = panels.descriptors;
  const voicedHz = analysis.pitch.hz.filter((hz, i) => analysis.pitch.voicing[i] > 0.15 && hz > 0);
  return {
    dur: durationSeconds,
    repRate: analysis.syllables.repetitionRate,
    syllDur: analysis.syllables.meanDuration,
    gap: analysis.syllables.meanGap,
    aciPerSec: durationSeconds > 0 ? analysis.aci.total / durationSeconds : 0,
    centroid: mean(d.centroid),
    centroidRange: percentile(d.centroid, 0.9) - percentile(d.centroid, 0.1),
    bandwidth: mean(d.bandwidth),
    flatness: mean(d.flatness),
    entropy: mean(d.entropy),
    flux: mean(d.flux),
    zcr: mean(d.zcr),
    voicedFrac: analysis.pitch.voicing.filter((v) => v > 0.15).length / Math.max(1, analysis.pitch.voicing.length),
    pitchRange: voicedHz.length ? percentile(voicedHz, 0.9) - percentile(voicedHz, 0.1) : 0,
  };
}

// --- classifier -------------------------------------------------------------------------
const CATEGORIES = [
  {
    id: "territorial",
    name: "Territorial / Aggressive",
    weights: { aciPerSec: 1.0, repRate: 0.8, dur: 0.7, centroidRange: 0.5, flatness: -0.6 },
  },
  {
    id: "courtship",
    name: "Mate Attraction / Courtship",
    weights: { aciPerSec: 0.9, pitchRange: 1.0, bandwidth: 0.7, dur: 0.6, flatness: -0.5, repRate: -0.3 },
  },
  {
    id: "social",
    name: "Flock / Social Communication",
    weights: { repRate: 0.9, dur: -0.9, aciPerSec: -0.7, centroidRange: -0.6, bandwidth: -0.4 },
  },
  {
    id: "alarm",
    name: "Alarm / Distress",
    weights: { flatness: 0.9, entropy: 0.9, zcr: 0.8, centroid: 0.6, flux: 0.6, dur: -0.5 },
  },
];

const FEATURE_LABELS = {
  dur: "duration",
  repRate: "repetition rate",
  syllDur: "syllable length",
  gap: "note spacing",
  aciPerSec: "acoustic complexity",
  centroid: "pitch height",
  centroidRange: "frequency range",
  bandwidth: "bandwidth",
  flatness: "noisiness",
  entropy: "spectral entropy",
  flux: "spectral flux",
  zcr: "zero-crossing rate",
  voicedFrac: "tonal fraction",
  pitchRange: "pitch range",
};

// Z-normalize each feature across the whole set so category weights are comparable, then
// score each category as a weighted sum, then softmax (softened) -> a probability-like
// confidence that never asserts certainty. Also returns the top features that drove the
// winning category, so the UI can explain WHY.
function classifyAll(featureList) {
  const keys = Object.keys(featureList[0]);
  const stats = {};
  for (const k of keys) {
    const vals = featureList.map((f) => f[k]);
    const m = mean(vals);
    const sd = Math.sqrt(mean(vals.map((v) => (v - m) ** 2))) || 1;
    stats[k] = { m, sd };
  }

  return featureList.map((features) => {
    const z = {};
    for (const k of keys) z[k] = (features[k] - stats[k].m) / stats[k].sd;

    const raw = CATEGORIES.map((cat) => {
      let score = 0;
      const contributions = [];
      for (const [k, w] of Object.entries(cat.weights)) {
        const c = w * (z[k] ?? 0);
        score += c;
        contributions.push({ feature: k, label: FEATURE_LABELS[k], contribution: c });
      }
      return { id: cat.id, name: cat.name, score, contributions };
    });

    // Softmax with temperature > 1 to keep confidence honest (avoid 0.99 spikes).
    const T = 1.4;
    const maxScore = Math.max(...raw.map((r) => r.score));
    const exps = raw.map((r) => Math.exp((r.score - maxScore) / T));
    const sum = exps.reduce((s, e) => s + e, 0);
    const scores = raw.map((r, i) => ({ id: r.id, name: r.name, probability: exps[i] / sum }));
    scores.sort((a, b) => b.probability - a.probability);

    const winner = raw.find((r) => r.id === scores[0].id);
    const drivers = winner.contributions
      .filter((c) => c.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((c) => c.label);

    return {
      category: scores[0].id,
      categoryName: scores[0].name,
      confidence: Number(scores[0].probability.toFixed(3)),
      scores: scores.map((s) => ({ id: s.id, name: s.name, probability: Number(s.probability.toFixed(3)) })),
      drivers,
    };
  });
}

// --- 3x3 symmetric eigendecomposition (cyclic Jacobi) -> covariance ellipsoid -----------
function jacobiEigen3(m) {
  const a = m.map((row) => row.slice());
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const pairs = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];
  for (let sweep = 0; sweep < 60; sweep += 1) {
    let off = 0;
    for (const [p, q] of pairs) off += a[p][q] * a[p][q];
    if (off < 1e-16) break;
    for (const [p, q] of pairs) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const phi = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      for (let k = 0; k < 3; k += 1) {
        const akp = a[k][p];
        const akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k += 1) {
        const apk = a[p][k];
        const aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k += 1) {
        const vkp = v[k][p];
        const vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return { values: [a[0][0], a[1][1], a[2][2]], vectors: v };
}

// Mean + covariance of a set of 3D points -> a column-major 4x4 matrix that maps a unit
// sphere onto the (sigma-scaled) covariance ellipsoid. This IS a legitimate averaged 3D
// representation: it summarizes where the category's windows concentrate in the shared
// feature space, without needing (nonexistent) point-to-point correspondence between
// recordings. Returns null if too few points to be meaningful.
function covarianceEllipsoid(points, sigma = 1.6) {
  if (points.length < 4) return null;
  const center = [0, 1, 2].map((d) => mean(points.map((p) => p[d])));
  const cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const dx = [p[0] - center[0], p[1] - center[1], p[2] - center[2]];
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) cov[i][j] += dx[i] * dx[j];
  }
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) cov[i][j] /= points.length;

  const { values, vectors } = jacobiEigen3(cov);
  const radii = values.map((lam) => sigma * Math.sqrt(Math.max(lam, 1e-6)));
  // Column-major 4x4: columns = radius_i * eigenvector_i, translation = center.
  const col = (axis, r) => [vectors[0][axis] * r, vectors[1][axis] * r, vectors[2][axis] * r, 0];
  const matrix = [...col(0, radii[0]), ...col(1, radii[1]), ...col(2, radii[2]), ...center, 1];
  return { center, radii, matrix };
}

module.exports = { summaryFeatures, classifyAll, covarianceEllipsoid, CATEGORIES };
