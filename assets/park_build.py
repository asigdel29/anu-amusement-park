"""Builds the amusement park scene from nothing, inside Blender.

Run headless to regenerate the committed .blend:

    blender --background --python assets/park_build.py -- assets/park.blend

Run with no trailing path to build into the current session, which is how the
scene is authored interactively.

Contract
--------
This script is the park's source of truth. It produces:

  * one island plate floating on a water plane;
  * one structure per attraction, placed on the plate;
  * one Empty per attraction, named after that attraction's ``id`` in
    ``src/content/attractions.ts``, positioned at the point the pin should
    hover over;
  * a camera posed at the angle the navigation reference frames its map from.

``assets/park.blend`` is this script's output and is never hand-edited. Neither
is a shipped ``.glb``. See docs/ASSETS.md for why: a .blend is an opaque binary
that does not diff, does not merge, and cannot be reviewed except as a
screenshot.

Invariants
----------
1. Every name in ``ATTRACTIONS`` below matches an ``id`` in
   ``src/content/attractions.ts``, and its ``accent`` matches that attraction's
   accent token. ``tests/attractions.test.ts`` asserts the first half of that
   once the export has run; the second half is why the hex values are written
   out here rather than left implicit.
2. Attraction ids are ``^[a-z][a-z0-9_]*$``. The glTF exporter mangles anything
   else, which would break the join between ``pins.json`` and the application
   silently.
3. Geometry is authored flat and true. The runtime bends the horizon with a
   vertex shader; curving it here would put every pin in the wrong place, since
   pin positions are measured off this geometry.
4. Nothing here relies on a light. The scene is baked to unlit textures by
   ``assets/pipeline/bake_export.py``, so the lights this script adds exist only
   to be baked. The shipped scene has none.
5. Node lookups are by ``node.type``, never by name. Node names are localised,
   so ``nodes["Principled BSDF"]`` is ``None`` on a non-English Blender.

Coordinates
-----------
Blender is Z-up; the web runtime is Y-up. The glTF exporter converts on export,
so everything here is authored in ordinary Blender orientation: +Z is up, the
plate lies in the XY plane.
"""

from __future__ import annotations

import math
import sys

import bmesh
import bpy

# --------------------------------------------------------------------------- data

#: Radius of the island plate, in metres. The whole park fits inside it.
#:
#: Sized so the island is roughly six structures wide, which is the proportion
#: the navigation reference's islands hold. A larger plate makes the structures
#: read as specks from the orbit camera, which was the first version's mistake.
PLATE_RADIUS = 30.0

#: Thickness of the plate. Visible as the island's cliff edge from a low orbit.
PLATE_DEPTH = 3.2

#: Height of the plate's top surface above the water.
PLATE_TOP_Z = 0.0

#: The accent palette, as sRGB hex. Mirrors src/design/tokens.css exactly; see
#: invariant 1. Written out rather than imported because Blender's Python cannot
#: read the TypeScript, and a silent divergence here would show up as an
#: attraction whose sign is the wrong colour.
ACCENTS = {
    "neon-pink": "ff3891",
    "neon-yellow": "ffbf04",
    "neon-cyan": "00c2ff",
    "neon-purple": "ad00ff",
    "neon-mint": "4ff29f",
    "neon-blue": "38b7ff",
}

#: One entry per attraction, in park order.
#:
#: ``position`` is the centre of the attraction's footprint on the plate, and
#: ``pin_height`` is how far above that the pin hovers — tall structures need a
#: taller pin or the label sits inside the geometry.
ATTRACTIONS = [
    {
        "id": "agent_arcade",
        "accent": "neon-cyan",
        "position": (-19.5, 5.0),
        "pin_height": 9.0,
        "kind": "pavilion",
    },
    {
        "id": "the_factory",
        "accent": "neon-yellow",
        "position": (15.0, 13.5),
        "pin_height": 12.0,
        "kind": "factory",
    },
    {
        "id": "idea_graveyard",
        "accent": "neon-purple",
        "position": (-17.0, -12.5),
        "pin_height": 6.0,
        "kind": "graveyard",
    },
    {
        "id": "the_library",
        "accent": "neon-mint",
        "position": (20.5, -4.5),
        "pin_height": 10.0,
        "kind": "rotunda",
    },
    {
        "id": "hardware_workshop",
        "accent": "neon-pink",
        "position": (-3.0, -19.5),
        "pin_height": 7.0,
        "kind": "workshop",
    },
    {
        "id": "launch_tower",
        "accent": "neon-blue",
        "position": (-6.5, 18.5),
        "pin_height": 19.0,
        "kind": "tower",
    },
    {
        "id": "fortune_booth",
        "accent": "neon-pink",
        "position": (12.5, -15.0),
        "pin_height": 6.0,
        "kind": "booth",
    },
]


