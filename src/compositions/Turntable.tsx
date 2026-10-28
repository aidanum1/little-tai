import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { Figure } from "../characters/Figure";
import { EDITIONS, getEdition, type EditionId } from "../characters/figures";
import { AssetGate } from "../components/AssetGate";
import { Overlay3DLabel } from "../components/Labels";
import { Floor } from "../components/SetPieces";
import { CameraRig, Stage, StudioLights } from "../components/Stage";
import { BlindBox } from "../packaging/BlindBox";

export const turntableSchema = z.object({
  edition: z.enum(EDITIONS.map((e) => e.id) as [EditionId, ...EditionId[]]),
  subject: z.enum(["figure", "box", "both"]),
  procedural: z.boolean(),
  /** Box opening progress override (−1 = animate open/close with the turntable). */
  boxOpen: z.number().min(-1).max(1),
});

/**
 * 3D model viewer: a turntable for any edition's figure (generated GLB or procedural stand-in) and/or its box.
 * Use it in Remotion Studio to inspect assets; props are editable in the sidebar.
 */
export const Turntable: React.FC<z.infer<typeof turntableSchema>> = ({ edition: id, subject, procedural, boxOpen }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const edition = getEdition(id);
  const t = frame / fps;
  const yaw = (frame / durationInFrames) * Math.PI * 2;
  const open = boxOpen >= 0 ? boxOpen : 0.5 - 0.5 * Math.cos(yaw);
  const both = subject === "both";
  return (
    <AssetGate>
      <Stage backdrop="radial-gradient(ellipse at 50% 40%, #2a3045 0%, #12141c 70%)" exposure={1.05} overlay={<Overlay3DLabel edition={edition} procedural={procedural} />}>
        <CameraRig position={[0, both ? 1.4 : 0.9, both ? 5.6 : 3.4]} target={[0, both ? 0.85 : 0.58, 0]} fov={30} />
        <StudioLights rimA={edition.palette.glow} rimB="#FFD9C2" />
        <Floor color="#262b3a" />
        <group rotation={[0, yaw, 0]}>
          {subject !== "box" ? (
            <group position={[both ? 0.8 : 0, 0.05, 0]}>
              <Figure edition={edition} t={t} procedural={procedural} />
            </group>
          ) : null}
          {subject !== "figure" ? (
            <group position={[both ? -0.75 : 0, 0, 0]}>
              <BlindBox edition={edition} open={open} />
            </group>
          ) : null}
        </group>
      </Stage>
    </AssetGate>
  );
};
