import type { CloudRecording } from '../data/types.ts';
import type { AxisMask } from '../state/types.ts';

const OMITTED_PANEL_FIELDS = ['frames', 'chroma', 'descriptors', 'descriptorRanges'] as const;

export function buildExportCloud(raw: Record<string, unknown>): Record<string, unknown> {
  const cloud = { ...raw };
  delete cloud.birdnetDetections;
  if (cloud.panels && typeof cloud.panels === 'object' && !Array.isArray(cloud.panels)) {
    const panels = { ...cloud.panels } as Record<string, unknown>;
    for (const field of OMITTED_PANEL_FIELDS) delete panels[field];
    cloud.panels = panels;
  }
  if (cloud.analysis && typeof cloud.analysis === 'object' && !Array.isArray(cloud.analysis)) {
    const analysis = { ...cloud.analysis } as Record<string, unknown>;
    delete analysis.selfSimilarity;
    cloud.analysis = analysis;
  }
  return cloud;
}

export function buildViewExport(recording: CloudRecording, options: {
  axes: AxisMask; caption?: string; exportedAt?: string; styleDefinition?: Record<string, unknown>;
}) {
  return {
    kind: 'birdsong-cloud-view' as const,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    caption: options.caption ?? recording.commonName,
    displaySettings: { style: 'v0.7-matte', axes: options.axes, labelValue: 'dominantFrequencyHz', labelCount: 40 },
    styleDefinition: options.styleDefinition ?? { id: 'v0.7-matte' },
    cloud: buildExportCloud(recording.raw),
  };
}
