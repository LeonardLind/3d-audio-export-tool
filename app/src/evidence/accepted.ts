import type { AcceptedEvidence, ApprovedCopy } from './types.ts';

// Acceptance changes require the owner's review of independently verified results.
export const ACCEPTED_EVIDENCE: AcceptedEvidence = Object.freeze({
  exp007: null, exp008: null, exp009: null, exp010: null,
  exp011: null, exp012A: null, exp012A8: null,
});
export const APPROVED_COPY: ApprovedCopy = Object.freeze({
  linesWording: false, linesNonE3Wording: false, viewQualityTerms: false,
  axisCaptions: false, uploadListening: false, timingCaveat: false, description: false,
});
