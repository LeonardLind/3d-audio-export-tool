// Offline bioacoustic feature extraction for the experimental visualization sandbox.
// Kept as a standalone module (not tangled into the export script or the 3D renderer) so
// individual analyses can be added/removed/refined independently. Everything here is
// derived from the whole-recording STFT that the export pipeline already computes -- no
// second FFT, all offline, per 06_Technical_Architecture.
//
// NONE of this drives the D-010 raw-spectrogram->PCA 3D position. It is all supplementary
// analysis for the sandbox gallery. Each function returns plain, rounded JSON-friendly
// data plus enough metadata for the UI to label it honestly.

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// --- Fundamental frequency (pitch) via Harmonic Product Spectrum ------------------------
// HPS multiplies the spectrum by downsampled copies of itself (harmonics 2,3): the true
// fundamental reinforces across harmonics while noise does not. Rough but standard; good
// enough for a pitch-contour prototype. Voicing = normalized HPS peak strength gated by
// frame loudness, so silent/noisy frames read as "unvoiced".
function estimatePitch(spectra, frameRms, freqPerBin, minHz, maxHz) {
  const bins = spectra[0].length;
  const minBin = Math.max(1, Math.floor(minHz / freqPerBin));
  const maxBin = Math.min(Math.floor(bins / 3), Math.ceil(maxHz / freqPerBin));

  const hz = new Array(spectra.length).fill(0);
  const rawStrength = new Array(spectra.length).fill(0);
  for (let t = 0; t < spectra.length; t += 1) {
    const spectrum = spectra[t];
    let bestBin = minBin;
    let bestVal = -1;
    for (let b = minBin; b <= maxBin; b += 1) {
      const product = spectrum[b] * (spectrum[2 * b] || 0) * (spectrum[3 * b] || 0);
      if (product > bestVal) {
        bestVal = product;
        bestBin = b;
      }
    }
    hz[t] = bestBin * freqPerBin;
    rawStrength[t] = Math.cbrt(Math.max(0, bestVal)); // tame the triple-product scale
  }

  const maxStrength = Math.max(1e-9, ...rawStrength);
  const maxRms = Math.max(1e-9, ...frameRms);
  const voicing = rawStrength.map((s, t) => round(Math.min(1, (s / maxStrength) * (frameRms[t] / maxRms) ** 0.5), 3));
  return {
    minHz,
    maxHz,
    hz: hz.map((v) => Math.round(v)),
    voicing,
  };
}

// --- Syllable segmentation --------------------------------------------------------------
// Amplitude-envelope thresholding: mark frames above a relative RMS threshold as "active",
// merge short gaps, drop too-short blips. This is the classic energy-based baseline (WP1
// D-009); a learned segmenter like TweetyNet would be more robust, but this is honest and
// transparent for a prototype. Returns per-syllable timing + peak frequency + gaps.
//
// Threshold fix (2026-07-24, real-field-recording benchmark): originally "18% of the
// single loudest frame." On a clean, close-mic clip that's fine, but on a real field
// recording with one loud outlier transient (wind gust, handling noise, a single very
// close call), that one frame drags the whole threshold up and starves the detector --
// verified empirically: only 1.1% of frames cleared the old threshold on a 60s field
// recording with near-continuous BirdNET-confirmed calling, undersegmenting badly (5
// syllables found vs. a CSV ground truth implying dozens). A percentile of the frame RMS
// DISTRIBUTION is robust to that one outlier the way "fraction of max" is not.
function segmentSyllables(frameRms, centroid, hopSeconds) {
  const n = frameRms.length;
  const sortedRms = frameRms.slice().sort((a, b) => a - b);
  const threshold = sortedRms[Math.floor(0.85 * (sortedRms.length - 1))];
  const minDurationFrames = Math.max(1, Math.round(0.035 / hopSeconds));
  const maxGapFrames = Math.max(1, Math.round(0.06 / hopSeconds));

  const active = frameRms.map((v) => v > threshold);
  // Merge short gaps.
  let gap = 0;
  for (let i = 0; i < n; i += 1) {
    if (!active[i]) {
      gap += 1;
    } else {
      if (gap > 0 && gap <= maxGapFrames) for (let j = i - gap; j < i; j += 1) active[j] = true;
      gap = 0;
    }
  }

  const syllables = [];
  let start = -1;
  for (let i = 0; i <= n; i += 1) {
    if (i < n && active[i] && start < 0) start = i;
    if ((i === n || !active[i]) && start >= 0) {
      const end = i;
      if (end - start >= minDurationFrames) {
        let peakRms = -1;
        let peakFrame = start;
        for (let j = start; j < end; j += 1) if (frameRms[j] > peakRms) { peakRms = frameRms[j]; peakFrame = j; }
        syllables.push({
          start: round(start * hopSeconds, 3),
          end: round(end * hopSeconds, 3),
          duration: round((end - start) * hopSeconds, 3),
          peakFreq: Math.round(centroid[peakFrame]),
          peakAmp: round(peakRms, 4),
        });
      }
      start = -1;
    }
  }

  const gaps = [];
  for (let i = 1; i < syllables.length; i += 1) gaps.push(round(syllables[i].start - syllables[i - 1].end, 3));
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const meanDuration = syllables.length ? syllables.reduce((a, s) => a + s.duration, 0) / syllables.length : 0;
  const spanSeconds = n * hopSeconds;
  return {
    syllables,
    count: syllables.length,
    meanDuration: round(meanDuration, 3),
    meanGap: round(meanGap, 3),
    repetitionRate: round(spanSeconds > 0 ? syllables.length / spanSeconds : 0, 2), // syllables/sec
  };
}

