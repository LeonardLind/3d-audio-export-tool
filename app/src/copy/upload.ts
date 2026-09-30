import type { CopyEntry } from './define.ts';

export const UPLOAD_COPY = {
  choose: { id: 'upload.choose', en: 'Analyse a file', basis: { kind: 'control' } },
  browser: { id: 'upload.browser', en: 'Decoded and resampled in this browser.', basis: { kind: 'definition', path: 'app/src/analysis/decodeAudio.ts' } },
  download: { id: 'upload.download', en: 'Download analysis (JSON)', basis: { kind: 'control' } },
} satisfies Record<string, CopyEntry>;
