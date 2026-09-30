import { useMemo } from 'react';
import { evaluateGates } from './gates.ts';
import { ACCEPTED_EVIDENCE, APPROVED_COPY } from './accepted.ts';
import type { CloudRecording } from '../data/types.ts';
import type { ClipStatus } from '../audio/types.ts';
import type { AxisMask } from '../state/types.ts';
import { verifyAnalysisSpans } from '../audio/selfCheck.ts';

export function useGates(recording: CloudRecording | null, clipStatus: ClipStatus, view: AxisMask,
  preview = false, previewSpans?: ReadonlyArray<{ startSeconds: number; endSeconds: number }>) {
  const selfCheck = useMemo(() => recording?.origin === 'upload' && clipStatus.status === 'ready'
    && clipStatus.clip.key === recording.key ? verifyAnalysisSpans(clipStatus.clip.mono, recording.points) : undefined,
  [recording, clipStatus]);
  return useMemo(() => evaluateGates({ recording, clipStatus, view, previewSpans, selfCheck,
    accepted: ACCEPTED_EVIDENCE, approvedCopy: APPROVED_COPY,
    env: { build: import.meta.env.DEV ? 'dev' : 'prod', preview },
  }), [recording, clipStatus, view, preview, previewSpans, selfCheck]);
}
