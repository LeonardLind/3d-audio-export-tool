// Every look the 3D cloud has had, kept selectable side by side.
//
// The point of this file is that no version is ever lost. Each entry below is a complete
// description of how one version drew a point -- its brightness at rest, how much a
// just-played point pops, how far its glow reaches, and its fragment shader -- so switching
// version is one click and going back is one click. Adding v0.5 means adding one entry,
// not editing an existing one.
//
// What NEVER varies by version: where a point sits (D-010 raw spectrogram -> PCA), its
// colour (spectral centroid), its size (amplitude) and when it appears (emission time).
// A version changes only how those four are painted, which is why versions are comparable.
//
// v0.1 is the exception: it is the original ParticleField component, still rendered by its
// own untouched file. Its size mapping and its length-keyed blue threads predate the
// display-channel controls, so the controls do not apply to it.

export type CloudVersionId = "v0.1" | "v0.2" | "v0.3" | "v0.4" | "v0.5" | "v0.6" | "v0.7" | "v0.8" | "v0.9";

export interface CloudStyle {
  id: CloudVersionId;
  name: string;
  // Plain-words description shown under the version buttons.
  note: string;
  // v0.1 only: render the original component instead of the parameterised one.
  original?: true;
  // Sprite width as a multiple of the ball's width -- the extra room is the glow.
  haloScale: number;
  // Ceiling on the BALL in device pixels, applied BEFORE haloScale. maxBallPixels *
  // haloScale has to stay inside whatever gl_PointSize ceiling the driver reports --
  // commonly 1024, occasionally far less -- or the driver clamps it and the proportion
  // between a point's core and its glow visibly breaks. The wide-glow styles therefore
  // carry a lower ball ceiling than the tight ones; it only bites when zoomed right in.
  maxBallPixels: number;
  // vColor = aColor * (restColor + recentColor * recent)
  restColor: number;
  recentColor: number;
  // vAlpha = emitted * mix(revealFloor, 1, reveal) * (restAlpha + recentAlpha * recent)
  restAlpha: number;
  recentAlpha: number;
  revealFloor: number;
  // "additive" stacks overlapping points toward white, which is what gives the glowing
  // styles their bloom. "normal" blends them instead, so a stack of points converges on the
  // topmost colour rather than blowing out -- the right choice for a style whose job is
  // being read rather than admired (v0.7).
  blending: "additive" | "normal";
  // Opacity of the similarity threads.
  edgeOpacity: number;
  // 0/absent = off. Fades farther points for depth (see depthCueGlsl in ParticleFieldV2).
  depthCue?: number;
  fragmentShader: string;
}

// One fixed light for every style that shades its points. Same direction and strength
// everywhere, on every point, so shading can never be mistaken for a measurement.
const LIGHT = "vec3(-0.34, 0.40, 0.85)";

const VARYINGS = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSize;
`;

// --- v0.2: flat lit disc -----------------------------------------------------------
// The first version with numbers and gradient threads. The disc is opaque almost to its
// rim, shaded by sqrt(1 - r^2), with no glow beyond it. Its brightness at rest was
// deliberately low (0.7 colour x 0.65 alpha) so that a just-played point would stand out,
// which is also why nothing here looks solid.
const flatDiscFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    float rim = smoothstep(1.0, 0.88, d);
    float sphere = sqrt(max(0.0, 1.0 - d * d));
    vec3 col = vColor * (0.5 + 1.5 * sphere);
    float a = vAlpha * rim * (0.5 + 0.5 * sphere);
    gl_FragColor = vec4(col, a);
  }
`;