// --- Acoustic Complexity Index (ACI) ----------------------------------------------------
// Pieretti et al. 2011: within each temporal window, per frequency bin, sum the absolute
// frame-to-frame intensity changes divided by the total intensity, then sum over bins.
// High where sound varies fast (birdsong); low for steady tones/noise. Returns a per-window
// series (for a timeline) + the total.
function acousticComplexity(spectra, hopSeconds, clusterSeconds) {
  const framesPerCluster = Math.max(2, Math.round(clusterSeconds / hopSeconds));
  const bins = spectra[0].length;
  const series = [];
  let total = 0;
  for (let s = 0; s + 1 < spectra.length; s += framesPerCluster) {
    const end = Math.min(spectra.length, s + framesPerCluster);
    let aci = 0;
    for (let k = 0; k < bins; k += 1) {
      let sumDelta = 0;
      let sumIntensity = spectra[s][k];
      for (let t = s; t + 1 < end; t += 1) {
        sumDelta += Math.abs(spectra[t + 1][k] - spectra[t][k]);
        sumIntensity += spectra[t + 1][k];
      }
      if (sumIntensity > 0) aci += sumDelta / sumIntensity;
    }
    series.push({ t: round(s * hopSeconds, 2), aci: round(aci, 2) });
    total += aci;
  }
  return { series, total: round(total, 1), clusterSeconds };
}

// --- Self-similarity / recurrence matrix ------------------------------------------------
// Downsample the recording to N time points, then cosine-similarity every pair of spectra.
// Bright off-diagonal blocks = the recording repeats itself (repeated phrases/calls) -- a
// direct read on temporal structure and repetition.
function selfSimilarity(spectra, n) {
  const count = Math.min(n, spectra.length);
  const idx = Array.from({ length: count }, (_, i) => Math.round((i / (count - 1 || 1)) * (spectra.length - 1)));
  const vecs = idx.map((i) => spectra[i]);
  const norms = vecs.map((v) => {
    let s = 0;
    for (let k = 0; k < v.length; k += 1) s += v[k] * v[k];
    return Math.sqrt(s) + 1e-9;
  });
  const matrix = new Array(count * count);
  for (let a = 0; a < count; a += 1) {
    for (let b = a; b < count; b += 1) {
      let dot = 0;
      const va = vecs[a];
      const vb = vecs[b];
      for (let k = 0; k < va.length; k += 1) dot += va[k] * vb[k];
      const sim = round(dot / (norms[a] * norms[b]), 3);
      matrix[a * count + b] = sim;
      matrix[b * count + a] = sim;
    }
  }
  return { n: count, matrix, times: idx.map((i) => round(i * (spectra.length ? 1 : 0), 0)) };
}

