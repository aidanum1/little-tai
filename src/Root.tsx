import React from "react";
import { Composition, Folder, Still } from "remotion";
import { BoxShot, boxShotSchema } from "./compositions/BoxShot";
import { CollectibleCard, cardSchema } from "./compositions/CollectibleCard";
import { Lineup } from "./compositions/Lineup";
import { FPS, Promo, PROMO_DURATION, SCENES } from "./compositions/Promo";
import { RevealClip, revealClipSchema } from "./compositions/RevealClip";
import { Turntable, turntableSchema } from "./compositions/Turntable";
import { getEdition } from "./characters/figures";
import { AssetGate } from "./components/AssetGate";
import { Awakens } from "./scenes/Awakens";
import { Collection } from "./scenes/Collection";
import { EditionReveal } from "./scenes/EditionReveal";
import { Finale } from "./scenes/Finale";
import { SecretReveal } from "./scenes/SecretReveal";

const gate = <P extends object>(C: React.FC<P>): React.FC<P> => {
  const Gated: React.FC<P> = (props) => (
    <AssetGate>
      <C {...props} />
    </AssetGate>
  );
  return Gated;
};

const AwakensScene = gate(() => <Awakens durationInFrames={SCENES[0].frames} />);
const DreamerScene = gate(() => <EditionReveal edition={getEdition("dreamer")} durationInFrames={SCENES[1].frames} />);
const ShyScene = gate(() => <EditionReveal edition={getEdition("shy")} durationInFrames={SCENES[2].frames} />);
const RebelScene = gate(() => <EditionReveal edition={getEdition("rebel")} durationInFrames={SCENES[3].frames} />);
const WandererScene = gate(() => <EditionReveal edition={getEdition("wanderer")} durationInFrames={SCENES[4].frames} />);
const CollectionScene = gate(() => <Collection durationInFrames={SCENES[5].frames} />);
const SecretScene = gate(() => <SecretReveal durationInFrames={SCENES[6].frames} />);
const FinaleScene = gate(() => <Finale durationInFrames={SCENES[7].frames} />);

const SCENE_COMPONENTS = [AwakensScene, DreamerScene, ShyScene, RebelScene, WandererScene, CollectionScene, SecretScene, FinaleScene];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="LittleTaiPromo" component={Promo} width={1080} height={1920} fps={FPS} durationInFrames={PROMO_DURATION} defaultProps={{ withMusic: true }} />
      <Composition id="LittleTaiPromoLandscape" component={Promo} width={1920} height={1080} fps={FPS} durationInFrames={PROMO_DURATION} defaultProps={{ withMusic: true }} />

      <Folder name="Scenes">
        {SCENES.map((s, i) => (
          <Composition key={s.name} id={`Scene-${s.name.replace(/[^A-Za-z0-9]+/g, "-")}`} component={SCENE_COMPONENTS[i]} width={1080} height={1920} fps={FPS} durationInFrames={s.frames} />
        ))}
      </Folder>

      <Folder name="Reveal-Clips">
        {(["dreamer", "shy", "rebel", "wanderer", "midnight"] as const).map((id) => (
          <Composition key={id} id={`Reveal-${id}`} component={RevealClip} schema={revealClipSchema} defaultProps={{ edition: id }} width={1080} height={1920} fps={FPS} durationInFrames={7 * FPS} />
        ))}
      </Folder>

      <Folder name="Stills">
        {(["dreamer", "shy", "rebel", "wanderer", "midnight"] as const).map((id) => (
          <Still key={id} id={`Card-${id}`} component={CollectibleCard} schema={cardSchema} defaultProps={{ edition: id }} width={1200} height={1680} />
        ))}
        {(["dreamer", "shy", "rebel", "wanderer", "midnight"] as const).map((id) => (
          <Still key={id} id={`Box-${id}`} component={BoxShot} schema={boxShotSchema} defaultProps={{ edition: id }} width={1200} height={1500} />
        ))}
        <Still id="Lineup" component={Lineup} width={2560} height={1440} />
      </Folder>

      <Folder name="Viewer">
        <Composition
          id="Turntable"
          component={Turntable}
          schema={turntableSchema}
          defaultProps={{ edition: "dreamer", subject: "both", procedural: false, boxOpen: -1 } as const}
          width={1080}
          height={1350}
          fps={FPS}
          durationInFrames={240}
        />
      </Folder>
    </>
  );
};
