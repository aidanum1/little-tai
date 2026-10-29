import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getAnimatedAsset } from "../characters/assets";
import { RiggedFigure } from "../characters/RiggedFigure";
import { AssetGate } from "../components/AssetGate";
import { Floor } from "../components/SetPieces";
import { CameraRig, Stage, StudioLights } from "../components/Stage";
import { FONTS } from "../theme";

/** Dev-only contact sheet: every clip sampled every 0.5 s (frame i = one sample), for checking the retargets. */
const asset = getAnimatedAsset("rebel");
export const RIG_SAMPLES: { clip: string; time: number }[] = (asset?.animations ?? []).flatMap((a) =>
  Array.from({ length: Math.floor(a.duration / 0.5) + 1 }, (_, i) => ({ clip: a.name, time: i * 0.5 })),
);

export const RigPreview: React.FC<{ yaw: number }> = ({ yaw }) => {
  const frame = useCurrentFrame();
  const s = RIG_SAMPLES[Math.min(frame, RIG_SAMPLES.length - 1)];
  if (!asset || !s) return null;
  return (
    <AssetGate>
      <Stage backdrop="#2a2d38" overlay={<AbsoluteFill style={{ color: "#fff", fontFamily: FONTS.sans, fontSize: 40, padding: 30 }}>{`${s.clip} ${s.time.toFixed(1)}s`}</AbsoluteFill>}>
        <CameraRig position={[1.2, 0.9, 2.6]} target={[0, 0.55, 0]} fov={30} />
        <StudioLights />
        <Floor color="#3a3d48" />
        <RiggedFigure asset={asset} clips={[{ name: s.clip, time: s.time, weight: 1 }]} yaw={yaw} />
      </Stage>
    </AssetGate>
  );
};
