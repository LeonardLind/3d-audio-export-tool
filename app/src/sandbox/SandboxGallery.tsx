import type { RefObject } from "react";
import { GalleryCard } from "./GalleryCard";
import { PitchTrajectory } from "./PitchTrajectory";
import { SyllableConstellation } from "./SyllableConstellation";
import { SelfSimilarityPlot } from "./SelfSimilarityPlot";
import { FrequencyOccupancy } from "./FrequencyOccupancy";
import { AcousticIndicesViz } from "./AcousticIndicesViz";
import { SpeciesConfidence } from "./SpeciesConfidence";
import { DetectionTimeline } from "./DetectionTimeline";
import type { RecordingPayload } from "../types";

// Experimental prototype gallery. Each card is self-contained and reads only from the
// precomputed payload (analysis extracted offline in tools/lib/analysis.js) -- nothing here
// is coupled to the 3D scene, and none of it drives the D-010 position. Descriptions follow
// the requested what / how / why / provenance structure. See
// 08_Visualization_Sandbox/Bioacoustics_Research.md for the sourced background.
export function SandboxGallery({
  payload,
  audioRef,
}: {
  payload: RecordingPayload;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const { analysis, panels, durationSeconds, birdnetDetections } = payload;
  const nyquist = panels.nyquistHz;
  const hasRealBirdnet = !!birdnetDetections && birdnetDetections.detections.length > 0;

  return (
    <div className="sandbox">
      <div className="sandbox-intro">
        <h2>Bioacoustics Sandbox</h2>
        <p>
          A prototype gallery of experimental analyses of the loaded audio. Everything is derived offline from the same
          recording driving the 3D view; play the audio and the playhead markers track along. Cards marked{" "}
          <span className="badge badge-real">REAL AUDIO</span> use values extracted from this file;{" "}
          <span className="badge badge-demo">DEMO DATA</span> shows an intended layout not yet wired to real input. Use
          the source switch above to compare this clean/demo clip against a real field recording — several thresholds
          here were tuned on one clip and quietly broke on the other; see{" "}
          <code>08_Visualization_Sandbox/Field_Recording_Findings.md</code> for what broke, why, and how it was fixed.
          Sourced background: <code>08_Visualization_Sandbox/Bioacoustics_Research.md</code>.
        </p>
      </div>

      <div className="gallery">
        {hasRealBirdnet && (
          <GalleryCard
            title="Detection Timeline"
            badge="real"
            wide
            description={
              <>
                <b>What:</b> BirdNET species identification connected directly to the timeline, instead of living as an
                isolated confidence list. <b>How:</b> each 3s analysis chunk is a stacked column — segment height is that
                species' confidence, so an unambiguous chunk reads as one tall block and a contested chunk reads as
                several partial blocks. White ticks mark chunk-to-chunk changes in the top species. <b>Why:</b> lets a
                stakeholder see not just "what species" but "how confidently, and does it change over time" in one view.{" "}
                <b>Real-data finding:</b> without location/date filtering, several acoustically-similar global species
                genuinely compete most of the time — only the recording's clearest moment resolves decisively. That
                ambiguity is shown deliberately, not hidden behind a single falsely-confident label. See{" "}
                <code>08_Visualization_Sandbox/Field_Recording_Findings.md</code>.
              </>
            }
          >
            <DetectionTimeline birdnet={birdnetDetections!} duration={durationSeconds} panels={panels} audioRef={audioRef} />
          </GalleryCard>
        )}

        <GalleryCard
          title="Pitch Trajectory"
          badge="real"
          description={
            <>
              <b>What:</b> the fundamental frequency (perceived pitch) over time, log-scaled; background bands colored
              by BirdNET's top species per chunk. <b>How:</b> Harmonic Product Spectrum per frame — the spectrum
              multiplied by downsampled copies so harmonics reinforce the true f0; point brightness = voicing
              confidence. <b>Why:</b> pitch contour is one of the most individual- and species-diagnostic single-note
              features in birdsong. <b>Real-data finding:</b> on a noisy 60s field recording, only ~1% of frames reach
              high voicing confidence (vs. clear peaks on the clean sample clip) — the estimator is conservative rather
              than wrong: its highest-confidence moments line up exactly with the syllables the segmentation below also
              finds cleanest.
            </>
          }
        >
          <PitchTrajectory pitch={analysis.pitch} panels={panels} birdnet={birdnetDetections} duration={durationSeconds} audioRef={audioRef} />
        </GalleryCard>

        <GalleryCard
          title="Syllable Constellation"
          badge="real"
          description={
            <>
              <b>What:</b> each detected syllable as a node (x = onset, y = peak frequency, size = loudness), outer ring
              colored by BirdNET's top species during that syllable. <b>How:</b> amplitude-envelope thresholding above
              the 85th percentile of this recording's own frame-loudness distribution; gaps &lt;60 ms merged, blips
              &lt;35 ms dropped. <b>Why:</b> exposes call structure, note spacing and frequency range. <b>Tuning note:</b>{" "}
              originally thresholded at 18% of the single loudest frame — on a real recording, one loud outlier dragged
              that threshold up and starved detection (5 syllables found in 60s of near-continuous calling). Switched to
              a percentile-of-the-distribution threshold, which is robust to that one outlier (now 49 syllables,
              matching the near-continuous ground truth).
            </>
          }
        >
          <SyllableConstellation
            data={analysis.syllables}
            nyquist={nyquist}
            duration={durationSeconds}
            panels={panels}
            birdnet={birdnetDetections}
            audioRef={audioRef}
          />
        </GalleryCard>

        <GalleryCard
          title="Self-Similarity Matrix"
          badge="real"
          description={
            <>
              <b>What:</b> every moment compared to every other. <b>How:</b> cosine similarity between {analysis.selfSimilarity.n} sampled
              time points; bright = alike. Resolution scales with recording length (~4 samples/sec, capped) rather than
              a fixed 100×100, so a longer clip doesn't get proportionally coarser. <b>Why:</b> off-diagonal bright
              blocks reveal repeated phrases/calls — a direct read on song structure and repetition without any labels.
            </>
          }
        >
          <SelfSimilarityPlot data={analysis.selfSimilarity} duration={durationSeconds} audioRef={audioRef} />
        </GalleryCard>

        <GalleryCard
          title="Frequency Occupancy"
          badge="real"
          description={
            <>
              <b>What:</b> the fraction of time each frequency band is meaningfully louder than its own typical level.{" "}
              <b>How:</b> the spectrum is split into 10 bands; a band counts as active when it's &gt;80% louder than
              its own median energy. <b>Why:</b> shows which part of the spectrum the sound lives in. <b>Tuning
              note:</b> originally thresholded at 20% of each band's peak — on a genuinely noisy real recording, the
              ambient floor rarely dropped far below the single loudest moment, so every band above 1.1kHz saturated to
              ~100% occupancy and the metric stopped discriminating. Comparing against the band's own median instead of
              its peak fixed this (real recording now shows a clear peak in one band, not a flat 100% everywhere).
            </>
          }
        >
          <FrequencyOccupancy indices={analysis.indices} nyquist={nyquist} />
        </GalleryCard>

        <GalleryCard
          title="Soundscape Indices"
          badge="real"
          description={
            <>
              <b>What:</b> standard ecoacoustic indices — ACI, ADI, AEI, Bioacoustic Index, acoustic entropy H, and NDSI
              (biophony vs. anthrophony). <b>How:</b> computed per their published formulas over this recording (see
              research doc for citations). <b>Why:</b> these are the metrics used in biodiversity monitoring to summarize
              a soundscape — but they're habitat-dependent, so treat single-clip values as indicative, not absolute.
            </>
          }
        >
          <AcousticIndicesViz aci={analysis.aci} indices={analysis.indices} />
        </GalleryCard>

        <GalleryCard
          title="Species Confidence"
          badge={hasRealBirdnet ? "real" : "demo"}
          description={
            hasRealBirdnet ? (
              <>
                <b>What:</b> per-species detection confidence from the real BirdNET model. <b>How:</b> the official
                BirdNET v2.4 weights (Kahl et al. 2021) run locally via ONNX Runtime — the recording is split into 3s
                chunks at 48 kHz and each chunk scored against 6,522 species; bars show each species' best confidence
                (sigmoid of the model's logit) anywhere in the clip. <b>Why:</b> turns raw audio into species-level
                detections for monitoring — but the score is not a calibrated probability, and no location/date
                filtering is applied here (the website's species-range model is separate), so results can differ
                slightly from a location-filtered run. <b>Provenance: real inference on this audio file.</b>
              </>
            ) : (
              <>
                <b>What:</b> per-species detection confidence. <b>How:</b> on real field recordings this reads the
                BirdNET/model-consensus detections; the real BirdNET model wasn't available when this dataset was
                exported, so these are illustrative values. <b>Why:</b> turns raw audio into species-level information
                for monitoring — but BirdNET scores aren't calibrated probabilities, so a confidence threshold matters.{" "}
                <b>Provenance: demonstration values.</b>
              </>
            )
          }
        >
          <SpeciesConfidence result={birdnetDetections} />
        </GalleryCard>
      </div>
    </div>
  );
}
