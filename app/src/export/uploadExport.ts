import type { BrowserAnalysis } from '../analysis/pipeline.ts';

export function uploadAssetId(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'uploaded_clip';
}

export function buildUploadExport(analysis: BrowserAnalysis, assetId: string, species = ''): BrowserAnalysis {
  const id = assetId.trim() || analysis.audioId;
  return {
    ...analysis,
    audioId: id,
    commonName: species.trim() || analysis.commonName,
    audioUrl: `/assets/${analysis.generatedFrom}`,
    points: id === analysis.audioId ? analysis.points : analysis.points.map((point) => ({
      ...point, id: `${id}_${point.emissionTime.toFixed(3)}`,
    })),
  };
}

export function uploadExportFilename(payload: Pick<BrowserAnalysis, 'audioId'>): string {
  return `${payload.audioId}_cloud.json`;
}
