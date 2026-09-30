import type { AcceptedEvidence, FeatureId, GateInput, GateReason, GateState, OpenGate } from './types.ts';
import { axisName, finite, loadingBlock, object, viewBlock } from './blocks.ts';
import { evRule } from './evRule.ts';

export const FEATURES: readonly FeatureId[] = ['similarityLines', 'linkedMoments', 'viewQuality',
  'axisCaptions', 'axisLoadings', 'momentPlayback', 'uploadListening', 'description'];

function hidden(...reasons: GateReason[]): GateState { return { status: 'hidden', reasons }; }
function open(value: unknown, preview = false): GateState {
  return { status: preview ? 'preview' : 'shown', value: value as OpenGate<unknown> };
}

function evidenceReason(input: GateInput, ids: (keyof AcceptedEvidence)[]): GateReason | null {
  const { recording } = input;
  for (const id of ids) {
    const accepted = input.accepted[id];
    if (!accepted) return 'no-accepted-evidence';
    if (!/^[a-f0-9]{64}$/.test(accepted.resultsSha256) || !accepted.verificationRef
      || !accepted.decisionId || !accepted.acceptedOn || !object(accepted.summary)) return 'malformed-block';
    if (!recording || recording.contractVersion !== 2) return 'missing-payload-evidence';
    const blocks = object(recording.evidence);
    const block = blocks && object(blocks[id]);
    if (!block) return 'missing-payload-evidence';
    if (block.status !== 'decided') return 'status-not-decided';
    if (block.resultsSha256 !== accepted.resultsSha256) return 'sha-mismatch';
    if ((id === 'exp007' || id === 'exp008') && block.consistencyPassed !== true) return 'status-not-decided';
  }
  return null;
}

function validSpan(start: unknown, end: unknown, duration: number): boolean {
  return finite(start) && finite(end) && start >= 0 && start < end && end <= duration;
}

