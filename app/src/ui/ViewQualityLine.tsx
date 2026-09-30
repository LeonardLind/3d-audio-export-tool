import type { GateState } from '../evidence/types.ts';

export function ViewQualityLine({ gate }: { gate?: GateState<{ text: string }> }) {
  if (!gate || gate.status === 'hidden') return null;
  return <p>{gate.value.text}</p>;
}
