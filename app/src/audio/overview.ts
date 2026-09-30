export interface OverviewColumn { min: number; max: number }

// Columns partition [0, samples.length) exactly; no sample belongs to two columns.
export function overviewColumns(samples: ArrayLike<number>, requestedColumns: number): OverviewColumn[] {
  if (!Number.isInteger(requestedColumns) || requestedColumns < 1) throw new RangeError('columns must be a positive integer');
  if (samples.length === 0) return [];
  const count = Math.min(requestedColumns, samples.length);
  const columns: OverviewColumn[] = [];
  for (let c = 0; c < count; c += 1) {
    const start = Math.floor(c * samples.length / count);
    const end = Math.floor((c + 1) * samples.length / count);
    let min = Infinity;
    let max = -Infinity;
    for (let i = start; i < end; i += 1) {
      const value = samples[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    columns.push({ min, max });
  }
  return columns;
}
