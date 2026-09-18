# Asset pipeline

The park's source of truth is `assets/park_build.py` — a Python script that
builds the whole scene procedurally inside Blender. `assets/park.blend` is that
script's committed output, and `public/models/park/*.glb` are derived from the
`.blend` by the export pipeline.

**Never hand-edit the `.blend`, and never hand-edit a shipped `.glb`.** The
previous generation of this world drifted exactly that way: the Blender file and
the shipped models stopped agreeing, and there was no way to tell which was
right. A procedural build script cannot drift from itself.

## Why procedural

A `.blend` is an opaque binary. A diff over one tells you nothing, a merge
conflict in one is unresolvable, and a review of one is a screenshot. The build
script is text: it reviews, diffs, and merges. It also means the park can be
rebuilt from scratch on any machine with Blender installed, which is what makes
the scene reproducible in the sense the project requires.

Blender is driven through its MCP connection during authoring — small changes
executed live, with a viewport screenshot after each one — and every change that
survives is written back into `park_build.py`. The live session is the
sketchpad; the script is the artefact.

## Running it

```sh
# Build the scene from scratch into assets/park.blend
blender --background --python assets/park_build.py -- assets/park.blend

# Bake lighting, export geometry and pin positions
blender --background assets/park.blend --python assets/pipeline/bake_export.py -- /tmp/park-export

# Draco-compress geometry and convert textures, into public/models/park/
sh assets/pipeline/compress.sh /tmp/park-export
```

`npm run assets:export` wraps the last two steps.

Export runs **headless**, outside the interactive Blender session. The authoring
socket times out on a real Cycles bake, which is a lesson already learned in
`anu-agent-world/assets/pipeline/export.py`; do not try to bake over MCP.

## The baked-unlit contract

This is the load-bearing convention, adopted from the navigation reference and
from `anu-minecraft-world/assets/pipeline/bake_export.py`:

> Every baked mesh exports **one** material, with the Cycles bake wired into the
> **Emission** socket and the base colour set to **black**. In glTF that lands
> as an `emissiveTexture` plus a `baseColorFactor` of `[0, 0, 0, 1]`.

The runtime holds up the other end: `src/park/convertMaterial.ts` turns any
material shaped like that into an unlit `MeshBasicMaterial` with the emissive
texture as its map. A base-colour texture carrying alpha becomes a cutout for
foliage and signage; a bare base colour with no texture becomes a flat unlit
colour, which is how the cheap prop clusters ship.

The consequence is that **the shipped scene contains no lights and does no
shadow pass**. All of the lighting is pixels. This is what buys the frame budget
on a phone, and it is why the park can be dense.

Two things follow, and both are easy to forget:

1. Nothing in the scene can respond to light at runtime. A prop that needs to
   glow needs to have been baked glowing, or be a flat emissive colour.
2. A re-bake is a visual change even when no geometry moved. That is why
   `npm run test:regression` screenshots the park at fixed camera poses — a bake
   that shifts the mood is otherwise invisible to every other gate.

## Pin positions flow one direction

`park_build.py` places one named Empty per attraction, named after that
attraction's `id` in `src/content/attractions.ts`. `bake_export.py` writes their
world positions to `assets/pipeline/pins.json`:

```json
{ "agent_arcade": [12.5, 0.0, -8.25] }
```

**Numbers flow one direction: Blender → JSON → the application.** A pin position
is never typed into TypeScript. If it were, the pin would sit where nobody put
any geometry.

`tests/attractions.test.ts` asserts that the key set of `pins.json` equals the
id set of `ATTRACTIONS`, so a ride added in Blender without a route — or a route
without a ride — fails the build.

Attraction ids are constrained to `^[a-z][a-z0-9_]*$` for this reason: the glTF
exporter mangles names outside that set, which would break the join silently.

## Compression

`compress.sh` runs `@gltf-transform/cli optimize` with `--compress draco` and
`--texture-compress webp`. Measured on the current park:

| Stage | Size |
| --- | --- |
| `Park.glb` straight out of Blender | 3.32 MB |
| After Draco geometry + WebP textures | **350 KB** |
| — of which the 2048² baked atlas | 273 KB |

`--simplify` is off. The park is 9,485 polygons of deliberately flat-shaded
geometry, and a decimator would round off exactly the chamfers that keep it from
looking like programmer art.

### Why Draco and not meshopt

`EXT_meshopt_compression` is the usual alternative, and it is tempting for a
second reason: its decoder is ~20 KB against Draco's 245 KB of vendored wasm.
Measured on the same export, with identical WebP textures, so only the geometry
codec differs:

| Geometry codec | `Park.glb` |
| --- | --- |
| Draco | **358,916 B** |
| meshopt | 580,820 B |
| quantization only | 1,160,328 B |

Meshopt costs **222 KB more over the wire** than it saves in decoder bytes, on
this park. That is the park's shape talking, not a general result: meshopt wins
on dense, smoothly-varying meshes, and this one is 9,485 flat-shaded polygons
with hard chamfers, which is close to Draco's best case. Re-measure before
believing either number on a different scene; do not re-litigate it on this one.

### When to switch to KTX2

WebP rather than KTX2/Basis, deliberately: KTX2 needs the external `ktx` binary
as a build dependency, and the reference site's own use of Basis is not on its
own a reason to take that on.

The number that decides it is **GPU memory, not transfer size**. WebP decodes to
uncompressed RGBA in VRAM, so the 273 KB atlas costs **22.37 MB of VRAM**
(`npx @gltf-transform/cli inspect public/models/park/Park.glb` reports it as
`gpuSize`). KTX2/Basis would stay compressed on the GPU and cut that to roughly
a quarter.

22 MB for one texture is real but survivable on the phones this park targets.
Switch when the perf harness shows memory pressure on a mid-tier device, or if
the atlas is ever raised above 2048².

Making that switch is three changes: add `--texture-compress ktx2` to
`compress.sh` (which needs the `ktx` binary on PATH), vendor
`basis_transcoder.{js,wasm}` from `three/examples/jsm/libs/basis/` into
`public/basis/`, and wire a `KTX2Loader` in `src/park/useGLTFUnlit.ts`. The
transcoder is 585 KB and is deliberately **not** vendored today, because a
decoder for a format nothing ships is 585 KB of dead weight in `public/`.

### Backface culling

The baked material sets `use_backface_culling`, because without it the glTF
exporter marks the material `doubleSided` and the runtime shades both faces of
every polygon in a closed, opaque island — doubling fragment work for geometry
no camera angle can see the back of. The orbit rig never goes below the water
line.

The Draco decoder is **vendored** under `public/draco/` rather than loaded from
the gstatic CDN that three.js defaults to. That is what lets `next.config.ts`
keep `connect-src 'self'` with no exception — see the CSP invariants there. A
KTX2 transcoder would be vendored the same way, for the same reason.

## Budgets

One budget of 1.5 MB for the whole park payload, enforced by `npm run size`.
Currently 350 KB, so there is room for roughly four times the present park.

It is one budget rather than separate geometry and texture budgets because the
atlas is embedded *inside* the glb. Splitting them would leave the texture
budget permanently unmeasurable — reporting "pending" forever while its bytes
were counted under geometry anyway.

The reference site's equivalent numbers, for calibration: 1.12 MB for its entire
island set, 9 KB for its pin geometry.
