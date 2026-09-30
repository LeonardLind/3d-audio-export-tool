import type { CopyEntry } from './define.ts';

// Frozen templates only. Their presence here does not approve them for visitors.
// C20 also withholds any feature whose mandatory wording has not been audited.
export const GATED_COPY = {
  projection: { id: 'gated.projection', en: 'closest in this 3D projection',
    basis: { kind: 'verbatim', notebook: 'Experiment_007_Reducer_Rebenchmark_Production_Regime.md', line: 383 } },
  inconclusive: { id: 'gated.inconclusive', en: 'below the pre-committed margin (inconclusive)',
    basis: { kind: 'verbatim', notebook: 'Experiment_008_Display_Views_Information_Preservation.md', line: 349 } },
  margin: { id: 'gated.margin', en: 'not shown to beat a random matrix by the 0.02 margin',
    basis: { kind: 'verbatim', notebook: 'Experiment_008_Display_Views_Information_Preservation.md', line: 350 } },
  random: { id: 'gated.random', en: 'not better than a random matrix of the same size',
    basis: { kind: 'verbatim', notebook: 'Experiment_008_Display_Views_Information_Preservation.md', line: 352 } },
  decoding: { id: 'gated.decoding', en: 'Audio offsets verified against V decoding only. Browser playback alignment is not verified for this file format.',
    basis: { kind: 'verbatim', notebook: 'Experiment_012_Compare_Mode_Timing_and_Grid_Sensitivity.md', line: 585 } },
} satisfies Record<string, CopyEntry>;
