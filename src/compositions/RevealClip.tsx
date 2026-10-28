import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useVideoConfig } from "remotion";
import { z } from "zod";
import { EDITIONS, getEdition, type EditionId } from "../characters/figures";
import { AssetGate } from "../components/AssetGate";
import { useLayout } from "../components/Overlay";
import { EditionReveal } from "../scenes/EditionReveal";
import { SecretReveal } from "../scenes/SecretReveal";
import { FONTS } from "../theme";

export const revealClipSchema = z.object({
  edition: z.enum(EDITIONS.map((e) => e.id) as [EditionId, ...EditionId[]]),
});

/** Score offsets (seconds) where each edition's reveal music sits in the full score. */
const MUSIC_FROM: Record<EditionId, number> = { dreamer: 4, shy: 8, rebel: 12, wanderer: 16, midnight: 25 };

const Brand: React.FC = () => {
  const { u } = useLayout();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 60 * u, pointerEvents: "none", background: "linear-gradient(0deg, rgba(3,4,8,0.7) 0%, rgba(3,4,8,0) 16%)" }}>
      <div style={{ fontFamily: FONTS.display, fontStyle: "italic", fontWeight: 600, fontSize: 52 * u, color: "rgba(236,230,217,0.9)", textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}>little TAI</div>
      <div style={{ fontFamily: FONTS.sans, fontSize: 20 * u, letterSpacing: "0.4em", color: "rgba(196,166,109,0.9)", marginTop: 6 * u }}>THE FEELINGS COLLECTION</div>
    </AbsoluteFill>
  );
};

/** Standalone 7-second product reveal for one edition (same choreography as the promo, more breathing room). */
export const RevealClip: React.FC<z.infer<typeof revealClipSchema>> = ({ edition: id }) => {
  const { durationInFrames, fps } = useVideoConfig();
  const edition = getEdition(id);
  return (
    <AssetGate>
      <AbsoluteFill style={{ background: "#000" }}>
        {edition.secret ? <SecretReveal durationInFrames={durationInFrames} clip /> : <EditionReveal edition={edition} durationInFrames={durationInFrames} clip />}
        <Brand />
        <Audio
          src={staticFile("audio/feelings-score.wav")}
          trimBefore={Math.round(MUSIC_FROM[id] * fps)}
          volume={(f) => interpolate(f, [0, 10, durationInFrames - 20, durationInFrames - 1], [0, 0.7, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      </AbsoluteFill>
    </AssetGate>
  );
};
