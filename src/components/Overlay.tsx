import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, rng } from "../animations/timing";
import { PALETTE } from "../characters/figures";
import { FONTS } from "../theme";

/** Typography and finishing layers. All sizes are relative to the composition width (1080 portrait / 1920 landscape). */

export const useLayout = () => {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const u = portrait ? width / 1080 : height / 1080; // type scale unit
  return { width, height, portrait, u, aspect: width / height };
};

/** Letters that rise out of a soft blur, staggered. */
export const RevealText: React.FC<{
  text: string;
  start: number;
  end?: number;
  stagger?: number;
  style: React.CSSProperties;
}> = ({ text, start, end, stagger = 1.2, style }) => {
  const frame = useCurrentFrame();
  const chars = Array.from(text);
  const out = end === undefined ? 1 : interpolate(frame, [end - 10, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  return (
    <div style={{ ...style, opacity: out, whiteSpace: "pre" }}>
      {chars.map((ch, i) => {
        const p = interpolate(frame, [start + i * stagger, start + i * stagger + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, translate: `0 ${(1 - p) * 0.35}em`, filter: `blur(${(1 - p) * 8}px)` }}>
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </div>
  );
};

/**
 * "01 — THE DREAMER" + mood words + hairline rule.
 * Portrait: top third (the reveal frames keep it empty; the box art lives in the lower half).
 * Landscape: lower left, beside the product.
 */
export const EditionTitle: React.FC<{
  number: string;
  name: string;
  mood?: string[];
  start: number;
  end: number;
  color?: string;
  accent?: string;
}> = ({ number, name, mood, start, end, color = PALETTE.cream, accent = PALETTE.gold }) => {
  const frame = useCurrentFrame();
  const { portrait, u } = useLayout();
  const rule = interpolate(frame, [start + 6, start + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.out });
  const inn = interpolate(frame, [start - 6, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [end - 12, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shadow = "0 2px 24px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.4)";
  return (
    <>
      <AbsoluteFill
        style={{
          background: portrait
            ? "linear-gradient(180deg, rgba(3,4,8,0.62) 0%, rgba(3,4,8,0.35) 22%, rgba(3,4,8,0) 38%)"
            : "linear-gradient(90deg, rgba(3,4,8,0.6) 0%, rgba(3,4,8,0.25) 30%, rgba(3,4,8,0) 45%)",
          opacity: inn * out,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: portrait ? "flex-start" : "flex-end",
          alignItems: portrait ? "center" : "flex-start",
          padding: portrait ? `${150 * u}px ${80 * u}px 0` : `0 ${150 * u}px ${130 * u}px`,
          opacity: out,
          pointerEvents: "none",
        }}
      >
        <RevealText
          text={`${number} —`}
          start={start}
          stagger={1.5}
          style={{ fontFamily: FONTS.sans, fontWeight: 400, fontSize: 50 * u, letterSpacing: "0.32em", color: accent, textShadow: shadow, marginBottom: 10 * u }}
        />
        <RevealText
          text={name}
          start={start + 6}
          stagger={1.1}
          style={{ fontFamily: FONTS.serif, fontWeight: 600, fontSize: (portrait ? 92 : 104) * u, letterSpacing: "0.06em", color, textShadow: shadow, lineHeight: 1.05, textAlign: portrait ? "center" : "left" }}
        />
        <div style={{ height: 2, width: (portrait ? 420 : 520) * u * rule, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, margin: `${22 * u}px 0` }} />
        {mood ? (
          <RevealText
            text={mood.join("  ·  ")}
            start={start + 18}
            stagger={0.5}
            style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontWeight: 500, fontSize: 46 * u, color, opacity: 0.92, textShadow: shadow }}
          />
        ) : null}
      </AbsoluteFill>
    </>
  );
};

/** Centered caption line (used for taglines). */
export const Caption: React.FC<{ text: string; start: number; end: number; y?: number; size?: number; italic?: boolean; color?: string; tracking?: string; family?: string }> = ({
  text,
  start,
  end,
  y = 0.78,
  size = 64,
  italic = true,
  color = PALETTE.cream,
  tracking = "0.01em",
  family = FONTS.serif,
}) => {
  const { u, height } = useLayout();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: height * y, left: 0, right: 0, display: "flex", justifyContent: "center", padding: `0 ${90 * u}px` }}>
        <RevealText
          text={text}
          start={start}
          end={end}
          stagger={0.9}
          style={{
            fontFamily: family,
            fontStyle: italic ? "italic" : "normal",
            fontWeight: 500,
            fontSize: size * u,
            letterSpacing: tracking,
            color,
            textAlign: "center",
            textShadow: "0 2px 30px rgba(0,0,0,0.7)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

let grainTile: HTMLCanvasElement | null = null;
const grainSource = () => {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(256, 256);
  const r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(r() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c;
  return c;
};

/** Film grain drawn synchronously into a canvas each frame (seeded offset), so nothing has to load. */
const Grain: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    const r = rng(frame * 13 + 7);
    const pattern = ctx.createPattern(grainSource(), "repeat")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.translate(-Math.floor(r() * 256), -Math.floor(r() * 256));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width + 256, height + 256);
  }, [frame, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, mixBlendMode: "overlay" }} />;
};

/** Vignette + animated film grain + optional colour wash. */
export const FilmGrade: React.FC<{ vignette?: number; grain?: number; tint?: string; tintOpacity?: number }> = ({ vignette = 0.55, grain: g = 0.06, tint, tintOpacity = 0 }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {tint ? <AbsoluteFill style={{ background: tint, opacity: tintOpacity, mixBlendMode: "soft-light" }} /> : null}
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 65% at 50% 46%, transparent 45%, rgba(4,5,10,${vignette}) 100%)` }} />
    <Grain opacity={g} />
  </AbsoluteFill>
);

export const Fade: React.FC<{ from: number; to: number; color?: string; inverse?: boolean }> = ({ from, to, color = "#000", inverse = false }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [from, to], inverse ? [1, 0] : [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} />;
};
