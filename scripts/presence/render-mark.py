# JARVIS Presence — the mark, rendered as a physical object.
#
# A thick obsidian disc, brushed (anisotropic) surface, one hairline seam of
# warm light along its edge. Three states differ only in the seam's emission
# and a soft key light: rest, listening, speaking. Rendered with Cycles on
# Metal, square, transparent background, so the page composites it on the
# warm off-black ground. Nothing here is a ring, a glow or a reactor: it is a
# thing you could hold.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/presence/render-mark.py -- \
#       --out public/presence --size 1024 --samples 96
import argparse
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="public/presence")
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--states", default="rest,listening,speaking")
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

# Warm palette from the thesis
SEAM_RGB = (0.79, 0.64, 0.42)  # brass #C9A46B in linear-ish space
STATES = {
    # seam emission strength, key light energy, seam width scale
    "rest": dict(seam=1.2, key=180.0, width=1.0),
    "listening": dict(seam=6.0, key=260.0, width=1.35),
    "speaking": dict(seam=3.2, key=320.0, width=1.15),
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons.get("cycles")
if prefs:
    try:
        prefs.preferences.compute_device_type = "METAL"
        prefs.preferences.get_devices()
        for d in prefs.preferences.devices:
            d.use = True
    except Exception:
        scene.cycles.device = "CPU"
scene.render.resolution_x = args.size
scene.render.resolution_y = args.size
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Filmic" if "Filmic" in [
    i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items
] else "AgX"
scene.view_settings.look = "None"

# World: nearly black, so only our lights shape the object
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.004, 0.0038, 0.0035, 1)
bg.inputs[1].default_value = 1.0

# The disc: a fat cylinder with a beveled edge
bpy.ops.mesh.primitive_cylinder_add(vertices=256, radius=1.0, depth=0.22, location=(0, 0, 0))
disc = bpy.context.active_object
disc.name = "mark"
mod = disc.modifiers.new("bevel", "BEVEL")
mod.width = 0.045
mod.segments = 12
mod.limit_method = "ANGLE"
bpy.ops.object.shade_smooth()

# Obsidian body: dark, slightly warm, anisotropic brushing
mat = bpy.data.materials.new("obsidian")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.022, 0.020, 0.018, 1)
bsdf.inputs["Metallic"].default_value = 0.85
bsdf.inputs["Roughness"].default_value = 0.34
if "Anisotropic" in bsdf.inputs:
    bsdf.inputs["Anisotropic"].default_value = 0.7
    bsdf.inputs["Anisotropic Rotation"].default_value = 0.0
if "Coat Weight" in bsdf.inputs:
    bsdf.inputs["Coat Weight"].default_value = 0.35
    bsdf.inputs["Coat Roughness"].default_value = 0.12
# Fine radial brushing via a noise-driven bump
noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 420.0
noise.inputs["Detail"].default_value = 2.0
noise.inputs["Roughness"].default_value = 0.4
bump = nt.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.035
nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
disc.data.materials.append(mat)

# The seam: a thin torus lying in the disc's edge groove, emissive brass
def make_seam(width_scale: float, strength: float):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.005, minor_radius=0.006 * width_scale, major_segments=256, minor_segments=16,
        location=(0, 0, 0.0),
    )
    seam = bpy.context.active_object
    seam.name = "seam"
    m = bpy.data.materials.new("seam")
    m.use_nodes = True
    n = m.node_tree
    for node in list(n.nodes):
        n.nodes.remove(node)
    out = n.nodes.new("ShaderNodeOutputMaterial")
    em = n.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*SEAM_RGB, 1)
    em.inputs["Strength"].default_value = strength
    n.links.new(em.outputs["Emission"], out.inputs["Surface"])
    seam.data.materials.append(m)
    return seam

# Camera: three-quarter view from above, slight tilt, long lens
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 85
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (0.0, -3.2, 2.35)
cam.rotation_euler = (math.radians(54.0), 0.0, 0.0)

# Lights: one large soft key (upper left), one thin rim from behind-right
def area(name, loc, rot, size, energy, color=(1.0, 0.96, 0.9)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.color = color
    lo = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(lo)
    lo.location = loc
    lo.rotation_euler = rot
    return lo

key = area("key", (-2.6, -2.2, 3.4), (math.radians(48), math.radians(-28), math.radians(-20)), 3.5, 180.0)
rim = area("rim", (2.4, 2.6, 1.4), (math.radians(70), math.radians(35), math.radians(150)), 1.2, 120.0, (0.95, 0.9, 0.82))

for name in [s.strip() for s in args.states.split(",") if s.strip()]:
    st = STATES[name]
    seam = make_seam(st["width"], st["seam"])
    key.data.energy = st["key"]
    scene.render.filepath = os.path.join(args.out, f"mark-{name}.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(seam, do_unlink=True)
    print(f"[mark] rendered {scene.render.filepath}")