// --- v0.3: lit bead ----------------------------------------------------------------
// Opaque core -> gradient -> glow, with one fixed light giving Lambert shading and a
// specular highlight. See the block comment in ParticleFieldV2 for why the handoff
// between the ball's rim and the glow has to match.
const beadCoreEdge = 0.8;
const beadRimAlpha = 0.22;
const beadHalo = 1.5;
const beadBallEdge = 1 / beadHalo;
const litBeadFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0;
    float d = length(p);
    if (d > 1.0) discard;

    float r = d / ${beadBallEdge.toFixed(6)};
    float isBall = 1.0 - smoothstep(${(beadBallEdge - 0.015).toFixed(6)}, ${(beadBallEdge + 0.015).toFixed(6)}, d);

    float core = 1.0 - smoothstep(${beadCoreEdge.toFixed(2)}, 1.0, min(r, 1.0));
    float ballAlpha = mix(${beadRimAlpha.toFixed(2)}, 1.0, core);
    float outer = clamp((d - ${beadBallEdge.toFixed(6)}) / ${(1 - beadBallEdge).toFixed(6)}, 0.0, 1.0);
    float glowAlpha = ${beadRimAlpha.toFixed(2)} * (1.0 - outer) * (1.0 - outer);
    float alpha = mix(glowAlpha, ballAlpha, isBall);

    float z = sqrt(max(0.0, 1.0 - min(1.0, r * r)));
    vec3 normal = vec3(p / ${beadBallEdge.toFixed(6)}, z);
    float lambert = clamp(dot(normal, vec3(-0.34, 0.40, 0.85)), 0.0, 1.0);
    float specular = pow(lambert, 26.0) * 0.8;

    vec3 col = vColor * (1.0 + isBall * (0.42 * lambert + 0.18 * z - 0.34)) + vec3(specular * isBall);
    gl_FragColor = vec4(col, vAlpha * alpha);
  }
`;

// --- v0.4: glass shell -------------------------------------------------------------
// A hollow bubble rather than a solid bead. Brightness follows Fresnel: a sphere's
// silhouette is where you look through the most material, so a shell is brightest exactly
// at its edge and nearly clear facing you.
//
// Two things this buys over v0.3, both about the crowded end of the cloud. Overlapping
// bubbles stay individually countable instead of merging into one bloom, because what you
// read is each one's outline rather than its filled area. And a bubble in front no longer
// hides what is behind it, so the threads and the points inside a dense knot stay visible.
//
// The cost is that a ring needs pixels to exist in. Below about 7 CSS pixels across there
// is no room for one, so the smallest points fill in solid instead of flickering as a
// half-pixel outline -- that is what vSize (the ball's width in CSS pixels, passed down
// from the vertex shader) is for. It is a legibility measure, not a data channel: the
// switch depends on how big the point is drawn, never on what it measures.
const shellHalo = 1.7;
const shellBallEdge = 1 / shellHalo;
const shellHandoff = 0.3;
const glassShellFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0;
    float d = length(p);
    if (d > 1.0) discard;

    float r = d / ${shellBallEdge.toFixed(6)};
    float z = sqrt(max(0.0, 1.0 - min(1.0, r * r)));
    float inBall = 1.0 - smoothstep(0.98, 1.02, r);

    // 0 facing the camera, 1 at the silhouette.
    float fresnel = pow(1.0 - z, 3.0);

    // Small points cannot show a ring, so they fill in.
    float fill = 1.0 - smoothstep(7.0, 20.0, vSize);
    float interior = mix(0.18, 0.9, fill) * (0.4 + 0.6 * z);

    vec3 normal = vec3(p / ${shellBallEdge.toFixed(6)}, z);
    float lambert = clamp(dot(normal, vec3(-0.34, 0.40, 0.85)), 0.0, 1.0);
    float specular = pow(lambert, 34.0) * 0.85;

    float outer = clamp((d - ${shellBallEdge.toFixed(6)}) / ${(1 - shellBallEdge).toFixed(6)}, 0.0, 1.0);
    float glow = ${shellHandoff.toFixed(2)} * (1.0 - outer) * (1.0 - outer) * step(${shellBallEdge.toFixed(6)}, d);

    float alpha = (interior + fresnel + specular * 0.5) * inBall + glow;
    vec3 col = vColor * (0.75 + 1.1 * fresnel * inBall) + vec3(specular * inBall);
    gl_FragColor = vec4(col, vAlpha * alpha);
  }
`;

