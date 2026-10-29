"""Blender helpers for the AR / web assets (run by scripts/convert/ar-assets.ts, free and local).

  resize <max> <src> <dst> <JPEG|PNG> ...   downscale texture images (bytes untouched, no colour transform)
  usdz <src.glb> <dst.usdz> [action]        GLB → USDZ for iOS Quick Look; with an action, the rig and that
                                            clip are exported as UsdSkel animation
  inspect <file.usdz>                       print up axis, metres per unit, bounds and (if rigged) foot → toe
"""

import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
mode = argv[0]

if mode == "resize":
    size = int(argv[1])
    rest = argv[2:]
    for i in range(0, len(rest), 3):
        src, dst, fmt = rest[i : i + 3]
        img = bpy.data.images.load(src)
        img.colorspace_settings.name = "Non-Color"  # keep the stored bytes exactly as they are
        w, h = img.size
        k = min(1.0, size / max(w, h))
        if k < 1:
            img.scale(max(1, round(w * k)), max(1, round(h * k)))
        img.file_format = fmt
        img.filepath_raw = dst
        img.save(filepath=dst, quality=90)
        print(f"resized {src} → {dst} ({img.size[0]}×{img.size[1]} {fmt})")

elif mode == "usdz":
    src, dst = argv[1], argv[2]
    action_name = argv[3] if len(argv) > 3 else ""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    scene = bpy.context.scene
    animate = False
    if action_name:
        arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
        act = bpy.data.actions.get(action_name) or next(a for a in bpy.data.actions if a.name.startswith(action_name))
        ad = arm.animation_data or arm.animation_data_create()
        for track in ad.nla_tracks:
            track.mute = True
        ad.action = act
        if hasattr(ad, "action_slot") and len(act.slots):
            ad.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        scene.frame_start, scene.frame_end = int(f0), int(f1)
        animate = True
        print(f"action {act.name} frames {int(f0)}–{int(f1)} @ {scene.render.fps} fps")
    bpy.ops.wm.usd_export(
        filepath=dst,
        export_animation=animate,
        export_armatures=True,
        only_deform_bones=True,
        export_materials=True,
        generate_preview_surface=True,
        export_textures_mode="NEW",
        overwrite_textures=True,
        convert_orientation=True,
        export_global_forward_selection="NEGATIVE_Z",
        export_global_up_selection="Y",
        export_lights=False,
        export_cameras=False,
        usdz_downscale_size="KEEP",
    )
    print(f"wrote {dst}")

elif mode == "inspect":
    from pxr import Gf, Usd, UsdGeom, UsdSkel

    stage = Usd.Stage.Open(argv[1])
    for prim in stage.Traverse():
        if prim.IsA(UsdSkel.Root):
            # skinned points live in bind space: bake the skinning so the bounds are what Quick Look shows
            UsdSkel.BakeSkinning(UsdSkel.Root(prim), Gf.Interval(stage.GetStartTimeCode(), stage.GetStartTimeCode()))
    print("upAxis", UsdGeom.GetStageUpAxis(stage), "metersPerUnit", UsdGeom.GetStageMetersPerUnit(stage))
    t0 = Usd.TimeCode(stage.GetStartTimeCode())
    bbox = UsdGeom.BBoxCache(t0, [UsdGeom.Tokens.default_]).ComputeWorldBound(stage.GetPseudoRoot()).ComputeAlignedRange()
    print("bounds min", [round(v, 3) for v in bbox.GetMin()], "max", [round(v, 3) for v in bbox.GetMax()])
    print("time", stage.GetStartTimeCode(), "→", stage.GetEndTimeCode(), "@", stage.GetTimeCodesPerSecond())
    for prim in stage.Traverse():
        if prim.IsA(UsdSkel.Skeleton):
            skel = UsdSkel.Skeleton(prim)
            joints = list(skel.GetJointsAttr().Get())
            cache = UsdSkel.Cache()
            query = cache.GetSkelQuery(skel)
            xf = query.ComputeJointSkelTransforms(Usd.TimeCode.Default(), True)
            world = UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
            pos = {j.split("/")[-1]: (xf[i] * world).ExtractTranslation() for i, j in enumerate(joints)}
            foot = next((v for k, v in pos.items() if k.endswith("LeftFoot")), None)
            toe = next((v for k, v in pos.items() if k.endswith("LeftToeBase")), None)
            if foot is not None and toe is not None:
                print("skeleton joints", len(joints), "foot→toe", [round(v, 3) for v in (toe - foot)])
    for prim in stage.Traverse():
        if prim.GetTypeName() == "SkelAnimation":
            print("animation", prim.GetPath())
