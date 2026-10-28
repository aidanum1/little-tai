import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useVideoConfig } from "remotion";
import { getEdition } from "../characters/figures";
import { AssetGate } from "../components/AssetGate";
import { Awakens } from "../scenes/Awakens";
import { Collection } from "../scenes/Collection";
import { EditionReveal } from "../scenes/EditionReveal";
import { Finale } from "../scenes/Finale";
import { SecretReveal } from "../scenes/SecretReveal";

/**
 * "little TAI — The Feelings Collection" promo. 36 s @ 30 fps = 1080 frames.
 * Each scene is padded by half a transition on each side, so the cut points land on the storyboard times
 * (0:04, 0:08, 0:12, 0:16, 0:20, 0:25, 0:32).
 */

export const FPS = 30;
export const TRANSITION = 12;
export const PROMO_DURATION = 36 * FPS;

const S = (seconds: number, first = false, last = false) => seconds * FPS + (first ? TRANSITION / 2 : last ? TRANSITION / 2 : TRANSITION);

export const SCENES = [
  { name: "01 The Collection Awakens", frames: S(4, true) },
  { name: "02 The Dreamer", frames: S(4) },
  { name: "03 The Shy One", frames: S(4) },
  { name: "04 The Little Rebel", frames: S(4) },
  { name: "05 The Wanderer", frames: S(4) },
  { name: "06 Collect Them All", frames: S(5) },
  { name: "07 Secret Edition", frames: S(7) },
  { name: "08 Final Collection", frames: S(4, false, true) },
] as const;

const Music: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile("audio/feelings-score.wav")}
      volume={(f) => interpolate(f, [0, 15, durationInFrames - 45, durationInFrames - 2], [0, 0.72, 0.72, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  );
};

const timing = linearTiming({ durationInFrames: TRANSITION });

export const Promo: React.FC<{ withMusic?: boolean }> = ({ withMusic = true }) => {
  const [s1, s2, s3, s4, s5, s6, s7, s8] = SCENES;
  return (
    <AssetGate>
      <AbsoluteFill style={{ background: "#000" }}>
        <TransitionSeries>
          <TransitionSeries.Sequence name={s1.name} durationInFrames={s1.frames}>
            <Awakens durationInFrames={s1.frames} />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={timing} />
          <TransitionSeries.Sequence name={s2.name} durationInFrames={s2.frames}>
            <EditionReveal edition={getEdition("dreamer")} durationInFrames={s2.frames} />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={timing} />
          <TransitionSeries.Sequence name={s3.name} durationInFrames={s3.frames}>
            <EditionReveal edition={getEdition("shy")} durationInFrames={s3.frames} />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={timing} />
          <TransitionSeries.Sequence name={s4.name} durationInFrames={s4.frames}>
            <EditionReveal edition={getEdition("rebel")} durationInFrames={s4.frames} />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={timing} />
          <TransitionSeries.Sequence name={s5.name} durationInFrames={s5.frames}>
            <EditionReveal edition={getEdition("wanderer")} durationInFrames={s5.frames} />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={timing} />
          <TransitionSeries.Sequence name={s6.name} durationInFrames={s6.frames}>
            <Collection durationInFrames={s6.frames} />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={timing} />
          <TransitionSeries.Sequence name={s7.name} durationInFrames={s7.frames}>
            <SecretReveal durationInFrames={s7.frames} />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition presentation={fade()} timing={timing} />
          <TransitionSeries.Sequence name={s8.name} durationInFrames={s8.frames}>
            <Finale durationInFrames={s8.frames} />
          </TransitionSeries.Sequence>
        </TransitionSeries>
        {withMusic ? <Music /> : null}
      </AbsoluteFill>
    </AssetGate>
  );
};
