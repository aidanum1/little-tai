import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile } from "remotion";

/** Original synthesised effects in public/audio/sfx (scripts/audio/generate-sfx.ts). */
export type SfxName =
  | "star-twinkle"
  | "whoosh-soft"
  | "whoosh-down"
  | "spin-whoosh"
  | "cardboard-open"
  | "flaps-open"
  | "paper-flutter"
  | "lid-pop"
  | "star-burst"
  | "rise-shimmer"
  | "rise-shimmer-dark"
  | "spotlight-on"
  | "box-land"
  | "lid-lift-luxe"
  | "star-ignite"
  | "finale-chimes"
  | "clock-tick"
  | "tiptoe"
  | "switch-click"
  | "light-buzz"
  | "boing";

/** A sound effect cued at a scene-local frame (render it in the HTML overlay, not inside the 3D canvas). */
export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number }> = ({ name, at, volume = 0.8 }) => (
  <Sequence from={Math.max(0, Math.round(at))} layout="none" name={`sfx · ${name}`}>
    <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
