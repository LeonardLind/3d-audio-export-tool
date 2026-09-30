import type { CopyEntry } from './define.ts';

export const UI_COPY = {
  wordmark: { id: 'ui.wordmark', en: 'ACOUSTIC CLOUD', basis: { kind: 'control' } },
  fit: { id: 'ui.fit', en: 'Fit', basis: { kind: 'control' } },
  choose: { id: 'ui.choose', en: 'Choose a recording', basis: { kind: 'control' } },
  sourceUnknown: { id: 'ui.sourceUnknown', en: 'Unknown', basis: { kind: 'status' } },
} satisfies Record<string, CopyEntry>;
