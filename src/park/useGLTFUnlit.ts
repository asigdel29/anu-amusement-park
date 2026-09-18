"use client";

/**
 * useGLTFUnlit.ts — loads the baked park and makes it unlit.
 *
 * Contract: returns the loaded scene graph with every material already
 * converted by `convertMaterial`. The caller gets something it can add to the
 * scene directly; there is no window in which a lit material is present.
 *
 * Requires of callers: a Suspense boundary. This suspends on first call, like
 * every drei loader hook.
 *
 * The Draco decoder is loaded from `/draco/`, vendored under `public/`, rather
 * than from the gstatic CDN three.js defaults to. That is not a preference: the
 * CSP in `next.config.ts` keeps `connect-src 'self'` with no exception, and a
 * CDN decoder would need one. See docs/ASSETS.md.
 *
 * Conversion happens in a `useMemo` keyed on the loaded scene, not in an
 * effect. An effect would run after the first paint, so the park would render
 * black for one frame — every material's base colour is black by design, and
 * the bake only becomes visible once it has been moved to `map`.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { applyUnlitMaterials } from "./convertMaterial";
import { PARK_MODEL_URL } from "./modelUrl";

/** Where the vendored Draco decoder lives. Must end in a slash. */
const DRACO_DECODER_PATH = "/draco/";

export function useParkScene() {
  // `useMeshopt: false`. drei defaults it on, which instantiates a ~20 KB
  // WebAssembly module at first render — synchronously, on the critical path
  // to a measured first-interactive. The park's glb declares only
  // KHR_draco_mesh_compression and EXT_texture_webp, so that compile decoded
  // nothing at all.
  const gltf = useGLTF(PARK_MODEL_URL, DRACO_DECODER_PATH, false);

  return useMemo(() => {
    // The loaded graph is cached and shared by drei, so it is cloned before
    // being mutated. Converting the cached original in place would corrupt it
    // for any later consumer, and would double-dispose its materials if this
    // ever ran twice.
    const scene = gltf.scene.clone(true);
    const converted = applyUnlitMaterials(scene);
    if (converted === 0) {
      // A scene that loaded but contains nothing presents as a black canvas,
      // which is indistinguishable from a dozen other faults. Say what it is.
      throw new Error(
        `${PARK_MODEL_URL} loaded but contained no materials; ` +
          "re-run `npm run assets:export`",
      );
    }
    return scene;
  }, [gltf.scene]);
}