# ----------------------------------------------------------------------- helpers


def log(*args: object) -> None:
    print("[park_build]", *args, flush=True)


def srgb_to_linear(hex_color: str) -> tuple[float, float, float, float]:
    """Converts an sRGB hex string to the linear RGBA Blender expects.

    Blender's colour sockets are linear. Assigning an sRGB value directly makes
    every accent read as washed out, which is subtle enough to survive a whole
    review.
    """
    h = hex_color.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"expected a six-digit hex colour, got {hex_color!r}")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def clear_scene() -> None:
    """Empties the file so a rebuild is not an accumulation of past rebuilds.

    Purges orphaned meshes, materials and images as well as objects: leaving
    them behind makes the .blend grow on every run and makes a name lookup
    ambiguous when Blender starts appending ``.001`` suffixes.
    """
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=True)
    for collection in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.curves,
        bpy.data.lights,
        bpy.data.cameras,
    ):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)
    log("scene cleared")


def unlit_material(name: str, hex_color: str, emission: float = 0.0):
    """A flat material, optionally emissive.

    Emissive materials are how the park's neon reads: the bake carries the glow
    into the texture, so the shipped scene needs no lights to look lit.

    The Principled BSDF is found by ``node.type``, never by name — see invariant
    5. Its input sockets are addressed by their English identifiers, which are
    stable across locales unlike the node's label.
    """
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError(f"material {name!r} has no Principled BSDF to configure")

    colour = srgb_to_linear(hex_color)
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = 0.65

    if emission > 0.0:
        # Socket names differ between Blender generations; probe rather than
        # assume, so this script keeps working across an upgrade.
        for socket_name in ("Emission Color", "Emission"):
            if socket_name in bsdf.inputs:
                bsdf.inputs[socket_name].default_value = colour
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission

    return material


def assign(obj, material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)