// --- v0.5: dust -------------------------------------------------------------------
// Reference: the dense dotted dome. Its character is a very small hard dot inside a very
// large soft bloom -- individually almost nothing, but wherever points crowd together the
// blooms stack into a bright glowing ridge while thin regions stay near black. That is
// what makes the reference read as a lit surface rather than a scatter, and it is the one
// property of it we can reproduce: the reference has tens of thousands of points, this
// cloud has hundreds, so the density is the data's, not something to be manufactured.
//
// Core and bloom both scale with the point, so loudness still reads -- just at a smaller
// on-screen size, with the extra loudness showing up as a wider glow instead.
const dustHalo = 2.8;
const dustBallEdge = 1 / dustHalo;
const dustFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0;
    float d = length(p);
    if (d > 1.0) discard;

    float r = d / ${dustBallEdge.toFixed(6)};

    // A hard dot at 22% of the ball's radius is a few pixels for a loud point and less
    // than one for a quiet one, so below ~6 CSS pixels the dot opens out to fill its ball
    // instead of disappearing. Reads pixels, not data.
    float small = 1.0 - smoothstep(6.0, 22.0, vSize);
    float coreEdge = mix(0.22, 0.9, small);
    float core = 1.0 - smoothstep(coreEdge, coreEdge + 0.2, r);

    float bloom = pow(max(0.0, 1.0 - d), 2.2) * 0.5;

    vec3 col = vColor * (0.85 + 1.5 * core);
    gl_FragColor = vec4(col, vAlpha * (core + bloom));
  }
`;

// --- v0.6: plasma -----------------------------------------------------------------
// Reference: the translucent blue plasma sphere -- a body of glowing gas with hard little
// stars inside it. Two parts per point: a wide, very soft, low-opacity cloud in the
// point's own colour, which overlaps its neighbours' clouds and merges into gas; and a
// pinpoint held at roughly two pixels whatever the zoom, like a star.
//
// The pinpoint being a fixed pixel size is the trade: loudness reads through the size of
// each point's gas cloud rather than through a disc you can measure, which is a softer
// read than v0.3. It is also what makes the reference look like a nebula instead of a
// heap of balls.
const plasmaHalo = 3.2;
const plasmaFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0;
    float d = length(p);
    if (d > 1.0) discard;

    // Gas: broad and faint, so only overlaps read as substance.
    float gas = pow(max(0.0, 1.0 - d), 1.7) * 0.3;

    // Star: converted to CSS pixels so it stays the same size at any point size or zoom.
    float spritePixels = vSize * ${plasmaHalo.toFixed(4)};
    float dPixels = d * spritePixels * 0.5;
    float star = 1.0 - smoothstep(0.9, 2.2, dPixels);

    vec3 col = mix(vColor * 1.05, vec3(1.0), star * 0.8);
    gl_FragColor = vec4(col, vAlpha * (gas + star * 0.85));
  }
`;

// --- v0.7: matte ------------------------------------------------------------------
// Reference: the green dotted sphere -- flat, matte, evenly weighted dots with no bloom
// at all, so what you see is where the points are and nothing else.
//
// No glow, no shading, no highlight: every pixel of a point is the same brightness, which
// means nothing accumulates where points overlap. That makes it the version to switch to
// when you want to READ the cloud rather than enjoy it -- a dense knot stays a dense knot
// instead of turning into a bright patch, and the threads stay visible because nothing is
// competing with them. Threads are dialled back so the dots lead.
const matteFragment = /* glsl */ `
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

// --- v0.8: starfield --------------------------------------------------------------
// Reference: the violet/cyan dotted sphere, whose points read as bright specks with the
// colour sitting in their falloff rather than their middle -- white-hot centre, coloured
// body, a little bloom around it.
//
// Worth knowing while reading it: washing the centre to white costs colour accuracy right
// where the point is brightest, so read a point's colour off its ring, not its core. The
// hue is never altered -- only how much white is mixed over it, and that mix is the same
// on every point.
const starHalo = 1.9;
const starBallEdge = 1 / starHalo;
const starFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0;
    float d = length(p);
    if (d > 1.0) discard;

    float r = d / ${starBallEdge.toFixed(6)};
    float body = 1.0 - smoothstep(0.35, 1.0, min(r, 1.0));
    float whiteness = pow(1.0 - smoothstep(0.0, 0.45, r), 2.0);
    float bloom = pow(max(0.0, 1.0 - d), 2.6) * 0.3;

    vec3 col = mix(vColor, vec3(1.0), whiteness * 0.72) * (0.85 + 0.5 * body);
    gl_FragColor = vec4(col, vAlpha * (body + bloom));
  }
`;

