"""Bakes the park's lighting into a texture and exports it for the web.

Run headless, against the scene the build script produced:

    blender --background assets/park.blend \
        --python assets/pipeline/bake_export.py -- <out_dir>

Produces, in ``<out_dir>``:

    Park.glb       the whole park as one merged, baked mesh
    Park.png       the baked atlas Park.glb references

and, in the repository, ``assets/pipeline/pins.json``.

Contract
--------
The exported material honours the **baked-unlit contract**, which is the one
convention the runtime depends on:

    One material, with the bake wired into the **Emission** socket and the base
    colour set to **black**. In glTF that lands as an ``emissiveTexture`` plus a
    ``baseColorFactor`` of ``[0, 0, 0, 1]``.

``src/park/convertMaterial.ts`` holds up the other end, turning anything shaped
like that into an unlit ``MeshBasicMaterial``. The consequence is that the
shipped scene contains no lights and does no shadow pass: all of the lighting is
pixels, which is what buys the frame budget on a phone.

Two things follow from that, and both are easy to forget:

1. Nothing in the shipped scene can respond to light. A prop that needs to glow
   must have been baked glowing.
2. A re-bake is a visual change even when no geometry moved, which is why
   ``npm run test:regression`` screenshots the park at fixed camera poses. No
   other gate can see a bake that shifts the mood.

Why it must run headless
------------------------
A real Cycles bake takes minutes and blocks Blender's main thread, which times
out the authoring socket the scene is composed over. Do not try to bake
interactively; compose there and bake here. The same lesson is recorded in the
previous world's pipeline.

Pin positions
-------------
Every Empty in the scene whose name matches an attraction id is read and its
world position written to ``pins.json``. Numbers flow one direction — Blender,
JSON, application — so this file is the only writer of pin positions, and
``tests/attractions.test.ts`` asserts the result agrees with ``ATTRACTIONS``.

Blender is Z-up and the web runtime is Y-up. Positions are written in the
**runtime's** coordinate system, converted here, so the application never has to
know that Blender was involved.
"""

from __future__ import annotations

import json
import os
import sys

import bpy

# --------------------------------------------------------------------------- config

#: Resolution of the baked atlas. 2048 holds the whole park: it is 1,734
#: polygons over a 60m island, so texel density is generous even at this size.
#: Raising it is the first thing to try if the bake looks soft, and the first
#: thing to lower if the texture budget is exceeded.
ATLAS_SIZE = 2048

#: Cycles samples per texel. The scene is flat-shaded with soft fill, so it
#: converges fast; this is not a photoreal render.
BAKE_SAMPLES = 64

#: Objects excluded from the merged bake, by exact name.
#:
#: The water plane is eight times the island's width, so merging it into the
#: atlas would spend most of the texture on flat colour and leave the park
#: itself soft. It ships as its own object with a flat unlit colour instead.
EXCLUDE_FROM_BAKE = {"Water"}

#: Attraction ids, mirroring src/content/attractions.ts. Used to tell an
#: attraction anchor from any other Empty in the scene. A mismatch here is
#: caught by tests/attractions.test.ts rather than passing silently.
ATTRACTION_IDS = [
    "agent_arcade",
    "the_factory",
    "idea_graveyard",
    "the_library",
    "hardware_workshop",
    "launch_tower",
    "fortune_booth",
]


def log(*args: object) -> None:
    print("[bake_export]", *args, flush=True)


# ---------------------------------------------------------------------------- pins


def write_pins(repo_root: str) -> dict[str, list[float]]:
    """Writes every attraction anchor's position to ``pins.json``.

    Raises rather than writing a partial file if an expected anchor is missing:
    a pin with no position would render at the origin, which looks like a
    styling bug and is actually a missing Empty.
    """
    pins: dict[str, list[float]] = {}
    for attraction_id in ATTRACTION_IDS:
        empty = bpy.data.objects.get(attraction_id)
        if empty is None or empty.type != "EMPTY":
            raise RuntimeError(
                f"no Empty named {attraction_id!r} in the scene; "
                "assets/park_build.py must place one per attraction"
            )
        x, y, z = empty.matrix_world.translation
        # Blender Z-up to runtime Y-up. The glTF exporter applies the same
        # conversion to geometry, so doing it here keeps the pins registered
        # with the mesh they hover over.
        pins[attraction_id] = [round(x, 4), round(z, 4), round(-y, 4)]

    path = os.path.join(repo_root, "assets", "pipeline", "pins.json")
    with open(path, "w", encoding="utf8") as fh:
        json.dump(pins, fh, indent=2, sort_keys=True)
        fh.write("\n")
    log(f"wrote {len(pins)} pin positions to {path}")
    return pins


# ---------------------------------------------------------------------------- bake


