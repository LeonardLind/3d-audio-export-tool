import type { CloudRecording } from '../data/types.ts';
import type { AxisMask } from '../state/types.ts';
import type { ClipStatus } from '../audio/types.ts';

export type FeatureId = 'similarityLines' | 'linkedMoments' | 'viewQuality' | 'axisCaptions' |
  'axisLoadings' | 'momentPlayback' | 'uploadListening' | 'description';

export type GateReason =
  | 'no-accepted-evidence' | 'missing-payload-evidence' | 'status-not-decided'
  | 'sha-mismatch' | 'malformed-block' | 'copy-not-approved' | 'view-not-3d'
  | 'space-not-approved' | 'clip-unavailable' | 'span-not-certified'
  | 'source-not-verified' | 'format-not-verified' | 'self-check-failed'
  | 'production-preview-disabled' | 'not-applicable';

declare const gateBrand: unique symbol;
export type OpenGate<T> = Readonly<T> & { readonly [gateBrand]: true };

export type GateState<T = unknown> =
  | { status: 'hidden'; reasons: GateReason[] }
  | { status: 'shown'; value: OpenGate<T> }
  | { status: 'preview'; value: OpenGate<T> };

export interface AcceptedRecord<T = unknown> {
  resultsPath: string;
  resultsSha256: string;
  decisionId: string;
  acceptedOn: string;
  verificationRef: string;
  summary: T;
}

export type AcceptedEvidence = Record<'exp007' | 'exp008' | 'exp009' | 'exp010' | 'exp011' | 'exp012A' | 'exp012A8', AcceptedRecord | null>;
export type ApprovedCopy = Record<'linesWording' | 'linesNonE3Wording' | 'viewQualityTerms' | 'axisCaptions' | 'uploadListening' | 'timingCaveat' | 'description', boolean>;

export interface GateEnv { build: 'dev' | 'prod'; preview: boolean }
export interface PreviewData {
  key: string;
  spans: ReadonlyArray<{ startSeconds: number; endSeconds: number }>;
  notice: string;
}
export interface GateInput {
  recording: CloudRecording | null;
  accepted: AcceptedEvidence;
  approvedCopy: ApprovedCopy;
  env: GateEnv;
  view: AxisMask;
  clipStatus: ClipStatus;
  selfCheck?: { status: 'pending' | 'passed' | 'failed'; matched?: number; total?: number };
  previewSpans?: ReadonlyArray<{ startSeconds: number; endSeconds: number }>;
}
