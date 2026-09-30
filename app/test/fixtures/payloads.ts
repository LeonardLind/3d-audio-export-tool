const point = (id: number) => ({
  id: `p${id}`, emissionTime: id * 0.25, position: [id, id + 1, id + 2],
  amplitude: 0.1 + id * 0.1, amplitudeNorm: id / 2,
  dominantFrequencyHz: 5426.3671875, colorT: 0.4,
  spectralCentroidHz: 3500, centroidNorm: 0.5,
  spectralFlux: 1, spectralFluxNorm: 0.2,
});

export function fullExport() {
  return {
    audioId: 'fixture', audioUrl: '/fixture.ogg', commonName: 'Fixture',
    generatedFrom: 'synthetic', pipeline: 'fixture', sampleRate: 22050,
    fftSize: 1024, samplingWindowSeconds: 0.16, samplingHopSeconds: 0.02,
    durationSeconds: 4, confidenceThreshold: 0,
    pcaExplainedVarianceTotal: 0.8, centroidMaxHz: 3500,
    spectralDescriptors: {}, pointCount: 3, points: [point(0), point(1), point(2)],
    similarityEdges: [[0, 2]], panels: {}, analysis: {}, birdnetDetections: null,
  };
}

export function appProfile() { return { kind: 'birdsong-cloud-view', cloud: fullExport(), displaySettings: {} }; }
export function browserUploadPartial() { return { ...fullExport(), audioUrl: null, sourceSampleRateHz: 48000, centroidTrack: [] }; }
export function cloudViewWrapper() { return { kind: 'birdsong-cloud-view', cloud: fullExport(), caption: 'Fixture' }; }
export function v3Payload() { return { ...fullExport(), contractVersion: 3 }; }
