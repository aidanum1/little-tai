import React, { useEffect, useState } from "react";
import { useDelayRender } from "remotion";
import { getConceptUrl } from "../characters/assets";
import { EDITIONS } from "../characters/figures";
import { fontsReady } from "../theme";

/** Concept images (if generated) decoded once and shared by box/card painters. */
export const conceptImages = new Map<string, HTMLImageElement>();

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });

let ready: Promise<void> | null = null;
const prepare = () => {
  ready ??= (async () => {
    await fontsReady();
    await Promise.all(
      EDITIONS.map(async (e) => {
        const url = getConceptUrl(e.id);
        if (url && !conceptImages.has(e.id)) conceptImages.set(e.id, await loadImage(url));
      }),
    );
  })();
  return ready;
};

/**
 * Blocks rendering until fonts and concept images are ready, so canvas-painted textures
 * (packaging art, faces, cards) are always drawn with the final typefaces — never a fallback.
 */
export const AssetGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading fonts and concept art"));
  const [ok, setOk] = useState(false);
  useEffect(() => {
    prepare()
      .then(() => {
        setOk(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [handle, continueRender, cancelRender]);
  return ok ? <>{children}</> : null;
};
