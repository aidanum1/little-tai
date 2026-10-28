/**
 * Remotion CLI config. Applies to `remotion studio`, `remotion render` and `remotion still`.
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(1);

// WebGL in headless Chrome: ANGLE uses the GPU (Metal on macOS) for Three.js scenes.
Config.setChromiumOpenGlRenderer("angle");

// High-quality H.264 master.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(15);
Config.setPixelFormat("yuv420p");

// WebGL scenes are GPU-bound; a handful of tabs is the sweet spot on Apple Silicon.
Config.setConcurrency(4);
Config.setDelayRenderTimeoutInMilliseconds(120000);
