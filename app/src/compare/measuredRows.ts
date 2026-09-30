import type { CloudPoint, CloudRecording } from '../data/types.ts';
import type { MeasuredRow } from './types.ts';
import { formatDbfs, formatKHz, formatPercent, formatSeconds, roundDecimal } from '../format/number.ts';
import { COMPARE_COPY } from '../copy/compare.ts';

export function measuredRows(point: CloudPoint, recording: CloudRecording): MeasuredRow[] {
  const maxAmplitude = recording.points.reduce((max, item) => Math.max(max, item.amplitude), 0);
  const silence = point.amplitude === 0;
  const rows: MeasuredRow[] = [
    { id: 'startsAt', label: COMPARE_COPY.startsAt.en, value: formatSeconds(point.emissionTime) },
    { id: 'strongest', label: COMPARE_COPY.strongest.en, value: silence ? COMPARE_COPY.silence.en : formatKHz(point.dominantFrequencyHz) },
    { id: 'average', label: COMPARE_COPY.average.en, value: formatKHz(point.spectralCentroidHz) },
    { id: 'strength', label: COMPARE_COPY.strength.en, value: maxAmplitude > 0 ? formatPercent(point.amplitude / maxAmplitude) : COMPARE_COPY.silence.en },
  ];
  if (!silence) rows.push({ id: 'level', label: COMPARE_COPY.level.en, value: formatDbfs(point.amplitude) });
  rows.push({ id: 'change', label: COMPARE_COPY.change.en, value: formatPercent(point.spectralFluxNorm) });
  return rows;
}

export function compareFootnote(recording: CloudRecording): string {
  const binWidthHz = recording.frequencyRange?.binWidthHz ?? recording.sampleRate / recording.fftSize;
  return `${COMPARE_COPY.binStep.en}: ${roundDecimal(binWidthHz, 2)} Hz. ${COMPARE_COPY.percentages.en}`;
}