def add_box(name, size, location, material, rotation_z=0.0):
    """A chamfered box. The chamfer is what keeps the park from looking like
    programmer art: the reference has no hard 90-degree edges anywhere."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    # `size=1.0` is a unit cube spanning -0.5..0.5, so the scale factor IS the
    # requested side length. Halving it here built the entire park at half
    # scale, which read as a sizing judgement rather than as the bug it was.
    obj.scale = (size[0], size[1], size[2])
    obj.rotation_euler = (0.0, 0.0, rotation_z)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bevel = obj.modifiers.new("chamfer", "BEVEL")
    bevel.width = min(0.08, min(size) * 0.12)
    bevel.segments = 2
    bevel.limit_method = "ANGLE"

    assign(obj, material)
    return obj


def add_cylinder(name, radius, depth, location, material, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, location=location, vertices=vertices
    )
    obj = bpy.context.active_object
    obj.name = name
    assign(obj, material)
    return obj


# ------------------------------------------------------------------------ pieces


def build_plate(material_top, material_cliff):
    """The island the park sits on.

    Built as a low-vertex-count disc rather than a subdivided grid: the plate is
    the single largest mesh in the scene, and the reference ships its entire
    island set in 1.12 MB. An irregular outline comes from displacing the rim
    vertices, not from more of them.
    """
    mesh = bpy.data.meshes.new("Plate")
    obj = bpy.data.objects.new("Plate", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    segments = 28
    bmesh.ops.create_circle(
        bm, cap_ends=True, radius=PLATE_RADIUS, segments=segments
    )

    # Nudge the rim in and out so the island reads as a landmass rather than a
    # coin. Deterministic, not random: a rebuild must produce the same island.
    for index, vert in enumerate(v for v in bm.verts if v.co.length > 0.1):
        wobble = 1.0 + 0.11 * math.sin(index * 2.0) + 0.06 * math.cos(index * 5.0)
        vert.co.x *= wobble
        vert.co.y *= wobble

    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.0, 0.0, PLATE_TOP_Z))

    top_faces = list(bm.faces)
    bmesh.ops.solidify(bm, geom=top_faces, thickness=-PLATE_DEPTH)

    # Solidify extrudes along the face normals, so which side of the original
    # ring becomes the top depends on their winding rather than on the sign of
    # `thickness`. Rather than assume, measure and shift: the walkable surface
    # must end up exactly at PLATE_TOP_Z, because every structure, floor and
    # path segment in the park is positioned against it.
    highest = max(v.co.z for v in bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0.0, 0.0, PLATE_TOP_Z - highest))

    bm.to_mesh(mesh)
    bm.free()

    mesh.materials.append(material_top)
    mesh.materials.append(material_cliff)

    # The upward-facing polygon is the ground; everything else is cliff.
    for polygon in mesh.polygons:
        polygon.material_index = 0 if polygon.normal.z > 0.5 else 1

    bevel = obj.modifiers.new("chamfer", "BEVEL")
    bevel.width = 0.35
    bevel.segments = 2
    bevel.limit_method = "ANGLE"

    return obj


def build_water(material):
    """The sea. A plane wide enough that its edge is never in frame at any
    camera distance the orbit rig permits."""
    bpy.ops.mesh.primitive_plane_add(
        size=PLATE_RADIUS * 8.0, location=(0.0, 0.0, PLATE_TOP_Z - PLATE_DEPTH * 0.82)
    )
    obj = bpy.context.active_object
    obj.name = "Water"
    assign(obj, material)
    return obj


def build_pavilion(name, x, y, accent, neutral, roof):
    """Agent Arcade: an open pavilion of cabinets under a peaked roof."""
    parts = [add_box(f"{name}_floor", (7.0, 7.0, 0.4), (x, y, 0.2), neutral)]
    for index in range(4):
        angle = index * math.pi / 2.0 + math.pi / 4.0
        cx = x + math.cos(angle) * 2.1
        cy = y + math.sin(angle) * 2.1
        parts.append(
            add_box(
                f"{name}_cabinet_{index}",
                (1.1, 0.8, 2.0),
                (cx, cy, 1.4),
                neutral,
                rotation_z=angle + math.pi / 2.0,
            )
        )
        parts.append(
            add_box(
                f"{name}_screen_{index}",
                (0.85, 0.12, 0.7),
                (
                    cx + math.cos(angle + math.pi / 2.0) * 0.001,
                    cy + math.sin(angle + math.pi / 2.0) * 0.001,
                    1.95,
                ),
                accent,
                rotation_z=angle + math.pi / 2.0,
            )
        )
    for index in range(4):
        angle = index * math.pi / 2.0 + math.pi / 4.0
        parts.append(
            add_cylinder(
                f"{name}_post_{index}",
                0.16,
                3.6,
                (x + math.cos(angle) * 3.1, y + math.sin(angle) * 3.1, 1.8),
                neutral,
                vertices=8,
            )
        )
    bpy.ops.mesh.primitive_cone_add(
        radius1=4.4, radius2=0.0, depth=3.0, location=(x, y, 5.1), vertices=4
    )
    roof_obj = bpy.context.active_object
    roof_obj.name = f"{name}_roof"
    roof_obj.rotation_euler = (0.0, 0.0, math.pi / 4.0)
    assign(roof_obj, roof)
    parts.append(roof_obj)
    return parts


def build_factory(name, x, y, accent, neutral, roof):
    """The Factory: a shed with chimneys. Reads as industry at a glance, which
    is all a landmark on a map has to do."""
    parts = [add_box(f"{name}_shed", (9.0, 6.0, 4.4), (x, y, 2.2), neutral)]
    bpy.ops.mesh.primitive_cylinder_add(
        radius=3.05, depth=9.0, location=(x, y, 4.4), vertices=16
    )
    roof_obj = bpy.context.active_object
    roof_obj.name = f"{name}_roof"
    roof_obj.rotation_euler = (0.0, math.pi / 2.0, 0.0)
    assign(roof_obj, roof)
    parts.append(roof_obj)
    for index, offset in enumerate((-2.6, 0.0, 2.6)):
        height = 5.0 + index * 0.9
        parts.append(
            add_cylinder(
                f"{name}_chimney_{index}",
                0.5,
                height,
                (x + offset, y - 2.2, 4.4 + height / 2.0),
                neutral,
                vertices=10,
            )
        )
        parts.append(
            add_cylinder(
                f"{name}_chimney_glow_{index}",
                0.54,
                0.35,
                (x + offset, y - 2.2, 4.4 + height - 0.1),
                accent,
                vertices=10,
            )
        )
    return parts


def build_graveyard(name, x, y, accent, neutral, roof):
    """Idea Graveyard: a fenced plot of headstones, deliberately unfinished —
    one of the two attractions with no content yet."""
    parts = [add_box(f"{name}_plot", (9.0, 7.0, 0.25), (x, y, 0.12), neutral)]
    for index in range(7):
        gx = x - 3.2 + (index % 4) * 2.1
        gy = y - 1.8 + (index // 4) * 2.6
        lean = 0.12 * math.sin(index * 1.7)
        stone = add_box(f"{name}_stone_{index}", (0.9, 0.28, 1.5), (gx, gy, 0.85), neutral)
        stone.rotation_euler = (lean, 0.0, 0.2 * math.cos(index))
        parts.append(stone)
    for index in range(6):
        parts.append(
            add_cylinder(
                f"{name}_fence_{index}",
                0.08,
                1.3,
                (x - 4.2 + index * 1.7, y + 3.4, 0.65),
                accent,
                vertices=6,
            )
        )
    return parts


def build_rotunda(name, x, y, accent, neutral, roof):
    """The Library: a domed rotunda. The dome is the only sphere in the park,
    which makes it legible from any orbit angle."""
    parts = [add_cylinder(f"{name}_base", 4.6, 5.0, (x, y, 2.5), neutral, vertices=20)]
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=4.6, location=(x, y, 5.0), segments=20, ring_count=8
    )
    dome = bpy.context.active_object
    dome.name = f"{name}_dome"
    dome.scale = (1.0, 1.0, 0.55)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(dome, roof)
    parts.append(dome)
    for index in range(8):
        angle = index * math.pi / 4.0
        parts.append(
            add_box(
                f"{name}_window_{index}",
                (1.0, 0.14, 2.2),
                (x + math.cos(angle) * 4.6, y + math.sin(angle) * 4.6, 2.6),
                accent,
                rotation_z=angle + math.pi / 2.0,
            )
        )
    return parts


def build_workshop(name, x, y, accent, neutral, roof):
    """Hardware Workshop: an open bench under a canopy, with an arm over it.
    The second of the two unfinished attractions."""
    parts = [
        add_box(f"{name}_floor", (8.0, 6.0, 0.35), (x, y, 0.18), neutral),
        add_box(f"{name}_bench", (5.0, 1.4, 1.0), (x, y - 1.4, 0.85), neutral),
        add_box(f"{name}_canopy", (8.4, 6.4, 0.3), (x, y, 3.9), roof),
    ]
    for index in range(4):
        sx = x + (-3.6 if index % 2 == 0 else 3.6)
        sy = y + (-2.6 if index < 2 else 2.6)
        parts.append(
            add_cylinder(f"{name}_post_{index}", 0.14, 3.7, (sx, sy, 1.9), neutral, vertices=8)
        )
    # A three-segment arm. Enough articulation to read as robotic, cheap enough
    # to instance later if more are wanted.
    parts.append(add_cylinder(f"{name}_arm_base", 0.5, 0.6, (x + 2.2, y + 1.4, 1.6), neutral, vertices=12))
    upper = add_box(f"{name}_arm_upper", (0.35, 0.35, 2.2), (x + 2.2, y + 1.4, 2.8), neutral)
    upper.rotation_euler = (0.5, 0.0, 0.0)
    parts.append(upper)
    fore = add_box(f"{name}_arm_fore", (0.28, 0.28, 1.6), (x + 2.2, y + 0.1, 3.6), accent)
    fore.rotation_euler = (1.25, 0.0, 0.0)
    parts.append(fore)
    return parts


def build_tower(name, x, y, accent, neutral, roof):
    """Launch Tower: the park's tallest landmark, and its orientation cue. A
    visitor who has turned the camera until they are lost finds this first."""
    parts = [add_cylinder(f"{name}_pad", 5.0, 0.5, (x, y, 0.25), neutral, vertices=18)]
    for index in range(4):
        angle = index * math.pi / 2.0 + math.pi / 4.0
        parts.append(
            add_box(
                f"{name}_leg_{index}",
                (0.35, 0.35, 13.0),
                (x + math.cos(angle) * 2.3, y + math.sin(angle) * 2.3, 6.8),
                neutral,
            )
        )
    for index in range(4):
        z = 3.0 + index * 3.2
        parts.append(add_box(f"{name}_brace_{index}", (5.0, 5.0, 0.28), (x, y, z), neutral))
    # The rocket. A cone on a cylinder, with an emissive plume ring at the base.
    parts.append(add_cylinder(f"{name}_rocket", 1.3, 9.0, (x, y, 5.5), neutral, vertices=16))
    bpy.ops.mesh.primitive_cone_add(radius1=1.3, radius2=0.0, depth=3.0, location=(x, y, 11.5), vertices=16)
    nose = bpy.context.active_object
    nose.name = f"{name}_nose"
    assign(nose, accent)
    parts.append(nose)
    parts.append(add_cylinder(f"{name}_plume", 1.45, 0.5, (x, y, 1.2), accent, vertices=16))
    return parts


def build_booth(name, x, y, accent, neutral, roof):
    """Fortune Booth: a small striped tent. Smallest structure in the park, so
    its pin carries most of the burden of being noticed."""
    parts = [add_box(f"{name}_base", (3.2, 3.2, 2.4), (x, y, 1.2), neutral)]
    bpy.ops.mesh.primitive_cone_add(radius1=2.6, radius2=0.0, depth=2.0, location=(x, y, 3.4), vertices=12)
    roof_obj = bpy.context.active_object
    roof_obj.name = f"{name}_roof"
    assign(roof_obj, roof)
    parts.append(roof_obj)
    parts.append(add_box(f"{name}_window", (1.6, 0.14, 1.1), (x, y - 1.6, 1.5), accent))
    parts.append(add_cylinder(f"{name}_finial", 0.12, 1.0, (x, y, 4.7), accent, vertices=8))
    return parts


BUILDERS = {
    "pavilion": build_pavilion,
    "factory": build_factory,
    "graveyard": build_graveyard,
    "rotunda": build_rotunda,
    "workshop": build_workshop,
    "tower": build_tower,
    "booth": build_booth,
}


def build_sign(name, x, y, height, accent, neutral):
    """A vertical neon pylon beside an attraction.

    Every structure gets one. The reason is the camera: the orbit rig looks down
    at the park from above, so a horizontal emissive surface — a lit roof, a lit
    floor — foreshortens to nothing at the shallow end of the orbit and vanishes
    at the steep end. A vertical slab holds its area at every angle the rig
    permits, which makes each attraction findable as a light before it is
    findable as a shape.

    The slab faces the park's centre rather than the camera. A sign that turned
    to follow the camera would be a billboard, and billboards read as interface;
    these are meant to read as scenery. The pins are the interface.
    """
    angle = math.atan2(-y, -x)
    parts = [
        add_cylinder(f"{name}_sign_post", 0.16, height, (x, y, height / 2.0), neutral, vertices=8),
        add_box(
            f"{name}_sign_panel",
            (3.4, 0.22, 1.9),
            (x, y, height - 0.9),
            accent,
            rotation_z=angle + math.pi / 2.0,
        ),
    ]
    # A string of bulbs down the post. Cheap, and it is what says "carnival"
    # rather than "signage".
    for index in range(3):
        parts.append(
            add_cylinder(
                f"{name}_sign_bulb_{index}",
                0.17,
                0.17,
                (x, y, height - 2.1 - index * 0.75),
                accent,
                vertices=6,
            )
        )
    return parts


def build_ferris_wheel(x, y, accent, neutral):
    """The park's centrepiece.

    A carnival without a ferris wheel is a business park. It also does the
    orbit rig a favour: a tall open ring at the centre gives the eye something
    to rotate around, so a visitor turning the camera can tell they are turning
    rather than sliding.

    Built as a ring of spokes and gondolas rather than a torus. Sixteen spokes
    is enough to read as a wheel in silhouette and cheap enough to instance.
    """
    spokes = 16
    radius = 8.5
    hub_z = 10.0
    parts = [
        add_cylinder("Wheel_hub", 0.7, 1.6, (x, y, hub_z), neutral, vertices=12),
    ]
    for side in (-1.0, 1.0):
        parts.append(
            add_box(
                f"Wheel_support_{'a' if side < 0 else 'b'}",
                (0.5, 0.5, hub_z * 1.18),
                (x + side * 3.4, y, hub_z / 2.0),
                neutral,
            )
        )
    for index in range(spokes):
        angle = index * (2.0 * math.pi / spokes)
        gx = x + math.cos(angle) * radius
        gz = hub_z + math.sin(angle) * radius
        spoke = add_box(
            f"Wheel_spoke_{index:02d}",
            (0.14, 0.14, radius),
            (x + math.cos(angle) * radius / 2.0, y, hub_z + math.sin(angle) * radius / 2.0),
            neutral,
        )
        spoke.rotation_euler = (0.0, math.pi / 2.0 - angle, 0.0)
        parts.append(spoke)
        # Gondolas hang, so they are not rotated with the spoke.
        parts.append(
            add_box(f"Wheel_gondola_{index:02d}", (1.1, 1.3, 0.9), (gx, y, gz - 0.7), accent)
        )
    # The rim, as short chords between gondola positions.
    for index in range(spokes):
        a0 = index * (2.0 * math.pi / spokes)
        a1 = (index + 1) * (2.0 * math.pi / spokes)
        mx = x + (math.cos(a0) + math.cos(a1)) / 2.0 * radius
        mz = hub_z + (math.sin(a0) + math.sin(a1)) / 2.0 * radius
        chord = add_box(
            f"Wheel_rim_{index:02d}",
            (0.12, 0.12, 2.0 * radius * math.sin(math.pi / spokes)),
            (mx, y, mz),
            accent,
        )
        chord.rotation_euler = (0.0, -(a0 + a1) / 2.0, 0.0)
        parts.append(chord)
    return parts


def build_midway(material):
    """The path connecting the attractions.

    A ring rather than a tree: every attraction is one walk from every other,
    which is the same property the orbit camera has — no attraction is behind
    another.
    """
    parts = []
    steps = 58
    for index in range(steps):
        angle = index * (2.0 * math.pi / steps)
        # Threads inside the attraction ring rather than through it. The first
        # version ran the path at the same radius as the structures, so it
        # disappeared underneath them.
        radius = 12.5 + 2.2 * math.sin(angle * 3.0)
        parts.append(
            add_box(
                f"Midway_{index:02d}",
                (4.2, 4.2, 0.16),
                (math.cos(angle) * radius, math.sin(angle) * radius, 0.08),
                material,
                rotation_z=angle,
            )
        )
    return parts


def place_pin_anchors() -> None:
    """One Empty per attraction, named after its id.

    ``bake_export.py`` reads these and writes their world positions to
    ``assets/pipeline/pins.json``. Numbers flow one direction — Blender, JSON,
    application — so this is the only place a pin's position is decided.
    """
    for attraction in ATTRACTIONS:
        x, y = attraction["position"]
        empty = bpy.data.objects.new(attraction["id"], None)
        empty.empty_display_type = "SPHERE"
        empty.empty_display_size = 0.8
        empty.location = (x, y, attraction["pin_height"])
        bpy.context.collection.objects.link(empty)
    log(f"placed {len(ATTRACTIONS)} pin anchors")


def setup_bake_lighting() -> None:
    """Lighting that exists only to be baked.

    A night scene lit by a single moon reads as black. What sells a nighttime
    carnival is that the rides light themselves and the sky fills the rest, so
    this is a cool key plus a strong sky fill — the bake carries all of it into
    the texture and the shipped scene needs no lights at all.

    The world background here is a **lighting rig, not a backdrop**. It renders
    as a pale lavender sky in the Blender viewport, which looks like dusk rather
    than night and reads as a mistake until you know what it is for: only the
    island geometry is exported, and the night sky a visitor actually sees is the
    page's own ``--surface-ground`` behind a transparent canvas. Darkening this
    to match the page would darken the bake with it, which is exactly the error
    the first version made.
    """
    light_data = bpy.data.lights.new("bake_moon", "SUN")
    light_data.energy = 3.4
    light_data.color = (0.72, 0.80, 1.0)
    light_data.angle = 0.6
    moon = bpy.data.objects.new("bake_moon", light_data)
    moon.rotation_euler = (math.radians(52.0), 0.0, math.radians(215.0))
    bpy.context.collection.objects.link(moon)

    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = next(
        (n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None
    )
    if background is not None:
        # Deep indigo, and bright enough to actually fill. The first version used
        # a near-black sky at strength 1.1 and the whole island baked to black:
        # the palette was fine, the light was not. What makes this read as night
        # is the hue of the fill and the emissive rides, not an absence of light.
        background.inputs["Color"].default_value = (0.10, 0.095, 0.21, 1.0)
        background.inputs["Strength"].default_value = 2.6


def setup_camera() -> None:
    """A camera at the angle the navigation reference frames its map from:
    high, oblique, looking down the long axis of the park.

    The orbit rig clamps to a band around this pose, so it doubles as the
    scene's documentation of where a visitor is allowed to look from.
    """
    camera_data = bpy.data.cameras.new("Camera")
    camera_data.lens = 40.0
    camera = bpy.data.objects.new("Camera", camera_data)
    camera.location = (0.0, -55.0, 37.0)
    camera.rotation_euler = (math.radians(56.0), 0.0, 0.0)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera


# --------------------------------------------------------------------------- main


def build() -> None:
    clear_scene()

    # Three clearly separated values, darkest at the bottom. The first version
    # made the ground and the structures both near-black, so the park read as
    # coloured patches floating on nothing. A night scene still needs a value
    # range; what makes it night is the hue and the emissive accents, not
    # crushing everything to black.
    ground = unlit_material("Ground", "5d5480")
    cliff = unlit_material("Cliff", "2b2540")
    water = unlit_material("Water", "14112a")
    path = unlit_material("Path", "b7abdd", emission=0.35)
    neutral = unlit_material("Structure", "645b85")
    # A lighter neutral for large roof and dome surfaces. Emissive accent across
    # a whole roof reads as a flat coloured patch from the orbit camera — the
    # form disappears. Accents belong on signs, windows, trims and bulbs, where
    # their job is to be a point of light rather than a surface.
    roof = unlit_material("Roof", "8a7fae")

    accents = {
        token: unlit_material(f"Accent_{token}", hex_color, emission=3.0)
        for token, hex_color in ACCENTS.items()
    }

    build_water(water)
    build_plate(ground, cliff)
    build_midway(path)
    build_ferris_wheel(0.0, 0.0, accents["neon-yellow"], neutral)

    for attraction in ATTRACTIONS:
        x, y = attraction["position"]
        accent = accents[attraction["accent"]]
        BUILDERS[attraction["kind"]](attraction["id"], x, y, accent, neutral, roof)
        # The sign stands just outside the structure's footprint, on the side
        # facing the park's centre, so it is never behind its own building.
        offset = 5.4
        length = math.hypot(x, y) or 1.0
        build_sign(
            attraction["id"],
            x - x / length * offset,
            y - y / length * offset,
            max(4.5, attraction["pin_height"] * 0.78),
            accent,
            neutral,
        )
        log(f"built {attraction['id']} ({attraction['kind']})")

    place_pin_anchors()
    setup_bake_lighting()
    setup_camera()

    log(f"done: {len(bpy.context.scene.objects)} objects")


def main() -> None:
    build()

    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if argv:
        bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(argv[0]))
        log(f"saved {argv[0]}")


if __name__ == "__main__":
    main()
