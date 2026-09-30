import type { CopyEntry } from './define.ts';

export const CLOUD_COPY: Record<string, CopyEntry> = {
  labelKey: { id: 'cloud.labelKey', en: 'Strongest frequency in kHz on up to 40 dots with the strongest signal. Numbers that would overlap are hidden.', basis: { kind: 'definition', path: 'src/cloud/channels.ts' } },
  colorKey: { id: 'cloud.colorKey', en: 'Average frequency (spectral centroid)', basis: { kind: 'definition', path: 'src/cloud/colorRamp.ts' } },
  sizeKey: { id: 'cloud.sizeKey', en: 'Dot size follows the signal strength of this moment within this recording.', basis: { kind: 'definition', path: 'src/cloud/channels.ts' } },
};