// --- v0.9: deep field -------------------------------------------------------------
// Mine. Each of the earlier versions won one thing and gave up another, so this one takes
// the winner of each and adds the one cue none of them had.
//
//   from v0.3  a lit body, so a point's size is a size you can judge
//   from v0.4  a bright Fresnel rim, so points in a crowd stay countable
//   from v0.5  a wide bloom, so dense regions glow and the cloud has air around it
//   new        an aerial-perspective depth fade: farther points hold less contrast
//
// The depth fade is the part I actually wanted. Every version so far draws a point the
// same whether it is at the front or the back of the cloud, so the only depth cues are
// perspective and the auto-rotation -- which is why the manifold reads as a flat tangle
// in a still frame. Fading with distance turns it into a volume you can see into. It is a
// camera effect and cannot be mistaken for data: it is normalised by the camera's own
// distance, so it is 1.0 at the cloud's centre at any zoom, and two identical points swap
// appearance as you orbit past them.
const deepHalo = 2.0;
const deepBallEdge = 1 / deepHalo;
const deepFieldFragment = /* glsl */ `
  ${VARYINGS}
  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0;
    float d = length(p);
    if (d > 1.0) discard;

    float r = d / ${deepBallEdge.toFixed(6)};
    float z = sqrt(max(0.0, 1.0 - min(1.0, r * r)));
    float inBall = 1.0 - smoothstep(0.97, 1.03, r);

    float core = 1.0 - smoothstep(0.5, 1.0, min(r, 1.0));
    float fresnel = pow(1.0 - z, 3.2);
    float lambert = clamp(dot(vec3(p / ${deepBallEdge.toFixed(6)}, z), ${LIGHT}), 0.0, 1.0);
    float specular = pow(lambert, 30.0) * 0.9;
    float bloom = pow(max(0.0, 1.0 - d), 2.4) * 0.34;

    float alpha = (core * 0.85 + fresnel * 0.7 + specular * 0.5) * inBall + bloom;
    vec3 col = vColor * (0.7 + inBall * (0.5 * lambert + 0.7 * fresnel)) + vec3(specular * inBall);
    gl_FragColor = vec4(col, vAlpha * alpha);
  }
`;

