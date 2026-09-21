import type { RecordingPayload } from "./types";

// The top of any frequency axis drawn for this recording.
//
// Panels used to scale to panels.nyquistHz, the analysis Nyquist. That is the highest
// frequency the STFT reached, which is not the same as the highest frequency the RECORDING
// contains: the pipeline decodes everything to a fixed analysis rate, so a narrow-band file
// gets upsampled and its top bins hold resampler artifacts rather than signal. An axis drawn
// to the analysis Nyquist presents that empty band as if it had been measured -- which is
// where the apparent "fixed 0-8 kHz range" came from: it was simply the source Nyquist of
// 16 kHz material, baked in rather than derived.
//
// The generator now states the usable band explicitly, so prefer it. Datasets exported
// before that fall back to the old behavior, which is correct for them (they were all
// exported from full-band sources at the analysis rate).
export function displayMaxHz(payload: RecordingPayload): number {
  const declared = payload.frequencyRange?.maxHz;
  return declared && declared > 0 ? declared : payload.panels.nyquistHz;
}
