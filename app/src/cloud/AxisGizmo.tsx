import { GizmoHelper, GizmoViewport } from '@react-three/drei';

export function AxisGizmo() {
  return <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
    <GizmoViewport axisColors={['#8a93a6', '#8a93a6', '#8a93a6']} labelColor="#f2f5fb" />
  </GizmoHelper>;
}
