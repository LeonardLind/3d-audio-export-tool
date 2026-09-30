import type { CopyEntry } from './define.ts';

export const COMPARE_COPY = {
  startsAt: { id: 'compare.startsAt', en: 'Starts at', basis: { kind: 'definition', path: 'points[].emissionTime' } },
  strongest: { id: 'compare.strongest', en: 'Strongest frequency', basis: { kind: 'definition', path: 'points[].dominantFrequencyHz' } },
  average: { id: 'compare.average', en: 'Average frequency', basis: { kind: 'definition', path: 'points[].spectralCentroidHz' } },
  strength: { id: 'compare.strength', en: 'Signal strength', basis: { kind: 'definition', path: 'points[].amplitude / max(points[].amplitude)' } },
  level: { id: 'compare.level', en: 'Level', basis: { kind: 'definition', path: 'points[].amplitude' } },
  change: { id: 'compare.change', en: 'Spectral change', basis: { kind: 'definition', path: 'points[].spectralFluxNorm' } },
  binStep: { id: 'compare.binStep', en: 'Frequency step', basis: { kind: 'definition', path: 'frequencyRange.binWidthHz' } },
  percentages: { id: 'compare.percentages', en: 'Percentages compare moments of this recording only.', basis: { kind: 'definition', path: 'points[].amplitude and points[].spectralFluxNorm' } },
  silence: { id: 'compare.silence', en: '— (digital silence)', basis: { kind: 'definition', path: 'points[].amplitude' } },
  play: { id: 'compare.play', en: 'Play', basis: { kind: 'control' } },
  stop: { id: 'compare.stop', en: 'Stop', basis: { kind: 'control' } },
  loop: { id: 'compare.loop', en: 'Loop', basis: { kind: 'control' } },
  sequence: { id: 'compare.sequence', en: 'Play A, then B', basis: { kind: 'control' } },
  sharedScale: { id: 'compare.sharedScale', en: 'Same scale for A and B', basis: { kind: 'control' } },
  multichannel: { id: 'compare.multichannel', en: 'Picture shows the channels averaged; you hear all channels.', basis: { kind: 'definition', path: 'decoded audio buffer channels' } },
  uploadListening: { id: 'compare.uploadListening', en: 'You hear the audio as it was analysed: one channel, resampled to 22.05 kHz by this browser.', basis: { kind: 'gated', feature: 'uploadListening' } },
  linked: { id: 'compare.linked', en: 'Show linked moments', basis: { kind: 'gated', feature: 'linkedMoments' } },
} satisfies Record<string, CopyEntry>;
