import type { GateState } from '../evidence/types.ts';

export function AxisLoadings({ gate }: { gate?: GateState<{ rows: string[] }> }) {
  if (!gate || gate.status === 'hidden') return null;
  return <div>{gate.value.rows.map((row, index) => <p key={index}>{row}</p>)}</div>;
}