export function evaluateGates(input: GateInput): Record<FeatureId, GateState> {
  const gates = Object.fromEntries(FEATURES.map((feature) => [feature, hidden('no-accepted-evidence')])) as Record<FeatureId, GateState>;
  const { recording, accepted, approvedCopy, clipStatus } = input;
  if (!recording) return gates;
  const raw = recording.raw;
  const clipReady = clipStatus.status === 'ready' && clipStatus.clip.key === recording.key;
  const checked = (ids: (keyof AcceptedEvidence)[], copy: boolean, build: () => GateState): GateState => {
    const reason = evidenceReason(input, ids);
    return reason ? hidden(reason) : !copy ? hidden('copy-not-approved') : build();
  };

  gates.similarityLines = checked(['exp007', 'exp009', 'exp011'], approvedCopy.linesWording, () => {
    const decision = object(accepted.exp009?.summary);
    if (!decision || decision.outcome !== 'accepted') return hidden('space-not-approved');
    const space = raw.similaritySpace;
    if (space !== decision.space || raw.similarityNeighbors !== decision.k
      || raw.similarityMinTimeGapSeconds !== decision.gap) return hidden('malformed-block');
    if (space === 'E3' && input.view !== 7) return hidden('view-not-3d');
    if (space !== 'E3' && !approvedCopy.linesNonE3Wording) return hidden('copy-not-approved');
    return open({ edges: recording.similarityEdges, space });
  });
  gates.linkedMoments = gates.similarityLines;
  gates.viewQuality = checked(['exp007', 'exp008', 'exp011'], approvedCopy.viewQualityTerms, () => {
    const block = viewBlock(raw, input.view);
    if (!block) return hidden('malformed-block');
    return open({ ...block, variance: evRule(raw.pcaExplainedVarianceRatio, raw.pcaExplainedVarianceTotal, input.view) });
  });
  gates.axisCaptions = checked(['exp007', 'exp010', 'exp011'], approvedCopy.axisCaptions, () => {
    const axes = object(raw.axisMeaning);
    const display = object(raw.display);
    if (!axes || display?.axisEndsLabelled !== true) return hidden('malformed-block');
    const selected = [...axisName(input.view)].map((axis) => object(axes[axis]));
    if (selected.some((axis) => !axis || axis.status !== 'labelled' || typeof axis.caption !== 'string')) return hidden('malformed-block');
    return open(selected);
  });
  gates.axisLoadings = checked(['exp010', 'exp011'], approvedCopy.axisCaptions, () => {
    const axes = object(raw.axisMeaning);
    const loadings = loadingBlock(axes?.loadings);
    return loadings && typeof axes?.labelsDisabledStatement === 'string'
      ? open({ loadings, statement: axes.labelsDisabledStatement }) : hidden('malformed-block');
  });

  gates.momentPlayback = checked(['exp012A', 'exp012A8', 'exp011'], approvedCopy.timingCaveat, () => {
    if (recording.origin !== 'published') return hidden('not-applicable');
    const certification = object(accepted.exp012A?.summary);
    const constants = object(certification?.constants);
    if (!certification || !['R5', 'R6'].includes(String(certification.outcome)) || !constants
      || constants.sampleRate !== recording.sampleRate || constants.fftSize !== recording.fftSize
      || constants.stftHopSize !== raw.stftHopSize || constants.framesPerPoint !== raw.framesPerPoint
      || constants.spanSamples !== raw.audioSpanSamples) return hidden('span-not-certified');
    if (!recording.points.every((p) => validSpan(p.audioStartSeconds, p.audioEndSeconds, recording.durationSeconds))) return hidden('span-not-certified');
    if (!clipReady || clipStatus.status !== 'ready') return hidden('clip-unavailable');
    const clip = clipStatus.clip;
    if (clip.origin !== 'source-file' || clip.sampleRate !== recording.source?.sampleRateHz) return hidden('source-not-verified');
    const decoder = object(raw.decoder);
    const builds = certification.ffmpegBuilds;
    const blocked = certification.blockedSourceSha256;
    if (typeof raw.sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(raw.sourceSha256)
      || !Array.isArray(blocked) || blocked.includes(raw.sourceSha256)
      || !decoder || !Array.isArray(builds) || !builds.some((b) => {
        const build = object(b);
        return build && ['sha256', 'versionLine', 'platform', 'arch'].every((key) => build[key] === decoder[key] && typeof build[key] === 'string');
      })) return hidden('source-not-verified');
    const groups = object(accepted.exp012A8?.summary)?.passed;
    if (!Array.isArray(groups) || !groups.includes(raw.formatGroup)) return hidden('format-not-verified');
    if (!recording.points.every((p) => {
      const a = Math.round(p.audioStartSeconds! * clip.sampleRate);
      const b = Math.round(p.audioEndSeconds! * clip.sampleRate);
      return a >= 0 && b > a && b <= clip.buffer.length;
    })) return hidden('span-not-certified');
    return open(recording.points.map((p) => ({ startSeconds: p.audioStartSeconds, endSeconds: p.audioEndSeconds })));
  });
  // Listening to Upload analysis is deliberately closed until its wording is approved.
  gates.uploadListening = recording.origin !== 'upload' ? hidden('not-applicable')
    : !approvedCopy.uploadListening ? hidden('copy-not-approved')
      : !clipReady ? hidden('clip-unavailable')
        : input.selfCheck?.status !== 'passed' || input.selfCheck.matched !== recording.points.length
          ? hidden('self-check-failed') : open({ key: recording.key });

  gates.description = checked(['exp011'], approvedCopy.description, () => {
    const description = object(raw.description);
    const readability = description && object(description.readabilityStatus);
    const display = object(raw.display);
    if (!description || readability?.en !== 'reviewed' || !Array.isArray(description.sentences)
      || !display || display.labelCount !== 40 || display.style !== 'matte') return hidden('malformed-block');
    // Runtime requirements must name a known, currently shown feature. Unknown gates close.
    if (!description.sentences.every((entry) => {
      const sentence = object(entry);
      return sentence && typeof sentence.text === 'string' && Array.isArray(sentence.runtimeFeatures)
        && sentence.runtimeFeatures.every((feature) => FEATURES.includes(feature) && feature !== 'description' && gates[feature as FeatureId].status === 'shown');
    })) return hidden('malformed-block');
    return open(description);
  });

  if (input.env.build === 'dev' && input.env.preview) {
    if (input.view === 7 && gates.similarityLines.status === 'hidden' && recording.similarityEdges.length > 0) {
      gates.similarityLines = open({ edges: recording.similarityEdges, space: 'E3' }, true);
      gates.linkedMoments = gates.similarityLines;
    }
    if (clipReady && clipStatus.status === 'ready' && ['source-file', 'analysis-rate'].includes(clipStatus.clip.origin)
      && (recording.origin !== 'upload' || input.selfCheck?.status === 'passed' && input.selfCheck.matched === recording.points.length)
      && input.previewSpans?.length === recording.points.length
      && input.previewSpans.every((span) => validSpan(span.startSeconds, span.endSeconds, recording.durationSeconds)
        && Math.round(span.startSeconds * clipStatus.clip.sampleRate) < Math.round(span.endSeconds * clipStatus.clip.sampleRate)
        && Math.round(span.endSeconds * clipStatus.clip.sampleRate) <= clipStatus.clip.buffer.length)) {
      gates.momentPlayback = open(input.previewSpans, true);
    }
  }
  return gates;
}
