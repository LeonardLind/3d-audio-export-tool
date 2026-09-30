import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { CloudRecording } from '../data/types.ts';
import { dispatch, useAppState } from '../state/store.ts';
import type { AxisMask, RevealMode, Selection } from '../state/types.ts';
import { CameraRig } from './CameraRig.tsx';
import { CloudPoints } from './CloudPoints.tsx';
import { TrailLine } from './TrailLine.tsx';
import { EdgeLines } from './EdgeLines.tsx';
import { FlatGrid } from './FlatGrid.tsx';
import { AxisGizmo } from './AxisGizmo.tsx';
import { ScreenLayer } from './ScreenLayer.tsx';
import { createScreenFrame, pickAt } from './screenFrame.ts';
import type { ScreenFrame } from './types.ts';
import { transitionPlan } from './transition.ts';
import styles from './Cloud.module.css';

export interface CloudCanvasProps {
  recording: CloudRecording;
  audioRef: RefObject<HTMLAudioElement | null>;
  showEdges?: boolean;
  preview?: boolean;
}

interface SceneProps extends CloudCanvasProps {
  axes: AxisMask; reveal: RevealMode; playing: boolean; selection: Selection; hover: number | null;
  autoRotate: boolean; fitRequest: number; pointerInside: boolean; transition: import('../state/types.ts').AppState['view']['transition']; fadeSwitched: boolean;
  frameRef: RefObject<ScreenFrame>; overlayRef: RefObject<HTMLCanvasElement | null>;
}

function Scene({ recording, audioRef, axes, reveal, playing, selection, hover, autoRotate, fitRequest,
  pointerInside, transition, fadeSwitched, frameRef, overlayRef, showEdges = false, preview = false }: SceneProps) {
  const { size } = useThree();
  const cameraAxes = transition?.plan === 'fade' && !fadeSwitched ? transition.from : axes;
  const drawAxes = transition?.plan === 'rotate' ? (transition.from | transition.to) as AxisMask : cameraAxes;
  return <>
    <color attach="background" args={['#04050a']} />
    <CameraRig recording={recording} axes={cameraAxes} width={size.width} height={size.height}
      autoRotate={autoRotate && selection.a === null && selection.b === null}
      fitRequest={fitRequest} pointerInside={pointerInside} transition={transition} />
    {cameraAxes !== 7 && <FlatGrid recording={recording} axes={cameraAxes} width={size.width} height={size.height} />}
    {cameraAxes === 7 && <AxisGizmo />}
    {(showEdges || preview) && axes === 7 && !transition && <EdgeLines recording={recording} audioRef={audioRef} axes={axes} reveal={reveal} />}
    <TrailLine recording={recording} audioRef={audioRef} axes={drawAxes} reveal={reveal} />
    <CloudPoints recording={recording} audioRef={audioRef} axes={drawAxes} reveal={reveal} />
    <ScreenLayer recording={recording} audioRef={audioRef} canvasRef={overlayRef} frameRef={frameRef}
      axes={drawAxes} reveal={reveal} playing={playing} selection={selection} hover={hover} transitionActive={Boolean(transition)} />
  </>;
}

export function CloudCanvas({ recording, audioRef, showEdges = false, preview = false }: CloudCanvasProps) {
  const axes = useAppState((state) => state.view.axes);
  const transition = useAppState((state) => state.view.transition);
  const autoRotate = useAppState((state) => state.view.autoRotate);
  const fitRequest = useAppState((state) => state.view.fitRequest);
  const reveal = useAppState((state) => state.playback.reveal);
  const playing = useAppState((state) => state.playback.main === 'playing');
  const selection = useAppState((state) => state.selection);
  const hover = useAppState((state) => state.pointer.hover?.index ?? null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<ScreenFrame>(createScreenFrame(recording.points.length));
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const [pointerInside, setPointerInside] = useState(false);
  const [fadeSwitched, setFadeSwitched] = useState(false);

  useEffect(() => {
    if (!transition) return;
    const duration = transitionPlan(transition.from, transition.to).durationMs;
    if (transition.plan === 'fade') setFadeSwitched(false);
    const midpoint = transition.plan === 'fade' ? window.setTimeout(() => setFadeSwitched(true), duration / 2) : null;
    const timeout = window.setTimeout(() => dispatch({ type: 'END_TRANSITION' }), duration);
    return () => { window.clearTimeout(timeout); if (midpoint !== null) window.clearTimeout(midpoint); };
  }, [transition]);

  const local = (event: PointerEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (transition) return;
    const point = local(event);
    if (!point) return;
    const index = pickAt(frameRef.current, point.x, point.y);
    if (index === null) dispatch({ type: 'HOVER_CLEAR' });
    else dispatch({ type: 'HOVER', index, clientX: event.clientX, clientY: event.clientY });
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = pointerDown.current; pointerDown.current = null;
    if (!start || transition) return;
    const point = local(event);
    if (!point || Math.hypot(start.x - point.x, start.y - point.y) >= 4) return;
    const index = pickAt(frameRef.current, point.x, point.y);
    if (index !== null) dispatch({ type: 'SELECT_CLICK', index, shift: event.shiftKey });
  };

  return <div ref={wrapperRef} className={`${styles.cloud} ${transition?.plan === 'fade' ? styles.fade : ''}`}
    onPointerEnter={() => setPointerInside(true)} onPointerLeave={() => { setPointerInside(false); dispatch({ type: 'HOVER_CLEAR' }); }}
    onPointerDown={(event) => { pointerDown.current = local(event); }}
    onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
    <Canvas camera={{ position: [8, 5, 9], fov: 52 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
      <Scene recording={recording} audioRef={audioRef} axes={axes} reveal={reveal} playing={playing}
        selection={selection} hover={hover} autoRotate={autoRotate} fitRequest={fitRequest}
        pointerInside={pointerInside} transition={transition} fadeSwitched={fadeSwitched} frameRef={frameRef}
        overlayRef={overlayRef} showEdges={showEdges} preview={preview} />
    </Canvas>
    <canvas ref={overlayRef} className={styles.overlay} aria-hidden="true" />
  </div>;
}
