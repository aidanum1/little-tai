import React from "react";
import { AbsoluteFill } from "remotion";
import { getFigureAsset } from "../characters/assets";
import type { Edition } from "../characters/figures";
import { FONTS } from "../theme";

/** Small technical caption for the viewer: which asset is on screen. */
export const Overlay3DLabel: React.FC<{ edition: Edition; procedural: boolean }> = ({ edition, procedural }) => {
  const asset = procedural ? null : getFigureAsset(edition.id);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", padding: 40, pointerEvents: "none" }}>
      <div style={{ fontFamily: FONTS.sans, color: "#ECE6D9", fontSize: 26, letterSpacing: "0.12em", opacity: 0.85 }}>
        {edition.label} · {asset ? `Tripo GLB · ${asset.triangles.toLocaleString()} tris` : "procedural stand-in"}
      </div>
    </AbsoluteFill>
  );
};
