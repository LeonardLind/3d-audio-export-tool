// Renders a full time-series grid (spectrogram or chromagram) to an offscreen canvas
// ONCE, 1px per time/frequency cell. The visible panels then just drawImage a scrolled,
// scaled slice each animation frame -- far cheaper than re-filling thousands of rects at
// 60fps. Row 0 (lowest frequency / pitch class C) is placed at the BOTTOM.
export function buildBitmap(
  cols: number,
  rows: number,
  rgbAt: (col: number, row: number) => [number, number, number],
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(cols, rows);
  for (let x = 0; x < cols; x += 1) {
    for (let r = 0; r < rows; r += 1) {
      const [red, green, blue] = rgbAt(x, r);
      const y = rows - 1 - r;
      const index = (y * cols + x) * 4;
      image.data[index] = red;
      image.data[index + 1] = green;
      image.data[index + 2] = blue;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// Compute a fixed-width [start, end] window that tracks playback time `t` but stays
// pinned inside [0, lastTime], so the view scrolls smoothly without ever showing blank
// space past either end of the recording.
export function scrollWindow(t: number, windowSeconds: number, lastTime: number) {
  const maxStart = Math.max(0, lastTime - windowSeconds);
  const start = Math.min(Math.max(0, t - windowSeconds), maxStart);
  return { start, end: start + windowSeconds };
}
