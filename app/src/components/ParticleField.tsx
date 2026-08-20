import { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineSegments,
  NormalBlending,
  Points,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
} from "three";
import { centroidColor } from "../colorScale";
import type { RecordingPayload } from "../types";

// GPU particle system for the 3D "MULTI-SCALE ANALYSIS" view. A few draw calls (one Points
// cloud, a flowing trail, a faint similarity web, two sprites) driven by a single uTime
// uniform from playback, so it pulses/flows at 60fps without per-point React state. Points
// reveal at their emissionTime, swell + brighten briefly after emission (scaled by spectral
// flux, so transients pop), then settle into a soft glowing cloud. The D-010
// raw-spectrogram->PCA positions are untouched -- this only changes how they're drawn.

const REVEAL_SECONDS = 0.28;
const RECENT_SECONDS = 0.7;
const TRAIL_SECONDS = 1.5; // how long the flowing trail lingers behind the playhead

const particleVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aEmission;
  attribute float aFlux;
  uniform float uTime;
  uniform float uSizeScale;
  uniform float uRecent;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float age = uTime - aEmission;
    float emitted = step(0.0, age);
    float reveal = clamp(age / ${REVEAL_SECONDS.toFixed(2)}, 0.0, 1.0);
    float recent = exp(-max(age, 0.0) / uRecent);
    float pulse = 1.0 + recent * (0.6 + aFlux * 1.3);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float size = aSize * uSizeScale * pulse * reveal * emitted * (9.0 / max(0.001, -mv.z));
    gl_PointSize = clamp(size, 0.0, 140.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor * (0.7 + 0.9 * recent);
    vAlpha = emitted * mix(0.5, 1.0, reveal) * (0.65 + 0.5 * recent);
  }
`;

const particleFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.30, 0.0, d);
    vec3 col = vColor * (0.6 + 2.2 * core);
    float a = vAlpha * (0.35 * glow + 1.0 * core);
    gl_FragColor = vec4(col, a);
  }
`;

// Flowing trail: bright at the playhead, fading out over TRAIL_SECONDS behind it. Because
// consecutive points are ~0.05s apart (overlapping windows), they sit close in PCA space,
// so the recent trail is a smooth local ribbon rather than lines spanning the whole cloud.
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

// Similarity threads reveal as both endpoints appear, then persist faintly.
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

export function ParticleField({
  payload,
  audioRef,
}: {
  payload: RecordingPayload;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const built = useMemo(() => {
    const points = payload.points;
    const n = points.length;

    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const emissions = new Float32Array(n);
    const fluxes = new Float32Array(n);
    const times = new Float32Array(n);
    const tmp = new Color();

    points.forEach((point, i) => {
      positions[i * 3] = point.position[0];
      positions[i * 3 + 1] = point.position[1];
      positions[i * 3 + 2] = point.position[2];
      tmp.copy(centroidColor(point.centroidNorm));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
      sizes[i] = 0.6 + point.amplitudeNorm * 1.8;
      emissions[i] = point.emissionTime;
      fluxes[i] = point.spectralFluxNorm;
      times[i] = point.emissionTime;
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
        uSizeScale: { value: 26 * pixelRatio },
        uRecent: { value: RECENT_SECONDS },
      },
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
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

    // Similarity threads: ALL of them (the k-NN-in-feature-space proximity graph), drawn
    // so the whole connective structure reads clearly from any angle. Uses NORMAL blending
    // (not additive) with a floored per-edge opacity so a line never washes out over the
    // dark background or vanishes where it crosses a bright particle. Brightness varies
    // gently with thread length (shorter/tighter = brighter) but never drops out.
    const edges = payload.similarityEdges;
    const lengths = edges.map(([a, b]) => {
      const pa = points[a].position;
      const pb = points[b].position;
      return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
    });
    const maxLen = Math.max(1e-6, ...lengths);
    const nearColor = new Color("#8fd4ff");
    const farColor = new Color("#3f5c8a");
    const edgeColor = new Color();

    const edgePositions = new Float32Array(edges.length * 6);
    const edgeColors = new Float32Array(edges.length * 6);
    const edgeEmissions = new Float32Array(edges.length * 2);
    edges.forEach(([a, b], i) => {
      edgePositions.set(points[a].position, i * 6);
      edgePositions.set(points[b].position, i * 6 + 3);
      // shorter thread -> brighter; clamp so even the longest keeps a visible floor.
      const closeness = 1 - Math.min(1, lengths[i] / maxLen);
      edgeColor.copy(farColor).lerp(nearColor, 0.35 + 0.65 * closeness);
      edgeColors.set([edgeColor.r, edgeColor.g, edgeColor.b, edgeColor.r, edgeColor.g, edgeColor.b], i * 6);
      const later = Math.max(points[a].emissionTime, points[b].emissionTime);
      edgeEmissions[i * 2] = later;
      edgeEmissions[i * 2 + 1] = later;
    });
    const edgeGeom = new BufferGeometry();
    edgeGeom.setAttribute("position", new Float32BufferAttribute(edgePositions, 3));
    edgeGeom.setAttribute("aColor", new Float32BufferAttribute(edgeColors, 3));
    edgeGeom.setAttribute("aEmission", new Float32BufferAttribute(edgeEmissions, 1));
    const edgeMaterial = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.5 } },
      vertexShader: edgeVertex,
      fragmentShader: lineFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false, // never let a nearer particle/line hide a thread from some angles
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

    return { group, particleMaterial, trailMaterial, edgeMaterial, comet, core, positions, times, points };
  }, [payload]);

  const disposeRef = useRef(built);
  disposeRef.current = built;
  useEffect(() => {
    const current = disposeRef.current;
    return () => {
      current.group.traverse((object) => {
        const withGeom = object as { geometry?: { dispose: () => void }; material?: { dispose: () => void } };
        withGeom.geometry?.dispose();
        withGeom.material?.dispose();
      });
    };
  }, [built]);

  const cometColor = useMemo(() => new Color(), []);
  const white = useMemo(() => new Color("#ffffff"), []);

  useFrame(() => {
    const t = audioRef.current?.currentTime ?? 0;
    const { particleMaterial, trailMaterial, edgeMaterial, comet, core, positions, times, points } = built;
    particleMaterial.uniforms.uTime.value = t;
    trailMaterial.uniforms.uTime.value = t;
    edgeMaterial.uniforms.uTime.value = t;

    const n = times.length;
    if (n > 0 && t >= times[0] - 0.05) {
      let i = 0;
      while (i < n - 1 && times[i + 1] <= t) i += 1;
      const next = Math.min(n - 1, i + 1);
      const span = Math.max(1e-3, times[next] - times[i]);
      const f = Math.min(1, Math.max(0, (t - times[i]) / span));
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

  return <primitive object={built.group} />;
}
