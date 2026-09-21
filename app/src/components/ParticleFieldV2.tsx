import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LinearFilter,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { centroidColor } from "../colorScale";
import { SIZE_SCALE, formatLabel, radiusFraction, type LabelValue, type SizeMode } from "./cloudChannels";
import type { CloudStyle } from "./cloudStyles";
import type { CloudPayload, RecordingPointDatum } from "../types";

// The parameterised renderer behind cloud versions v0.2 and up. It draws one version at a
// time; WHICH one is a CloudStyle passed in from cloudStyles.ts, which holds every version
// side by side so switching and reverting are both one click. (v0.1 is not drawn here at
// all -- it is the original ParticleField component, still rendered by its own file.)
//
// Three things every version from v0.2 does that v0.1 did not:
//
//   1. SIZE. Two things flattened it in v0.1. The mapping: radius went linearly onto
//      amplitudeNorm = (amp - min) / (max - min) with a 0.6 floor, so the sample clip's
//      median window drew at 0.875 against the loudest window's 2.4 -- a 2.7x spread for a
//      19x spread in the underlying RMS. And the sprite: only the inner 30% was lit, so a
//      wide point and a narrow one both showed a similar bright dot. From v0.2 the channel
//      is anchored at silence (radius = amplitude / maxAmplitude, so sprite AREA follows
//      the window's mean-square energy) and the whole ball is drawn.
//   2. EDGES. v0.1 coloured every similarity thread on one blue ramp keyed to the thread's
//      length -- a value the reader cannot look up anywhere. From v0.2 each thread carries
//      its two endpoints' own centroid colours, one per vertex, so the line reads as a
//      gradient from A's pitch to B's pitch and you can see WHICH two moments it joins.
//   3. NUMBERS. v0.1 had no per-point readout at all.
//
// Nothing here is derived or smoothed: every number drawn is a field of the point datum,
// and no version changes position, colour, size or reveal time -- only how they are painted.

const REVEAL_SECONDS = 0.28;
const RECENT_SECONDS = 0.7;
const TRAIL_SECONDS = 1.5;
// Label height in CSS pixels, held constant as you zoom (see PointLabels).
const LABEL_PIXEL_HEIGHT = 13;
// Clear space required between two labels before both are allowed to draw.
const LABEL_GAP_PIXELS = 3;

// Aerial-perspective depth cue, for the styles that ask for it (v0.9). Nearer points hold
// their contrast and farther ones lose some, which is what makes a point cloud read as a
// volume rather than a flat scatter.
//
// It is a CAMERA effect, not a data channel, and is built so that cannot be confused: the
// factor is the point's camera-space depth divided by the camera's distance to the cloud
// centre, so it is 1.0 for a point at the centre whatever the zoom, and it changes as you
// orbit. Two points with identical measurements swap appearance when you rotate past them,
// which is exactly what a viewer needs in order to read it as depth and not as a value.
function depthCueGlsl(style: CloudStyle) {
  if (!style.depthCue) return "";
  return /* glsl */ `
        * mix(
            1.0,
            clamp(1.62 - 0.78 * (-mv.z / max(1.0, length(cameraPosition))), 0.32, 1.14),
            ${style.depthCue.toFixed(3)}
          )`;
}

// The vertex shader is the same for every version except for four brightness numbers and
// how far the glow reaches, so it is built from the style rather than duplicated per style.
// vSize is the ball's width in CSS pixels, which a fragment shader needs if it wants to
// behave differently for a point too small to draw detail in (v0.4 does).
function buildParticleVertex(style: CloudStyle) {
  return /* glsl */ `
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aEmission;
    attribute float aFlux;
    uniform float uTime;
    uniform float uSizeScale;
    uniform float uRecent;
    uniform float uPixelRatio;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vSize;
    void main() {
      float age = uTime - aEmission;
      float emitted = step(0.0, age);
      float reveal = clamp(age / ${REVEAL_SECONDS.toFixed(2)}, 0.0, 1.0);
      float recent = exp(-max(age, 0.0) / uRecent);
      float pulse = 1.0 + recent * (0.6 + aFlux * 1.3);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float ball = clamp(
        aSize * uSizeScale * pulse * reveal * emitted * (9.0 / max(0.001, -mv.z)),
        0.0,
        ${style.maxBallPixels.toFixed(1)}
      );
      gl_PointSize = ball * ${style.haloScale.toFixed(4)};
      gl_Position = projectionMatrix * mv;
      vColor = aColor * (${style.restColor.toFixed(3)} + ${style.recentColor.toFixed(3)} * recent);
      vAlpha = emitted * mix(${style.revealFloor.toFixed(3)}, 1.0, reveal)
        * (${style.restAlpha.toFixed(3)} + ${style.recentAlpha.toFixed(3)} * recent)
        ${depthCueGlsl(style)};
      vSize = ball / max(1.0, uPixelRatio);
    }
  `;
}

const trailVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aEmission;
  uniform float uTime;
  uniform float uTrail;
  varying vec3 vColor;
  varying float vReveal;
  void main() {
    float age = uTime - aEmission;
    float on = step(0.0, age);
    vReveal = on * clamp(1.0 - age / uTrail, 0.0, 1.0);
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const edgeVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aEmission;
  uniform float uTime;
  varying vec3 vColor;
  varying float vReveal;
  void main() {
    float age = uTime - aEmission;
    vReveal = clamp(age / 0.5, 0.0, 1.0) * step(0.0, age);
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vReveal;
  void main() {
    gl_FragColor = vec4(vColor, vReveal * uOpacity);
  }
`;

function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

// The plasma ramp's low end (#0d0887) is nearly the same luminance as the #04050a
// background, so a thread between two low-centroid points would be invisible. Scaling all
// three channels by one factor raises value while leaving hue and saturation alone, so the
// thread still reads as "this endpoint's color", just bright enough to see.
const MIN_EDGE_VALUE = 0.55;
function legibleEdgeColor(target: Color, t: number) {
  target.copy(centroidColor(t));
  const peak = Math.max(target.r, target.g, target.b);
  if (peak > 0 && peak < MIN_EDGE_VALUE) target.multiplyScalar(MIN_EDGE_VALUE / peak);
  return target;
}

// Re-exported for convenience: the renderers, the scene shell and the Upload tab all speak
// this shape. Defined in types.ts alongside the other structural render types.
export type { CloudPayload };

export function ParticleFieldV2({
  payload,
  audioRef,
  style,
  sizeMode,
  labelValue,
  labelCount,
  showEdges,
}: {
  payload: CloudPayload;
  audioRef: RefObject<HTMLAudioElement | null>;
  style: CloudStyle;
  sizeMode: SizeMode;
  labelValue: LabelValue;
  labelCount: number;
  showEdges: boolean;
}) {
  const built = useMemo(() => {
    const points = payload.points;
    const n = points.length;
    const amplitudeMax = points.reduce((max, point) => Math.max(max, point.amplitude), 0);

    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const emissions = new Float32Array(n);
    const fluxes = new Float32Array(n);
    const tmp = new Color();

    points.forEach((point, i) => {
      positions[i * 3] = point.position[0];
      positions[i * 3 + 1] = point.position[1];
      positions[i * 3 + 2] = point.position[2];
      tmp.copy(centroidColor(point.centroidNorm));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
      sizes[i] = radiusFraction(point, amplitudeMax, sizeMode);
      emissions[i] = point.emissionTime;
      fluxes[i] = point.spectralFluxNorm;
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new Float32BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("aEmission", new Float32BufferAttribute(emissions, 1));
    geometry.setAttribute("aFlux", new Float32BufferAttribute(fluxes, 1));

    const pixelRatio = typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1;
    const particleMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSizeScale: { value: SIZE_SCALE * pixelRatio },
        uRecent: { value: RECENT_SECONDS },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: buildParticleVertex(style),
      fragmentShader: style.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: style.blending === "normal" ? NormalBlending : AdditiveBlending,
    });
    const cloud = new Points(geometry, particleMaterial);
    cloud.frustumCulled = false;

    // Flowing trail through the time-ordered points (already sorted by emission).
    const trailGeom = new BufferGeometry();
    trailGeom.setAttribute("position", new Float32BufferAttribute(positions.slice(), 3));
    const trailColors = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      trailColors[i * 3] = Math.min(1, colors[i * 3] * 0.9 + 0.2);
      trailColors[i * 3 + 1] = Math.min(1, colors[i * 3 + 1] * 0.9 + 0.25);
      trailColors[i * 3 + 2] = Math.min(1, colors[i * 3 + 2] * 0.9 + 0.35);
    }
    trailGeom.setAttribute("aColor", new Float32BufferAttribute(trailColors, 3));
    trailGeom.setAttribute("aEmission", new Float32BufferAttribute(emissions.slice(), 1));
    const trailMaterial = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTrail: { value: TRAIL_SECONDS }, uOpacity: { value: 0.5 } },
      vertexShader: trailVertex,
      fragmentShader: lineFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const trailLine = new Line(trailGeom, trailMaterial);
    trailLine.frustumCulled = false;

    // Similarity threads, one gradient per thread: vertex A carries point A's centroid
    // color, vertex B carries point B's, and the rasterizer interpolates between them. The
    // gradient direction therefore tells you which end is the higher-pitched moment.
    const edges = payload.similarityEdges;
    const edgePositions = new Float32Array(edges.length * 6);
    const edgeColors = new Float32Array(edges.length * 6);
    const edgeEmissions = new Float32Array(edges.length * 2);
    const edgeColor = new Color();
    edges.forEach(([a, b], i) => {
      edgePositions.set(points[a].position, i * 6);
      edgePositions.set(points[b].position, i * 6 + 3);

      legibleEdgeColor(edgeColor, points[a].centroidNorm);
      edgeColors[i * 6] = edgeColor.r;
      edgeColors[i * 6 + 1] = edgeColor.g;
      edgeColors[i * 6 + 2] = edgeColor.b;
      legibleEdgeColor(edgeColor, points[b].centroidNorm);
      edgeColors[i * 6 + 3] = edgeColor.r;
      edgeColors[i * 6 + 4] = edgeColor.g;
      edgeColors[i * 6 + 5] = edgeColor.b;

      // A thread appears once BOTH its endpoints have been played.
      const later = Math.max(points[a].emissionTime, points[b].emissionTime);
      edgeEmissions[i * 2] = later;
      edgeEmissions[i * 2 + 1] = later;
    });
    const edgeGeom = new BufferGeometry();
    edgeGeom.setAttribute("position", new Float32BufferAttribute(edgePositions, 3));
    edgeGeom.setAttribute("aColor", new Float32BufferAttribute(edgeColors, 3));
    edgeGeom.setAttribute("aEmission", new Float32BufferAttribute(edgeEmissions, 1));
    const edgeMaterial = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: style.edgeOpacity } },
      vertexShader: edgeVertex,
      fragmentShader: lineFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false, // never let a nearer particle hide a thread from some angles
      blending: NormalBlending,
    });
    const edgeLines = new LineSegments(edgeGeom, edgeMaterial);
    edgeLines.frustumCulled = false;
    edgeLines.renderOrder = -1; // draw the structural web first, behind the glow

    const glowTexture = makeGlowTexture();
    const comet = new Sprite(
      new SpriteMaterial({ map: glowTexture, color: new Color("#ffffff"), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }),
    );
    const core = new Sprite(
      new SpriteMaterial({ map: glowTexture, color: new Color("#2f5fd0"), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0.1 }),
    );
    core.scale.setScalar(6);

    const group = new Group();
    group.add(edgeLines, trailLine, cloud, core, comet);

    return {
      group,
      particleMaterial,
      trailMaterial,
      edgeMaterial,
      edgeLines,
      comet,
      core,
      glowTexture,
      positions,
      points,
      amplitudeMax,
    };
  }, [payload, sizeMode, style]);

  useEffect(() => {
    const current = built;
    return () => {
      current.group.traverse((object) => {
        const withGeom = object as { geometry?: { dispose: () => void }; material?: { dispose: () => void } };
        withGeom.geometry?.dispose();
        withGeom.material?.dispose();
      });
      current.glowTexture.dispose();
    };
  }, [built]);

  useEffect(() => {
    built.edgeLines.visible = showEdges;
  }, [built, showEdges]);

  const cometColor = useMemo(() => new Color(), []);
  const white = useMemo(() => new Color("#ffffff"), []);

  useFrame(() => {
    const t = audioRef.current?.currentTime ?? 0;
    const { particleMaterial, trailMaterial, edgeMaterial, comet, core, positions, points } = built;
    particleMaterial.uniforms.uTime.value = t;
    trailMaterial.uniforms.uTime.value = t;
    edgeMaterial.uniforms.uTime.value = t;

    const n = points.length;
    if (n > 0 && t >= points[0].emissionTime - 0.05) {
      let i = 0;
      while (i < n - 1 && points[i + 1].emissionTime <= t) i += 1;
      const next = Math.min(n - 1, i + 1);
      const span = Math.max(1e-3, points[next].emissionTime - points[i].emissionTime);
      const f = Math.min(1, Math.max(0, (t - points[i].emissionTime) / span));
      comet.position.set(
        positions[i * 3] + (positions[next * 3] - positions[i * 3]) * f,
        positions[i * 3 + 1] + (positions[next * 3 + 1] - positions[i * 3 + 1]) * f,
        positions[i * 3 + 2] + (positions[next * 3 + 2] - positions[i * 3 + 2]) * f,
      );
      cometColor.copy(centroidColor(points[next].centroidNorm)).lerp(white, 0.45);
      comet.material.color.copy(cometColor);
      comet.scale.setScalar(0.8 + points[next].spectralFluxNorm * 0.9);
      comet.material.opacity = 0.95;
      core.material.opacity = 0.06 + points[next].amplitudeNorm * 0.16;
      core.scale.setScalar(5 + points[next].amplitudeNorm * 4);
    } else {
      comet.material.opacity = 0;
      core.material.opacity = 0.06;
    }
  });

  return (
    <>
      <primitive object={built.group} />
      <PointLabels
        points={built.points}
        amplitudeMax={built.amplitudeMax}
        sizeMode={sizeMode}
        labelValue={labelValue}
        labelCount={labelCount}
        audioRef={audioRef}
      />
    </>
  );
}

// Per-point numeric readout. One Sprite per label (sprites are camera-facing by
// construction, so no billboard maths) carrying a canvas-rendered string -- no webfont
// fetch, so it renders identically offline.
//
// Only the loudest `labelCount` points are candidates: at 254 points every label would
// overlap its neighbours and none would be readable. The candidate set is exactly "the N
// windows with the highest RMS", which is also the N largest spheres, so the numbers land
// on the points whose size you are already reading.
//
// Candidates are then placed greedily loudest-first, and one that would collide in screen
// space with an already-placed label is dropped for that frame. Two half-overlapping
// numbers do not read as "crowded", they read as a third wrong number -- so a label is
// either fully legible or absent. Which ones survive changes as the cloud rotates.
function PointLabels({
  points,
  amplitudeMax,
  sizeMode,
  labelValue,
  labelCount,
  audioRef,
}: {
  points: RecordingPointDatum[];
  amplitudeMax: number;
  sizeMode: SizeMode;
  labelValue: LabelValue;
  labelCount: number;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const size = useThree((state) => state.size);
  const scratch = useMemo(() => new Vector3(), []);
  // Screen rects of the labels placed so far this frame, as [x, y, w, h] quads. Reused
  // across frames so label placement allocates nothing per frame.
  const placedRef = useRef(new Float32Array(0));

  const labels = useMemo(() => {
    if (labelValue === "none" || labelCount <= 0) return null;
    const chosen = points
      .map((point, index) => ({ point, index }))
      .sort((a, b) => b.point.amplitude - a.point.amplitude)
      .slice(0, labelCount);

    const group = new Group();
    const sprites = chosen.map(({ point }) => {
      const sprite = makeTextSprite(formatLabel(point, labelValue));
      sprite.position.set(point.position[0], point.position[1], point.position[2]);
      sprite.visible = false;
      group.add(sprite);
      return {
        sprite,
        emissionTime: point.emissionTime,
        aspect: sprite.userData.aspect as number,
        radiusFraction: radiusFraction(point, amplitudeMax, sizeMode),
      };
    });
    return { group, sprites };
  }, [points, amplitudeMax, sizeMode, labelValue, labelCount]);

  useEffect(() => {
    const current = labels;
    if (!current) return;
    return () => {
      for (const { sprite } of current.sprites) {
        const material = sprite.material as SpriteMaterial;
        material.map?.dispose();
        material.dispose();
      }
    };
  }, [labels]);

  useFrame(({ camera }) => {
    if (!labels) return;
    const t = audioRef.current?.currentTime ?? 0;
    const perspective = camera as PerspectiveCamera;
    // World units per screen pixel at distance d, for a perspective camera:
    //   2 * d * tan(fov/2) / viewportHeightInPixels
    // Scaling each sprite by that keeps the label a constant pixel height at any zoom.
    const tanHalfFov = Math.tan(((perspective.fov ?? 50) * Math.PI) / 360);

    if (placedRef.current.length < labels.sprites.length * 4) {
      placedRef.current = new Float32Array(labels.sprites.length * 4);
    }
    const placed = placedRef.current;
    let placedCount = 0;

    // labels.sprites is already ordered loudest first, so iterating in order gives the
    // loudest label priority over the space it wants.
    for (const label of labels.sprites) {
      const { sprite, emissionTime, aspect } = label;
      if (t < emissionTime) {
        sprite.visible = false;
        continue;
      }
      const distance = camera.position.distanceTo(sprite.position);
      const worldPerPixel = (2 * distance * tanHalfFov) / Math.max(1, size.height);
      const height = LABEL_PIXEL_HEIGHT * worldPerPixel;
      const widthPixels = LABEL_PIXEL_HEIGHT * aspect;
      sprite.scale.set(height * aspect, height, 1);
      // Push the label clear of its own sphere. The vertex shader draws a point at
      // gl_PointSize = aSize * uSizeScale * (9 / distance) device pixels across, so the
      // sphere's CSS-pixel radius is aSize * uSizeScale * 9 / (2 * distance) -- the device
      // pixel ratio cancels. sprite.center is in sprite widths, hence the division.
      const spherePixels = (label.radiusFraction * SIZE_SCALE * 9) / (2 * Math.max(0.001, distance));
      // 1.2x rather than flush against the rim, so the number sits clear of the ball's glow
      // instead of inside it.
      sprite.center.set(-(spherePixels * 1.2 + 4) / widthPixels, 0.5);

      scratch.copy(sprite.position).project(camera);
      if (scratch.z > 1) {
        sprite.visible = false; // behind the camera
        continue;
      }
      const x = (scratch.x * 0.5 + 0.5) * size.width + spherePixels + 4;
      const y = (-scratch.y * 0.5 + 0.5) * size.height - LABEL_PIXEL_HEIGHT / 2;

      let free = true;
      for (let i = 0; i < placedCount; i += 1) {
        const o = i * 4;
        if (
          x < placed[o] + placed[o + 2] + LABEL_GAP_PIXELS &&
          x + widthPixels + LABEL_GAP_PIXELS > placed[o] &&
          y < placed[o + 1] + placed[o + 3] + LABEL_GAP_PIXELS &&
          y + LABEL_PIXEL_HEIGHT + LABEL_GAP_PIXELS > placed[o + 1]
        ) {
          free = false;
          break;
        }
      }
      sprite.visible = free;
      if (free) {
        const o = placedCount * 4;
        placed[o] = x;
        placed[o + 1] = y;
        placed[o + 2] = widthPixels;
        placed[o + 3] = LABEL_PIXEL_HEIGHT;
        placedCount += 1;
      }
    }
  });

  if (!labels) return null;
  return <primitive object={labels.group} />;
}

// Canvas-rendered number, drawn at 3x for crispness and given a dark halo so it stays
// readable over both the dark background and a bright particle.
function makeTextSprite(text: string): Sprite {
  const scale = 3;
  const fontSize = 16 * scale;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `600 ${fontSize}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
  ctx.font = font;
  const padding = 3 * scale;
  canvas.width = Math.ceil(ctx.measureText(text).width) + padding * 2;
  canvas.height = Math.ceil(fontSize * 1.35);

  // Re-set after resizing the canvas: resizing resets the 2D context state.
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3.5 * scale;
  ctx.strokeStyle = "rgba(2, 4, 10, 0.85)";
  ctx.lineJoin = "round";
  ctx.strokeText(text, padding, canvas.height / 2);
  ctx.fillStyle = "#f2f5fb";
  ctx.fillText(text, padding, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;

  const sprite = new Sprite(
    new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }),
  );
  sprite.userData.aspect = canvas.width / canvas.height;
  sprite.renderOrder = 10;
  return sprite;
}
