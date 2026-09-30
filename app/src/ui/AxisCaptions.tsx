import type { GateState } from '../evidence/types.ts';

export function AxisCaptions({ gate }: { gate?: GateState<{ captions: string[] }> }) {
  if (!gate || gate.status === 'hidden') return null;
  return <div>{gate.value.captions.map((caption, index) => <p key={index}>{caption}</p>)}</div>;
}
