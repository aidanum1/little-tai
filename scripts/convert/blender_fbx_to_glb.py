"""Blender (background) FBX -> GLB converter for Tripo quad exports.

Usage: Blender -b --factory-startup -P blender_fbx_to_glb.py -- <in.fbx> <out.glb>
Imports the FBX (embedded PBR textures included), keeps materials, triangulates on export (glTF has no quads)
and writes a single self-contained GLB with Y-up axes.

Tripo exports face +X (export_orientation "+x"). The model is turned -90 deg about the up axis and the
transform applied, so the GLB faces +Z — glTF's conventional front — in three.js, model-viewer and engines.
"""
import math
import sys

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src, use_image_search=True)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit(f"no mesh objects found in {src}")

# face +Z in glTF (= -Y in Blender): rotate -90 deg about Blender's Z (up) around the world origin, then apply
for obj in [o for o in bpy.context.scene.objects if o.parent is None]:
    obj.rotation_mode = "XYZ"
    obj.matrix_world = mathutils.Matrix.Rotation(-math.pi / 2, 4, "Z") @ obj.matrix_world
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# make sure every image is embedded in the .blend data so the GLB exporter can write it
for img in bpy.data.images:
    if img.source == "FILE" and not img.packed_file:
        try:
            img.pack()
        except RuntimeError:
            pass

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
)
print(f"converted {src} -> {dst}: {len(meshes)} mesh(es), {len(bpy.data.images)} image(s)")
