import React from "react";
import { z } from "zod";
import { EDITIONS, getEdition, type EditionId } from "../characters/figures";
import { AssetGate } from "../components/AssetGate";
import { FilmGrade } from "../components/Overlay";
import { Floor } from "../components/SetPieces";
import { CameraRig, Stage, StudioLights } from "../components/Stage";
import { BlindBox } from "../packaging/BlindBox";
import { BOX } from "../packaging/boxTextures";

export const boxShotSchema = z.object({
  edition: z.enum(EDITIONS.map((e) => e.id) as [EditionId, ...EditionId[]]),
});

/** Packaging key art: the sealed box in a three-quarter studio view (still). */
export const BoxShot: React.FC<z.infer<typeof boxShotSchema>> = ({ edition: id }) => {
  const e = getEdition(id);
  return (
    <AssetGate>
      <Stage backdrop={e.secret ? "radial-gradient(ellipse at 50% 40%, #2a1016 0%, #07060a 70%)" : "radial-gradient(ellipse at 50% 40%, #2c3346 0%, #10131b 72%)"} exposure={1.05} overlay={<FilmGrade vignette={0.45} grain={0.025} />}>
        <CameraRig position={[1.75, 1.45, 3.6]} target={[0.05, BOX.h * 0.5, 0]} fov={30} />
        <StudioLights rimA={e.palette.glow} rimB="#FFE3C9" shadowFocus={[0, 0.7, 0]} />
        <Floor color={e.secret ? "#120c10" : "#1f2433"} />
        <group rotation={[0, 0.32, 0]}>
          <BlindBox edition={e} open={0} />
        </group>
      </Stage>
    </AssetGate>
  );
};
