function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function saveJson(payload: unknown, filename: string, pretty = false): void {
  saveBlob(new Blob([JSON.stringify(payload, null, pretty ? 2 : undefined)], { type: 'application/json' }), filename);
}

export function savePng(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}
