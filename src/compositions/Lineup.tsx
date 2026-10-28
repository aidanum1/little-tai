import React from "react";
import { AbsoluteFill } from "remotion";
import { AssetGate } from "../components/AssetGate";
import { FilmGrade } from "../components/Overlay";
import { Stage } from "../components/Stage";
import { FinaleSet, FinaleTitle } from "../scenes/Finale";

/** Final lineup key art (still): the five figures with the collection title, from the finale set. */
export const Lineup: React.FC = () => (
  <AssetGate>
    <Stage
      backdrop="radial-gradient(ellipse 100% 70% at 50% 30%, #262a3b 0%, #11131b 55%, #050608 100%)"
      exposure={1.02}
      envIntensity={0.6}
      overlay={
        <>
          <FinaleTitle start={-200} gather={1} />
          <FilmGrade vignette={0.55} grain={0.03} />
        </>
      }
    >
      <FinaleSet t={1.2} pull={1} />
    </Stage>
    <AbsoluteFill style={{ pointerEvents: "none" }} />
  </AssetGate>
);
