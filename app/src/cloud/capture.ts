/** Composite the current WebGL frame and its label/ring overlay into a PNG. */
export async function captureCloud(container: HTMLElement, notice?: string): Promise<Blob> {
  const canvases = container.querySelectorAll('canvas');
  if (canvases.length < 2) throw new Error('Cloud canvases are unavailable');
  const base = canvases[0], overlay = canvases[1];
  const output = document.createElement('canvas');
  output.width = base.width; output.height = base.height;
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('Canvas drawing is unavailable');
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(overlay, 0, 0, output.width, output.height);
  if (notice) {
    const scale = output.width / Math.max(1, base.clientWidth);
    ctx.font = `${12 * scale}px system-ui, sans-serif`;
    const maxWidth = output.width - 24 * scale;
    const lines: string[] = [];
    let line = '';
    for (const word of notice.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    const lineHeight = 18 * scale;
    const height = (lines.length + 1) * lineHeight;
    ctx.fillStyle = '#302719'; ctx.fillRect(0, output.height - height, output.width, height);
    ctx.fillStyle = '#ffe2a1'; ctx.textBaseline = 'top';
    lines.forEach((text, i) => ctx.fillText(text, 12 * scale, output.height - height + (i + .5) * lineHeight));
  }
  return new Promise<Blob>((resolve, reject) => output.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
}
