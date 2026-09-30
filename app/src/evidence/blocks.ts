export function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function finiteVector(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(finite);
}

export function axisName(mask: number): string {
  return `${mask & 1 ? 'x' : ''}${mask & 2 ? 'y' : ''}${mask & 4 ? 'z' : ''}`;
}

export function viewBlock(raw: Record<string, unknown>, mask: number) {
  const views = object(raw.viewPreservation);
  const view = views && object(views[axisName(mask)]);
  if (!view || !finite(view.trustworthinessK5) || !finite(view.controlTrustworthinessK5)
    || !finite(view.marginK5) || typeof view.label !== 'string'
    || !['pass', 'fail', 'inconclusive'].includes(String(view.outcome))) return null;
  return view;
}

export function loadingBlock(value: unknown): number[][][] | null {
  return Array.isArray(value) && value.length === 3
    && value.every((axis) => Array.isArray(axis) && axis.length === 24
      && axis.every((band) => finiteVector(band, 6))) ? value as number[][][] : null;
}