def merge_for_bake():
    """Joins every bakeable mesh into a single object.

    One object means one atlas, one material and one draw call for the whole
    park. The alternative — baking per structure — would multiply both the
    texture count and the request count for no visual gain at this scale.

    The join is destructive, which is why this script never saves the .blend it
    opened. The scene is rebuilt from assets/park_build.py, not recovered.
    """
    bpy.ops.object.select_all(action="DESELECT")

    meshes = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.name not in EXCLUDE_FROM_BAKE
    ]
    if not meshes:
        raise RuntimeError("no meshes to bake; is the scene empty?")

    # Modifiers must be applied before joining: a chamfer left unapplied is
    # silently dropped by the join, and the park would lose every bevel.
    for obj in meshes:
        if not obj.modifiers:
            continue
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)

    for obj in meshes:
        obj.select_set(True)
    target = meshes[0]
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()

    merged = bpy.context.active_object
    merged.name = "Park"
    log(f"merged {len(meshes)} meshes into {merged.name}: "
        f"{len(merged.data.polygons)} polygons")
    return merged


def unwrap(obj) -> None:
    """Gives the merged park a single non-overlapping UV layout.

    Smart UV Project rather than a hand-authored layout: the park is built
    procedurally, so there is no hand to author one, and a projection is exactly
    right for flat-shaded geometry with no repeating detail.
    """
    # uv_layers has no clear(); remove one at a time. Leaving a stale layer
    # behind would let the bake write into whichever one happened to be active.
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name="bake")

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    log("unwrapped")


def bake_to_image(obj):
    """Bakes the scene's lighting for ``obj`` into a new image.

    ``COMBINED`` rather than ``DIFFUSE``: combined includes emission, and the
    park's neon *is* emission. A diffuse bake would produce an island lit by a
    moon with every ride switched off.
    """
    image = bpy.data.images.new("Park_bake", ATLAS_SIZE, ATLAS_SIZE, alpha=False)

    # Every material on the merged object needs an image target node for the
    # bake to write into, and it must be the active node in that material.
    for material in obj.data.materials:
        if material is None:
            continue
        nodes = material.node_tree.nodes
        target = nodes.new("ShaderNodeTexImage")
        target.name = "bake_target"
        target.image = image
        target.select = True
        nodes.active = target

    scene = bpy.context.scene
    # Cycles is an add-on, so RNA under-reports it in the engine enum; assigning
    # it is the reliable check. Without Cycles there is no bake at all, so this
    # fails loudly rather than silently exporting an unlit scene.
    try:
        scene.render.engine = "CYCLES"
    except TypeError as exc:
        raise RuntimeError(
            "Cycles is required to bake the park and is not available in this "
            f"Blender: {exc}"
        ) from exc

    scene.cycles.samples = BAKE_SAMPLES
    scene.render.bake.target = "IMAGE_TEXTURES"
    scene.render.bake.use_clear = True
    scene.render.bake.margin = 6

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    log(f"baking {ATLAS_SIZE}x{ATLAS_SIZE} at {BAKE_SAMPLES} samples (slow)")
    bpy.ops.object.bake(type="COMBINED")
    log("bake complete")
    return image


def apply_unlit_contract(obj, image, out_dir: str) -> None:
    """Replaces the merged object's materials with the single baked material.

    This is where the contract in this module's docstring is actually
    established: one material, bake in the Emission socket, base colour black.
    """
    path = os.path.join(out_dir, "Park.png")
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    log(f"saved atlas to {path}")

    material = bpy.data.materials.new("MergedBake")
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()

    output = tree.nodes.new("ShaderNodeOutputMaterial")
    bsdf = tree.nodes.new("ShaderNodeBsdfPrincipled")
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = image

    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 1.0

    # Without this the glTF exporter marks the material doubleSided, and the
    # runtime then shades both faces of every polygon in an opaque, closed
    # island — doubling fragment work for geometry no camera angle can see the
    # back of. The orbit rig never goes below the water line.
    material.use_backface_culling = True

    # Socket naming differs between Blender generations; probe rather than
    # assume, so an upgrade does not silently export a black park.
    emission_socket = next(
        (name for name in ("Emission Color", "Emission") if name in bsdf.inputs),
        None,
    )
    if emission_socket is None:
        raise RuntimeError(
            "the Principled BSDF has no emission input; the baked-unlit "
            "contract cannot be expressed"
        )

    tree.links.new(texture.outputs["Color"], bsdf.inputs[emission_socket])
    tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0
    log("applied the baked-unlit contract")


# -------------------------------------------------------------------------- export


def export_glb(out_dir: str) -> str:
    """Exports every remaining mesh as one glb.

    ``export_apply`` is on because the merge already applied the modifiers, and
    leaving it off would drop anything added afterwards. Cameras, lights and
    Empties are excluded: the runtime supplies its own camera, the scene has no
    use for lights once baked, and the Empties have already been reduced to
    ``pins.json``.
    """
    path = os.path.join(out_dir, "Park.glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    size = os.path.getsize(path)
    log(f"exported {path} ({size / 1024:.1f} KiB)")
    return path


# ---------------------------------------------------------------------------- main


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = argv[0] if argv else "/tmp/park-export"
    os.makedirs(out_dir, exist_ok=True)

    # This file sits at <repo>/assets/pipeline/, so the repository root is two
    # levels up. Derived rather than passed so the two outputs cannot be written
    # to inconsistent places.
    repo_root = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
    )

    write_pins(repo_root)

    merged = merge_for_bake()
    unwrap(merged)
    image = bake_to_image(merged)
    apply_unlit_contract(merged, image, out_dir)
    export_glb(out_dir)

    log("done")


if __name__ == "__main__":
    main()
