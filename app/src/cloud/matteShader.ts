// The v0.7 fragment is copied exactly from components/cloudStyles.ts.
const VARYINGS = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSize;
`;

export const matteFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    // One pixel of anti-aliasing at the rim and flat everywhere inside it.
    float disc = 1.0 - smoothstep(1.0 - 2.0 / max(4.0, vSize), 1.0, d);
    gl_FragColor = vec4(vColor * 0.95, vAlpha * disc * 0.92);
  }
`;

export const matteVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aEmission;
  attribute float aFlux;
  uniform float uTime;
  uniform float uRestMode;
  uniform float uSizeScale;
  uniform float uRecent;
  uniform float uPixelRatio;
  uniform float uOrthoDepth;
  uniform float uFade;
  uniform vec3 uAxisMask;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSize;
  void main() {
    float age = uRestMode > 0.5 ? 1000000.0 : uTime - aEmission;
    float emitted = step(0.0, age);
    float reveal = clamp(age / 0.28, 0.0, 1.0);
    float recent = exp(-max(age, 0.0) / uRecent);
    float pulse = 1.0 + recent * (0.6 + aFlux * 1.3);
    vec4 mv = modelViewMatrix * vec4(position * uAxisMask, 1.0);
    float depth = uOrthoDepth > 0.0 ? uOrthoDepth : -mv.z;
    float ball = clamp(aSize * uSizeScale * pulse * reveal * emitted * (9.0 / max(0.001, depth)), 0.0, 200.0);
    gl_PointSize = ball;
    gl_Position = projectionMatrix * mv;
    vColor = aColor * (0.950 + 0.400 * recent);
    vAlpha = emitted * mix(0.400, 1.0, reveal) * 0.950 * uFade;
    vSize = ball / max(1.0, uPixelRatio);
  }
`;

export const trailVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aEmission;
  uniform float uTime;
  uniform float uTrail;
  uniform float uRestMode;
  uniform vec3 uAxisMask;
  varying vec3 vColor;
  varying float vReveal;
  void main() {
    float age = uTime - aEmission;
    float on = step(0.0, age) * (1.0 - uRestMode);
    vReveal = on * clamp(1.0 - age / uTrail, 0.0, 1.0);
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uAxisMask, 1.0);
  }
`;

export const edgeVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aEmission;
  uniform float uTime;
  uniform float uRestMode;
  uniform vec3 uAxisMask;
  varying vec3 vColor;
  varying float vReveal;
  void main() {
    float age = uTime - aEmission;
    vReveal = uRestMode > 0.5 ? 1.0 : clamp(age / 0.5, 0.0, 1.0) * step(0.0, age);
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uAxisMask, 1.0);
  }
`;

export const lineFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vReveal;
  void main() { gl_FragColor = vec4(vColor, vReveal * uOpacity); }
`;
