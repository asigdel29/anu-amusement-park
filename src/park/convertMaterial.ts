/**
 * convertMaterial.ts — the runtime half of the baked-unlit contract.
 *
 * Contract: given a material loaded from the park's glb, returns the unlit
 * material the park should actually render with. This is the counterpart to
 * `assets/pipeline/bake_export.py`, which produces exactly one shape:
 *
 *     one material, the Cycles bake wired into the Emission socket, base colour
 *     black — landing in glTF as an `emissiveTexture` plus a `baseColorFactor`
 *     of [0, 0, 0, 1].
 *
 * That shape becomes a `MeshBasicMaterial` whose `map` is the bake. All of the
 * lighting is already in those pixels, so the shipped scene needs no lights and
 * does no shadow pass — which is what buys the frame budget on a phone.
 *
 * Requires of callers: call this on every material in the loaded scene before
 * first render, and dispose the originals (`applyUnlitMaterials` does both).
 * A material left unconverted renders black, because its base colour *is*
 * black — the failure is silent and total, which is why the loader applies this
 * rather than leaving it to each caller.
 *
 * Invariants:
 *   - The returned material is never lit. No code path produces a
 *     `MeshStandardMaterial`.
 *   - Texture colour space and flip are preserved from the source, because
 *     getting either wrong produces a subtly-wrong park rather than an error.
 *   - A material that matches no known shape is converted to a flat colour
 *     rather than passed through. Passing it through would reintroduce a lit
 *     material into a scene with no lights, which renders black.
 */

import {
  type Material,
  MeshBasicMaterial,
  type Mesh,
  type Object3D,
  MeshStandardMaterial,
} from "three";

/**
 * Converts one material to its unlit equivalent.
 *
 * Three shapes are recognised, in the order the export can produce them:
 *
 *  1. **Baked** — carries an `emissiveMap`. The bake becomes `map`. This is the
 *     contract case and covers the whole merged park.
 *  2. **Textured flat colour** — carries a `map` with alpha, used for cutouts
 *     such as foliage and signage. Kept as a cutout.
 *  3. **Bare colour** — no texture at all, which is how cheap props ship. Its
 *     base colour becomes a flat unlit colour.
 *
 * Anything else falls to case 3 using whatever colour it has, because a
 * best-effort flat colour is visible and debuggable while a lit material in an
 * unlit scene is simply black.
 */
export function toUnlit(material: Material): MeshBasicMaterial {
  const source = material as MeshStandardMaterial;

  const converted = new MeshBasicMaterial({
    name: source.name,
    toneMapped: false,
    side: source.side,
    transparent: source.transparent,
    opacity: source.opacity,
    // Backface culling is set on the exported material precisely so this is
    // not double-sided; carrying `side` across preserves that decision rather
    // than re-deciding it here.
  });

  if (source.emissiveMap) {
    // Case 1: the bake. `emissiveIntensity` is deliberately ignored — the
    // exporter writes 1.0, and honouring a stray value would scale the whole
    // park's exposure from a field nothing else reads.
    converted.map = source.emissiveMap;
    converted.color.setRGB(1, 1, 1);
  } else if (source.map) {
    // Case 2: a cutout. Alpha testing rather than blending, because blended
    // foliage needs depth sorting and sorting costs more than the hard edge
    // does.
    converted.map = source.map;
    converted.alphaTest = 0.5;
    converted.color.copy(source.color);
  } else {
    // Case 3: bare colour.
    converted.color.copy(source.color);
  }

  return converted;
}

/**
 * Converts every material in a loaded scene graph in place, disposing the
 * originals.
 *
 * Disposal matters here: the loaded `MeshStandardMaterial`s each hold compiled
 * shader programs, and the park is loaded once per session but this runs on
 * every mesh. Leaving them undisposed leaks the programs for a scene that is
 * never rendered.
 *
 * Returns the number of materials converted, so a caller can assert the scene
 * was not empty — a silently-empty conversion means the glb loaded but
 * contained nothing, which otherwise presents as a black canvas.
 */
export function applyUnlitMaterials(root: Object3D): number {
  let converted = 0;

  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;

    // Frustum culling is on by default, but the park is one large merged mesh
    // that is always at least partly in view, so testing it every frame is
    // wasted work that can never cull anything.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const unlit = materials.map((material) => {
      const next = toUnlit(material);
      material.dispose();
      converted += 1;
      return next;
    });

    mesh.material = Array.isArray(mesh.material) ? unlit : unlit[0];
  });

  return converted;
}
