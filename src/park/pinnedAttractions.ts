/**
 * pinnedAttractions.ts — the join between an attraction and where its pin hovers.
 *
 * Contract: `PINNED_ATTRACTIONS` is every attraction paired with the world
 * position the Blender export measured for it. Throws at module evaluation if
 * `pins.json` and `ATTRACTIONS` disagree.
 *
 * This lives in `src/park/` rather than beside `ATTRACTIONS`, and that
 * placement is the point. The join throws, and it used to throw from the module
 * that `ParkDirectory`, every content route and `sitemap.ts` all import — so a
 * renamed Empty in `assets/park_build.py` did not cost you the park, it cost
 * you the home page, the directory, the no-JavaScript path and every content
 * route at once. That is the exact inverse of the design: the park is the
 * optional layer and the directory underneath is the whole site.
 *
 * Here, the same mistake degrades to "no park, full site", which is the failure
 * mode the substrate was built for. `tests/attractions.test.ts` remains the
 * real gate — it asserts key-set equality and runs before `build` in both
 * `npm run check` and CI, so the throw is a backstop rather than the detector.
 *
 * Positions are never declared in TypeScript. They flow one direction, Blender
 * to JSON to here; see docs/ASSETS.md.
 */

import pins from "../../assets/pipeline/pins.json";
import { ATTRACTIONS, type Attraction } from "@/content/attractions";

/** A pin's world position, in the runtime's Y-up metres. */
export type PinPosition = readonly [number, number, number];

/** An attraction together with the world position its pin hovers at. */
export interface PinnedAttraction extends Attraction {
  readonly position: PinPosition;
}

/**
 * Every attraction with its pin position.
 *
 * Throws on a missing position rather than defaulting to the origin: an
 * attraction whose Empty was renamed would otherwise put its pin dead centre
 * of the park, stacked under the ferris wheel, which presents as a styling bug
 * and is actually a broken export.
 */
export const PINNED_ATTRACTIONS: readonly PinnedAttraction[] = ATTRACTIONS.map(
  (attraction) => {
    const position = (pins as Record<string, number[]>)[attraction.id];
    if (!position || position.length !== 3) {
      throw new Error(
        `no pin position for ${attraction.id} in assets/pipeline/pins.json; ` +
          "re-run `npm run assets:export` after changing assets/park_build.py",
      );
    }
    return {
      ...attraction,
      position: [position[0], position[1], position[2]] as PinPosition,
    };
  },
);