export const CLOUD_STYLES: CloudStyle[] = [
  {
    id: "v0.1",
    name: "Original",
    note: "The first cloud. Small dots of near-equal size, and threads on one blue ramp keyed to how long each thread is. No numbers. Kept exactly as it was, drawn by its own untouched file — which is why the size and number controls below are greyed out here.",
    original: true,
    haloScale: 1,
    maxBallPixels: 140,
    restColor: 0.7,
    recentColor: 0.9,
    restAlpha: 0.65,
    recentAlpha: 0.5,
    revealFloor: 0.5,
    blending: "additive",
    edgeOpacity: 0.5,
    fragmentShader: flatDiscFragment,
  },
  {
    id: "v0.2",
    name: "Flat disc",
    note: "Numbers and gradient threads arrive. Each point is a filled disc, shaded but with no glow around it, and points dim once their moment has passed — so the cloud reads soft and dark, and a big ball does not look much more solid than a small one.",
    haloScale: 1,
    maxBallPixels: 320,
    restColor: 0.7,
    recentColor: 0.9,
    restAlpha: 0.65,
    recentAlpha: 0.5,
    revealFloor: 0.5,
    blending: "additive",
    edgeOpacity: 0.5,
    fragmentShader: flatDiscFragment,
  },
  {
    id: "v0.3",
    name: "Lit bead",
    note: "Solid glowing beads. An opaque centre fades through a gradient into a soft glow, and one fixed light from the upper left adds shading and a highlight, so each point reads as a lit object. Points stay at full strength once played instead of dimming.",
    haloScale: beadHalo,
    maxBallPixels: 220,
    restColor: 1.0,
    recentColor: 0.45,
    restAlpha: 1.0,
    recentAlpha: 0,
    revealFloor: 0.3,
    blending: "additive",
    edgeOpacity: 0.5,
    fragmentShader: litBeadFragment,
  },
  {
    id: "v0.4",
    name: "Glass shell",
    note: "Hollow bubbles instead of solid beads: bright at the outline, nearly clear in the middle, like blown glass. In the crowded part of the cloud you can still count individual points and see the threads running behind them, where v0.3 merges into one bright mass. The smallest points fill in solid, because a ring that thin has no pixels to live in.",
    haloScale: shellHalo,
    maxBallPixels: 200,
    restColor: 1.0,
    recentColor: 0.5,
    restAlpha: 1.0,
    recentAlpha: 0,
    revealFloor: 0.3,
    blending: "additive",
    edgeOpacity: 0.62,
    fragmentShader: glassShellFragment,
  },
  {
    id: "v0.5",
    name: "Dust",
    note: "A tiny hard dot inside a big soft bloom. On its own a point is almost nothing, but where points crowd together the blooms stack into a bright glowing ridge while thin regions stay near black — so the cloud reads as a lit surface rather than a scatter. Loudness still reads, at a smaller on-screen size, as a wider glow.",
    haloScale: dustHalo,
    maxBallPixels: 150,
    restColor: 1.0,
    recentColor: 0.5,
    restAlpha: 1.0,
    recentAlpha: 0,
    revealFloor: 0.3,
    blending: "additive",
    edgeOpacity: 0.42,
    fragmentShader: dustFragment,
  },
  {
    id: "v0.6",
    name: "Plasma",
    note: "Glowing gas with stars in it. Each point is a wide, very faint cloud in its own colour that merges with its neighbours' into a body of gas, plus a hard two-pixel pinpoint. The pinpoint stays the same size at any zoom, so loudness reads through the size of each gas cloud rather than a disc you can measure — softer than v0.3, but it is what makes it look like a nebula.",
    haloScale: plasmaHalo,
    maxBallPixels: 140,
    restColor: 1.0,
    recentColor: 0.5,
    restAlpha: 1.0,
    recentAlpha: 0,
    revealFloor: 0.3,
    blending: "additive",
    edgeOpacity: 0.3,
    fragmentShader: plasmaFragment,
  },
  {
    id: "v0.7",
    name: "Matte",
    note: "Flat, even dots with no glow, no shading and no highlight at all. Nothing accumulates where points overlap, so a dense knot stays a knot instead of turning into a bright patch, and the threads stay readable because nothing is competing with them. The version to switch to when you want to read the cloud rather than enjoy it.",
    haloScale: 1,
    maxBallPixels: 200,
    restColor: 0.95,
    recentColor: 0.4,
    restAlpha: 0.95,
    recentAlpha: 0,
    revealFloor: 0.4,
    blending: "normal",
    edgeOpacity: 0.34,
    fragmentShader: matteFragment,
  },
  {
    id: "v0.8",
    name: "Starfield",
    note: "Bright specks: a white-hot centre with the colour in the falloff around it, and a little bloom. Jewel-like and it holds up when the cloud is small on screen. One thing to know while reading it — the white centre costs colour accuracy exactly where the point is brightest, so read a point's colour off its ring, not its middle.",
    haloScale: starHalo,
    maxBallPixels: 200,
    restColor: 1.0,
    recentColor: 0.45,
    restAlpha: 1.0,
    recentAlpha: 0,
    revealFloor: 0.3,
    blending: "additive",
    edgeOpacity: 0.5,
    fragmentShader: starFragment,
  },
  {
    id: "v0.9",
    name: "Deep field",
    note: "The best part of each earlier version plus the cue none of them had. A lit body so size stays judgeable (v0.3), a bright rim so crowded points stay countable (v0.4), a wide bloom so dense regions glow (v0.5) — and farther points now hold less contrast, which turns the manifold from a flat tangle into a volume you can see into. That fade follows the camera, not the data: it is the same at any zoom for a point at the cloud's centre, and two identical points swap appearance as you orbit past them.",
    haloScale: deepHalo,
    maxBallPixels: 180,
    restColor: 1.0,
    recentColor: 0.5,
    restAlpha: 1.0,
    recentAlpha: 0,
    revealFloor: 0.3,
    blending: "additive",
    edgeOpacity: 0.5,
    depthCue: 1,
    fragmentShader: deepFieldFragment,
  },
];

export const DEFAULT_VERSION: CloudVersionId = "v0.9";

export function cloudStyle(id: CloudVersionId): CloudStyle {
  return CLOUD_STYLES.find((style) => style.id === id) ?? CLOUD_STYLES[CLOUD_STYLES.length - 1];
}