// --- Soundscape acoustic indices + frequency-band occupancy -----------------------------
// ADI (Acoustic Diversity Index, Villanueva-Rivera et al. 2011): Shannon diversity of
// per-band occupancy. AEI (Acoustic Evenness, Gini). BI (Bioacoustic Index, Boelman et al.
// 2007): area of the mean spectrum above its minimum within a biophony band. H (Acoustic
// Entropy, Sueur et al. 2008): temporal-envelope entropy x spectral entropy. All widely
// used soundscape-ecology summaries. Also returns per-band occupancy for a bar/heatmap.
function acousticIndices(spectra, frameRms, freqPerBin, sampleRate, bandCount) {
  const bins = spectra[0].length;
  const nyquist = sampleRate / 2;
  const frames = spectra.length;

  const meanSpectrum = new Array(bins).fill(0);
  for (const spectrum of spectra) for (let k = 0; k < bins; k += 1) meanSpectrum[k] += spectrum[k] / frames;

  const bands = [];
  for (let band = 0; band < bandCount; band += 1) {
    const loHz = (band / bandCount) * nyquist;
    const hiHz = ((band + 1) / bandCount) * nyquist;
    const loBin = Math.max(1, Math.floor(loHz / freqPerBin));
    const hiBin = Math.min(bins, Math.ceil(hiHz / freqPerBin));
    const energyByFrame = new Array(frames);
    for (let t = 0; t < frames; t += 1) {
      let energy = 0;
      for (let k = loBin; k < hiBin; k += 1) energy += spectra[t][k];
      energyByFrame[t] = energy;
    }
    // Threshold fix (2026-07-24, real-field-recording benchmark): "20% of this band's own
    // peak" saturated to ~100% occupancy on every band above 1.1kHz on a real 60s field
    // recording -- verified empirically. On a genuinely noisy recording the ambient floor
    // rarely drops far below the single loudest moment, so a peak-relative threshold stops
    // discriminating exactly when it matters most. Comparing against the band's own MEDIAN
    // instead asks "how much louder than this band's typical moment," which stays
    // meaningful whether the recording is quiet/clean or loud/noisy.
    const sortedEnergy = energyByFrame.slice().sort((a, b) => a - b);
    const median = sortedEnergy[Math.floor(0.5 * (sortedEnergy.length - 1))] + 1e-9;
    const threshold = median * 1.8;
    let activeFrames = 0;
    let energySum = 0;
    for (let t = 0; t < frames; t += 1) {
      if (energyByFrame[t] > threshold) activeFrames += 1;
      energySum += energyByFrame[t];
    }
    bands.push({
      loHz: Math.round(loHz),
      hiHz: Math.round(hiHz),
      occupancy: round(activeFrames / frames, 3),
      meanEnergy: round(energySum / frames, 3),
    });
  }

  const proportions = bands.map((b) => b.occupancy);
  const propSum = proportions.reduce((a, b) => a + b, 0) || 1;
  const normalized = proportions.map((p) => p / propSum);
  const adi = -normalized.reduce((s, p) => (p > 0 ? s + p * Math.log(p) : s), 0);

  const sorted = [...proportions].sort((a, b) => a - b);
  const sortedSum = sorted.reduce((a, b) => a + b, 0);
  let giniAccum = 0;
  for (let i = 0; i < sorted.length; i += 1) giniAccum += (2 * (i + 1) - sorted.length - 1) * sorted[i];
  const aei = sortedSum > 0 ? round(giniAccum / (sorted.length * sortedSum), 3) : 0;

  const loBI = Math.max(1, Math.floor(2000 / freqPerBin));
  const hiBI = Math.min(bins, Math.ceil(8000 / freqPerBin));
  const biSegment = [];
  for (let k = loBI; k < hiBI; k += 1) biSegment.push(10 * Math.log10(meanSpectrum[k] + 1e-9));
  const minDb = Math.min(...biSegment);
  const bi = biSegment.reduce((s, db) => s + (db - minDb), 0) * (freqPerBin / 1000);

  const specSum = meanSpectrum.reduce((a, b) => a + b, 0) || 1;
  const hf = -meanSpectrum.reduce((s, v) => {
    const p = v / specSum;
    return p > 0 ? s + p * Math.log(p) : s;
  }, 0) / Math.log(bins);
  const envSum = frameRms.reduce((a, b) => a + b, 0) || 1;
  const ht = -frameRms.reduce((s, v) => {
    const p = v / envSum;
    return p > 0 ? s + p * Math.log(p) : s;
  }, 0) / Math.log(frameRms.length);

  return {
    bands,
    adi: round(adi, 3),
    aei,
    bi: round(bi, 2),
    entropyH: round(ht * hf, 3),
    entropyTemporal: round(ht, 3),
    entropySpectral: round(hf, 3),
  };
}

function buildAnalysis({ spectra, frameSeries, hopSeconds, sampleRate, fftSize }) {
  if (!spectra.length) return null;
  const freqPerBin = sampleRate / fftSize;
  const durationSeconds = spectra.length * hopSeconds;
  // Self-similarity resolution scales with recording length: a fixed 100x100 (0.6s/cell
  // on a 60s clip) is coarser than warranted once recordings get longer than the ~15s
  // clip this was first tuned on. Floor keeps short clips at least as sharp as before;
  // cap bounds compute (O(n^2)) on long recordings.
  const selfSimilarityN = Math.min(220, Math.max(100, Math.round(durationSeconds * 4)));
  return {
    pitch: estimatePitch(spectra, frameSeries.rms, freqPerBin, 80, 5000),
    syllables: segmentSyllables(frameSeries.rms, frameSeries.centroid, hopSeconds),
    aci: acousticComplexity(spectra, hopSeconds, 1),
    selfSimilarity: selfSimilarity(spectra, selfSimilarityN),
    indices: acousticIndices(spectra, frameSeries.rms, freqPerBin, sampleRate, 10),
    hopSeconds,
  };
}

module.exports = { buildAnalysis };
