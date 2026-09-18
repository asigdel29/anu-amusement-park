/**
 * Screenshot-regression configuration.
 *
 * Contract: `npm run test:regression` compares the park at fixed camera poses,
 * and every content route, against committed baselines.
 *
 * Why this is separate from the main end-to-end config, and not in CI:
 *
 * A WebGL render is not portable. The same scene, the same browser and the
 * same code produce different pixels on a Mac's GPU and on a CI runner's
 * software rasteriser — different anti-aliasing, different filtering, often a
 * different renderer entirely. Baselines are therefore per-platform (Playwright
 * suffixes them, `-darwin`/`-linux`) and are generated where they are checked.
 *
 * Running this in the same job as the correctness suite would mean either
 * committing CI-generated baselines for a machine nobody looks at, or a red
 * build every time a font renders a pixel differently. Neither teaches anyone
 * anything. It runs deliberately, on one platform, and its diffs are read by a
 * person.
 *
 * What it is genuinely for: a re-bake is a visual change even when no geometry
 * moved, because all of the park's lighting is pixels in a texture. No other
 * gate in this repository can see that. This one exists so a bake that shifts
 * the park's mood cannot land unnoticed.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = 3101;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./regression",
  // Serial, because several WebGL contexts competing for one GPU change the
  // timing of what gets drawn before a screenshot is taken.
  workers: 1,
  fullyParallel: false,
  reporter: "list",

  use: {
    // The device spread comes FIRST. It carries its own viewport, so spreading
    // it after the explicit one silently overwrote it — the config captured at
    // Chrome's default size while claiming to capture at 1280x900. Caught by
    // the typechecker, which is the only reason it was caught at all: the
    // baselines were valid images either way.
    ...devices["Desktop Chrome"],
    baseURL,
    // Fixed, so a baseline means something. A different viewport is a
    // different image.
    viewport: { width: 1280, height: 900 },
  },

  /*
   * These are the defaults, and they are tuned for the *pages* — pure DOM
   * captures, which are deterministic to within antialiasing.
   *
   * The park needs a looser ratio and overrides it per assertion, because a
   * WebGL render has a real noise floor that DOM output does not. See the
   * measurements in regression/looks.spec.ts.
   */
  expect: {
    toHaveScreenshot: {
      // Per-pixel colour difference before a pixel counts as changed at all.
      threshold: 0.02,
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },

  webServer: {
    command: `npx next start --port ${PORT}`,
    url: baseURL,
    // Never reused: a stale server silently compares baselines against a build
    // that is no longer on disk, which has already happened once in this
    // repository.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
