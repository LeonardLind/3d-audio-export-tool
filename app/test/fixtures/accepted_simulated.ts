import type { AcceptedEvidence, ApprovedCopy } from '../../src/evidence/types.ts';

const hashes = {
  exp007: 'a'.repeat(64), exp008: 'b'.repeat(64), exp009: 'c'.repeat(64),
  exp010: 'd'.repeat(64), exp011: 'e'.repeat(64), exp012A: 'f'.repeat(64), exp012A8: '1'.repeat(64),
} as const;

export const SIMULATED_ACCEPTED = Object.fromEntries(Object.entries(hashes).map(([id, resultsSha256]) => [id, {
  resultsPath: `simulated/${id}`, resultsSha256, decisionId: 'SIMULATED',
  acceptedOn: '2099-01-01', verificationRef: 'fixture', summary: {},
}])) as AcceptedEvidence;

export const SIMULATED_COPY: ApprovedCopy = {
  linesWording: true, linesNonE3Wording: true, viewQualityTerms: true,
  axisCaptions: true, uploadListening: true, timingCaveat: true, description: true,
};
