export type CopyBasis =
  | { kind: 'control' }
  | { kind: 'status' }
  | { kind: 'definition'; path: string }
  | { kind: 'verbatim'; notebook: string; line: number }
  | { kind: 'gated'; feature: string };

export interface CopyEntry { id: string; en: string; basis: CopyBasis }

export function t(entry: CopyEntry): string { return entry.en; }
