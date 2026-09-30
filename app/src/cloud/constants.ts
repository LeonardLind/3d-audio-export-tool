// Copied from the v0.7 entry in components/cloudStyles.ts and ParticleFieldV2.tsx.
export const MATTE = {
  id: 'v0.7', name: 'Matte', haloScale: 1, maxBallPixels: 200,
  restColor: 0.95, recentColor: 0.4, restAlpha: 0.95, recentAlpha: 0,
  revealFloor: 0.4, blending: 'normal', edgeOpacity: 0.34,
} as const;
export const SIZE_SCALE = 62;
export const MIN_RADIUS_FRACTION = 0.035;
export const REVEAL_SECONDS = 0.28;
export const RECENT_SECONDS = 0.7;
export const TRAIL_SECONDS = 1.5;
export const LABEL_PIXEL_HEIGHT = 13;
export const LABEL_GAP_PIXELS = 3;
export const LABEL_COUNT = 40;
