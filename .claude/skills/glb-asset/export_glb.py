"""Export the open .blend to .glb with the project's glTF settings.

Run headless:
    blender -b model.blend --factory-startup --python-exit-code 1 --python export_glb.py -- out.glb

Prints every exported top-level node and the scene's bounding box in glTF axes,
so the size can be compared with the 2 m grid before `pnpm check:assets`.
"""

import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(argv) != 1 or not argv[0].endswith(".glb"):
    raise SystemExit("usage: ... --python export_glb.py -- <out>.glb")
out_path = argv[0]

scene = bpy.context.scene
if scene.unit_settings.system != "METRIC" or abs(scene.unit_settings.scale_length - 1.0) > 1e-6:
    raise SystemExit("scene units must be metric with unit scale 1.0")

meshes = [obj for obj in scene.objects if obj.type == "MESH"]
unapplied = [obj.name for obj in meshes if any(abs(s - 1.0) > 1e-6 for s in obj.scale)]
if unapplied:
    raise SystemExit(f"apply scale (Ctrl+A) before export: {', '.join(unapplied)}")

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_all_influences=False,
    export_draco_mesh_compression_enable=False,
    export_cameras=False,
    export_lights=False,
)

corners = [obj.matrix_world @ Vector(c) for obj in meshes for c in obj.bound_box]
if corners:
    # Blender (x, y, z) becomes glTF (x, z, -y).
    lo = Vector((min(c.x for c in corners), min(c.z for c in corners), min(-c.y for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.z for c in corners), max(-c.y for c in corners)))
    print(f"bbox gltf min {tuple(round(v, 3) for v in lo)} max {tuple(round(v, 3) for v in hi)}")
    print(f"size gltf {tuple(round(v, 3) for v in hi - lo)} m")
print("nodes:", ", ".join(sorted(obj.name for obj in scene.objects if obj.parent is None)))
print(f"exported {out_path}")
