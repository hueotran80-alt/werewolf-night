"""
create_game_props.py - Blender Headless Script
Generates 3D Game Props for Werewolf (Ma Sói) Game:
1. Tombstone.glb: Antique Gothic mossy tombstone (~0.4m x 0.7m x 0.15m)
   for eliminated player seat replacement.
2. GhostSoul.glb: Ethereal floating spectral ghost soul (~0.45m x 0.8m x 0.4m)
   with glowing eyes, wispy tendrils, hovering orbs, and floating idle animation.

Run headlessly:
  blender -b -P blender_scripts/create_game_props.py
"""

import bpy
import bmesh
from mathutils import Vector, Matrix, Euler, Quaternion
from math import pi, sin, cos, radians
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_MODELS = os.path.join(PROJECT_ROOT, 'public', 'models')
os.makedirs(PUBLIC_MODELS, exist_ok=True)


def reset_scene():
    """Resets the Blender scene completely without GUI dependencies."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure a default scene and collection
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")
    scene = bpy.context.scene or bpy.data.scenes[0]
    bpy.context.window.scene = scene
    return scene


# =============================================================================
# 1. TOMBSTONE GENERATOR
# =============================================================================
def build_tombstone():
    print(">>> Building Tombstone.glb...")
    reset_scene()

    # Materials
    # Base weathered stone
    mat_stone = bpy.data.materials.new(name="Mat_Tombstone_Stone")
    mat_stone.use_nodes = True
    bsdf_stone = mat_stone.node_tree.nodes.get("Principled BSDF")
    bsdf_stone.inputs["Base Color"].default_value = (0.32, 0.33, 0.31, 1.0)
    bsdf_stone.inputs["Roughness"].default_value = 0.88
    bsdf_stone.inputs["Metallic"].default_value = 0.02

    # Ancient dark moss
    mat_moss = bpy.data.materials.new(name="Mat_Tombstone_Moss")
    mat_moss.use_nodes = True
    bsdf_moss = mat_moss.node_tree.nodes.get("Principled BSDF")
    bsdf_moss.inputs["Base Color"].default_value = (0.13, 0.22, 0.08, 1.0)
    bsdf_moss.inputs["Roughness"].default_value = 0.95
    bsdf_moss.inputs["Metallic"].default_value = 0.0

    # Gothic Carved Dark Engraving / Relic
    mat_dark = bpy.data.materials.new(name="Mat_Tombstone_Engraving")
    mat_dark.use_nodes = True
    bsdf_dark = mat_dark.node_tree.nodes.get("Principled BSDF")
    bsdf_dark.inputs["Base Color"].default_value = (0.12, 0.12, 0.14, 1.0)
    bsdf_dark.inputs["Roughness"].default_value = 0.75
    bsdf_dark.inputs["Metallic"].default_value = 0.05

    # 1. Pedestal Base Tier 1 (Bottom foundation)
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0, 0, 0.035),
        scale=(0.44, 0.20, 0.07)
    )
    obj_base1 = bpy.context.active_object
    obj_base1.name = "Pedestal_Bottom"
    obj_base1.data.materials.append(mat_stone)
    obj_base1.data.materials.append(mat_moss)

    # Slight bevel on base
    mod_bev = obj_base1.modifiers.new("Bevel", "BEVEL")
    mod_bev.width = 0.012
    mod_bev.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # Pedestal Base Tier 2 (Step)
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0, 0, 0.09),
        scale=(0.38, 0.16, 0.04)
    )
    obj_base2 = bpy.context.active_object
    obj_base2.name = "Pedestal_Top"
    obj_base2.data.materials.append(mat_stone)

    mod_bev2 = obj_base2.modifiers.new("Bevel", "BEVEL")
    mod_bev2.width = 0.008
    mod_bev2.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # 2. Main Gothic Headstone Slab
    # We construct a curved Gothic pointed arch headstone using bmesh
    bm = bmesh.new()
    width = 0.32
    thickness = 0.09
    h_straight = 0.42  # height of vertical sides above pedestal top (z=0.11)
    h_arch_apex = 0.58  # apex height of the pointed arch above z=0.11
    # total height = 0.11 + 0.58 = 0.69m (~0.7m)

    # Front profile 2D points (X, Z relative to base at z=0.11)
    profile_pts = []
    # Bottom corners
    profile_pts.append((-width/2, 0.0))
    profile_pts.append((-width/2, h_straight))

    # Left Gothic arch shoulder curve towards apex (0, h_arch_apex)
    num_arch_segs = 8
    for i in range(1, num_arch_segs):
        t = i / num_arch_segs
        # Gothic pointed arc (tangent curve with slight pointed crown)
        ang = pi/2 * (1.0 - t)
        # Offset center for pointed arch
        r_arch = width * 0.75
        center_x = width/2 - r_arch + 0.05
        x = -width/2 * (1 - t)
        z = h_straight + (h_arch_apex - h_straight) * sin(pi/2 * t)
        profile_pts.append((x, z))

    # Apex
    profile_pts.append((0.0, h_arch_apex))

    # Right side mirrored
    for i in range(num_arch_segs - 1, 0, -1):
        x, z = profile_pts[2 + i - 1]
        profile_pts.append((-x, z))

    profile_pts.append((width/2, h_straight))
    profile_pts.append((width/2, 0.0))

    # Extrude along Y (-thickness/2 to +thickness/2)
    # Create front vertices (Y = +thickness/2) and back vertices (Y = -thickness/2)
    y_front = thickness / 2.0
    y_back = -thickness / 2.0
    z_offset = 0.11

    front_verts = []
    back_verts = []
    for x, z in profile_pts:
        front_verts.append(bm.verts.new((x, y_front, z + z_offset)))
        back_verts.append(bm.verts.new((x, y_back, z + z_offset)))

    n_pts = len(profile_pts)

    # Create front face (fan or polygon)
    front_face = bm.faces.new(front_verts)
    front_face.material_index = 0

    # Create back face (reversed order for correct normal)
    back_face = bm.faces.new(list(reversed(back_verts)))
    back_face.material_index = 0

    # Create side faces connecting front and back
    for i in range(n_pts):
        next_i = (i + 1) % n_pts
        side_face = bm.faces.new([
            front_verts[i],
            back_verts[i],
            back_verts[next_i],
            front_verts[next_i]
        ])
        side_face.material_index = 0

    # Weathered Chip / Crack at top right shoulder:
    # Slightly deform a few vertices near the top right for that ancient weathered look
    for v in bm.verts:
        if v.co.x > 0.08 and v.co.z > 0.55:
            v.co.x -= 0.012
            v.co.z -= 0.018

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh_slab = bpy.data.meshes.new("Tombstone_Slab_Mesh")
    bm.to_mesh(mesh_slab)
    bm.free()

    obj_slab = bpy.data.objects.new("Tombstone_Slab", mesh_slab)
    bpy.context.collection.objects.link(obj_slab)
    obj_slab.data.materials.append(mat_stone)

    # Apply bevel modifier to headstone for realistic stone edges
    bpy.context.view_layer.objects.active = obj_slab
    mod_slab_bev = obj_slab.modifiers.new("Bevel", "BEVEL")
    mod_slab_bev.width = 0.007
    mod_slab_bev.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")

    # 3. Gothic Relief Cross on Front Face
    # Vertical cross beam
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0, y_front + 0.004, z_offset + 0.38),
        scale=(0.038, 0.014, 0.22)
    )
    cross_vert = bpy.context.active_object
    cross_vert.name = "Cross_Vertical"
    cross_vert.data.materials.append(mat_dark)

    # Horizontal cross beam
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0, y_front + 0.004, z_offset + 0.43),
        scale=(0.14, 0.014, 0.038)
    )
    cross_horiz = bpy.context.active_object
    cross_horiz.name = "Cross_Horizontal"
    cross_horiz.data.materials.append(mat_dark)

    # Cross Center Rosette / Emblem
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12,
        radius=0.032,
        depth=0.018,
        location=(0, y_front + 0.005, z_offset + 0.43),
        rotation=(radians(90), 0, 0)
    )
    cross_center = bpy.context.active_object
    cross_center.name = "Cross_Emblem"
    cross_center.data.materials.append(mat_dark)

    # 4. R.I.P. Engraving Plaque
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0, y_front + 0.003, z_offset + 0.20),
        scale=(0.16, 0.008, 0.05)
    )
    plaque = bpy.context.active_object
    plaque.name = "RIP_Plaque"
    plaque.data.materials.append(mat_dark)

    # 3 Letter studs or bars representing "R I P"
    for i, offset_x in enumerate([-0.045, 0.0, 0.045]):
        bpy.ops.mesh.primitive_cube_add(
            size=1.0,
            location=(offset_x, y_front + 0.008, z_offset + 0.20),
            scale=(0.022, 0.006, 0.025)
        )
        stud = bpy.context.active_object
        stud.name = f"RIP_Char_{i}"
        stud.data.materials.append(mat_stone)

    # 5. Overgrown Moss Clusters at Bottom Corners
    moss_coords = [
        (-0.16, 0.06, 0.07, 0.035),
        (-0.14, -0.06, 0.07, 0.03),
        (0.15, 0.05, 0.06, 0.032),
        (0.08, 0.07, 0.12, 0.025),
        (-0.06, -0.08, 0.05, 0.028)
    ]
    for i, (mx, my, mz, mr) in enumerate(moss_coords):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=10,
            ring_count=8,
            radius=mr,
            location=(mx, my, mz)
        )
        moss_obj = bpy.context.active_object
        moss_obj.name = f"Moss_Cluster_{i}"
        moss_obj.scale = (1.2, 1.0, 0.6)
        moss_obj.data.materials.append(mat_moss)

    # 6. Join into a clean hierarchy or single combined model
    # Select all mesh objects
    bpy.ops.object.select_all(action='DESELECT')
    mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    for obj in mesh_objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = obj_slab

    # Apply all transforms
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Join meshes into a single solid, optimized Tombstone asset
    bpy.ops.object.join()
    tombstone_root = bpy.context.active_object
    tombstone_root.name = "Tombstone"

    # Set shade smooth with auto smooth angle for crisp stone edges
    bpy.ops.object.shade_smooth()
    # Blender 4+ auto-smooth modifier
    if hasattr(tombstone_root.data, "use_auto_smooth"):
        tombstone_root.data.use_auto_smooth = True
        tombstone_root.data.auto_smooth_angle = radians(40)
    else:
        # Blender 4.1+ modifier
        try:
            mod_sm = tombstone_root.modifiers.new("SmoothByAngle", "SMOOTH_BY_ANGLE")
            mod_sm.angle = radians(40)
        except Exception:
            pass

    # Ensure origin is at base Z=0 for easy Three.js seat placement
    tombstone_root.location = (0, 0, 0)

    # Export Tombstone.glb
    out_file = os.path.join(PUBLIC_MODELS, "Tombstone.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_file,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_materials='EXPORT'
    )
    print(f"Successfully generated and exported: {out_file}")
    return out_file


# =============================================================================
# 2. GHOST SOUL GENERATOR
# =============================================================================
def build_ghost_soul():
    print(">>> Building GhostSoul.glb...")
    reset_scene()

    # Materials
    # Translucent Glowing Ethereal Body
    mat_ghost = bpy.data.materials.new(name="Mat_Ghost_Soul")
    mat_ghost.use_nodes = True
    mat_ghost.blend_method = 'BLEND'
    bsdf_ghost = mat_ghost.node_tree.nodes.get("Principled BSDF")
    # Mystic ethereal cyan-teal translucent glow
    bsdf_ghost.inputs["Base Color"].default_value = (0.20, 0.78, 0.95, 0.58)
    bsdf_ghost.inputs["Roughness"].default_value = 0.18
    bsdf_ghost.inputs["Transmission Weight"].default_value = 0.55
    bsdf_ghost.inputs["Emission Color"].default_value = (0.15, 0.75, 1.0, 1.0)
    bsdf_ghost.inputs["Emission Strength"].default_value = 1.9

    # Piercing Supernatural Glowing Eyes
    mat_eyes = bpy.data.materials.new(name="Mat_Ghost_Eyes")
    mat_eyes.use_nodes = True
    bsdf_eyes = mat_eyes.node_tree.nodes.get("Principled BSDF")
    bsdf_eyes.inputs["Base Color"].default_value = (0.9, 1.0, 1.0, 1.0)
    bsdf_eyes.inputs["Roughness"].default_value = 0.05
    bsdf_eyes.inputs["Emission Color"].default_value = (0.45, 0.95, 1.0, 1.0)
    bsdf_eyes.inputs["Emission Strength"].default_value = 4.5

    # Spirit Orbs (Will-o'-the-wisp)
    mat_orb = bpy.data.materials.new(name="Mat_Ghost_Orb")
    mat_orb.use_nodes = True
    mat_orb.blend_method = 'BLEND'
    bsdf_orb = mat_orb.node_tree.nodes.get("Principled BSDF")
    bsdf_orb.inputs["Base Color"].default_value = (0.35, 0.85, 1.0, 0.70)
    bsdf_orb.inputs["Roughness"].default_value = 0.12
    bsdf_orb.inputs["Transmission Weight"].default_value = 0.40
    bsdf_orb.inputs["Emission Color"].default_value = (0.30, 0.85, 1.0, 1.0)
    bsdf_orb.inputs["Emission Strength"].default_value = 3.2

    # 1. Main Ethereal Body Mesh (Lofted rings for wispy flowing specter)
    bm = bmesh.new()

    # Define loft levels from top crown down through head, chest, waist, and curled wispy tail
    # (z_height, radius_x, radius_y, center_y, rotation_deg)
    rings_data = [
        # Crown apex
        (0.72, 0.05, 0.05, 0.00),
        # Head widest part
        (0.66, 0.14, 0.14, 0.00),
        # Head lower / jaw
        (0.57, 0.13, 0.13, 0.01),
        # Neck / upper chest
        (0.50, 0.16, 0.14, 0.02),
        # Mid torso
        (0.40, 0.18, 0.15, 0.03),
        # Lower torso drifting backwards
        (0.30, 0.15, 0.13, -0.01),
        # Wispy waist tapering
        (0.20, 0.11, 0.10, -0.07),
        # Curled tail segment 1
        (0.12, 0.07, 0.06, -0.14),
        # Curled tail segment 2
        (0.06, 0.04, 0.03, -0.21),
        # Tail tip
        (0.02, 0.01, 0.01, -0.27),
    ]

    segs = 16
    ring_vert_loops = []

    for z, rx, ry, cy in rings_data:
        loop = []
        for s in range(segs):
            angle = 2 * pi * s / segs
            vx = rx * cos(angle)
            vy = ry * sin(angle) + cy
            # Subtle wave rippling
            vz = z + 0.015 * sin(angle * 2.0)
            vert = bm.verts.new((vx, vy, vz))
            loop.append(vert)
        ring_vert_loops.append(loop)

    # Cap top
    top_center = bm.verts.new((0.0, 0.0, 0.74))
    for s in range(segs):
        next_s = (s + 1) % segs
        bm.faces.new([top_center, ring_vert_loops[0][s], ring_vert_loops[0][next_s]])

    # Bridge rings
    for r in range(len(ring_vert_loops) - 1):
        l1 = ring_vert_loops[r]
        l2 = ring_vert_loops[r + 1]
        for s in range(segs):
            next_s = (s + 1) % segs
            bm.faces.new([l1[s], l2[s], l2[next_s], l1[next_s]])

    # Cap tail tip
    tip_vert = bm.verts.new((0.0, -0.30, 0.00))
    last_loop = ring_vert_loops[-1]
    for s in range(segs):
        next_s = (s + 1) % segs
        bm.faces.new([tip_vert, last_loop[next_s], last_loop[s]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh_body = bpy.data.meshes.new("Ghost_Body_Mesh")
    bm.to_mesh(mesh_body)
    bm.free()

    obj_body = bpy.data.objects.new("Ghost_Body", mesh_body)
    bpy.context.collection.objects.link(obj_body)
    obj_body.data.materials.append(mat_ghost)

    # 2. Flowing Wispy Shrouds / Vaporous Arms (Tendrils)
    # Left wispy arm
    for side, sign in [("Left", -1), ("Right", 1)]:
        bm_arm = bmesh.new()
        arm_pts = [
            # Shoulder
            (sign * 0.14, 0.02, 0.48, 0.04),
            # Elbow flare
            (sign * 0.24, -0.04, 0.38, 0.035),
            # Tapering wisp
            (sign * 0.28, -0.12, 0.26, 0.025),
            # Trailing flame tip
            (sign * 0.22, -0.22, 0.16, 0.008)
        ]
        arm_loops = []
        for ax, ay, az, ar in arm_pts:
            l = []
            for s in range(8):
                ang = 2 * pi * s / 8
                vx = ax + ar * cos(ang)
                vy = ay + ar * sin(ang)
                vz = az
                l.append(bm_arm.verts.new((vx, vy, vz)))
            arm_loops.append(l)

        for r in range(len(arm_loops) - 1):
            al1 = arm_loops[r]
            al2 = arm_loops[r + 1]
            for s in range(8):
                next_s = (s + 1) % 8
                bm_arm.faces.new([al1[s], al2[s], al2[next_s], al1[next_s]])

        bmesh.ops.recalc_face_normals(bm_arm, faces=bm_arm.faces)
        mesh_arm = bpy.data.meshes.new(f"Ghost_Arm_{side}_Mesh")
        bm_arm.to_mesh(mesh_arm)
        bm_arm.free()

        obj_arm = bpy.data.objects.new(f"Ghost_Arm_{side}", mesh_arm)
        bpy.context.collection.objects.link(obj_arm)
        obj_arm.data.materials.append(mat_ghost)

    # 3. Supernatural Glowing Eyes
    # Two tilted almond-shaped eyes embedded in front of head
    for eye_side, sign in [("Left", -1), ("Right", 1)]:
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=12,
            ring_count=8,
            radius=0.026,
            location=(sign * 0.048, 0.125, 0.63)
        )
        eye_obj = bpy.context.active_object
        eye_obj.name = f"Ghost_Eye_{eye_side}"
        eye_obj.scale = (0.7, 0.35, 1.3)
        eye_obj.rotation_euler = (radians(-15), radians(sign * 18), radians(sign * -10))
        eye_obj.data.materials.append(mat_eyes)

    # 4. Orbiting Spirit Wisps / Will-o'-the-wisps (Ethereal soul particles)
    orb_locations = [
        (-0.24, 0.10, 0.58, 0.038),
        (0.22, 0.12, 0.45, 0.032),
        (-0.16, -0.22, 0.32, 0.028),
        (0.18, -0.18, 0.22, 0.025),
    ]
    for i, (ox, oy, oz, orad) in enumerate(orb_locations):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=10,
            ring_count=8,
            radius=orad,
            location=(ox, oy, oz)
        )
        orb_obj = bpy.context.active_object
        orb_obj.name = f"Spirit_Orb_{i}"
        orb_obj.data.materials.append(mat_orb)

    # 5. Create Root Hierarchy and Subsurf smoothing
    bpy.ops.object.select_all(action='DESELECT')
    all_ghost_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    for obj in all_ghost_objs:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_smooth()
        if "Body" in obj.name or "Arm" in obj.name:
            mod_sub = obj.modifiers.new("Subsurf", "SUBSURF")
            mod_sub.levels = 1
            mod_sub.render_levels = 1

    # Create Empty Root for the entire Ghost Soul
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    ghost_root = bpy.context.active_object
    ghost_root.name = "GhostSoul_Root"

    for obj in all_ghost_objs:
        obj.parent = ghost_root

    # 6. Idle Floating Animation ("Idle_Float")
    # Adds a gentle, hypnotic 60-frame looping bob and sway
    ghost_root.animation_data_create()
    action = bpy.data.actions.new(name="Idle_Float")
    ghost_root.animation_data.action = action

    # Keyframes at t=1, 30, 60
    # Frame 1
    ghost_root.location = (0, 0, 0)
    ghost_root.rotation_euler = (0, 0, 0)
    ghost_root.keyframe_insert(data_path="location", frame=1)
    ghost_root.keyframe_insert(data_path="rotation_euler", frame=1)

    # Frame 15 (sway left)
    ghost_root.location = (-0.015, 0.01, 0.025)
    ghost_root.rotation_euler = (radians(1.5), radians(-2.0), radians(2.0))
    ghost_root.keyframe_insert(data_path="location", frame=15)
    ghost_root.keyframe_insert(data_path="rotation_euler", frame=15)

    # Frame 30 (peak crest floating up)
    ghost_root.location = (0, 0.02, 0.05)
    ghost_root.rotation_euler = (radians(2.5), 0, 0)
    ghost_root.keyframe_insert(data_path="location", frame=30)
    ghost_root.keyframe_insert(data_path="rotation_euler", frame=30)

    # Frame 45 (sway right)
    ghost_root.location = (0.015, 0.01, 0.025)
    ghost_root.rotation_euler = (radians(1.5), radians(2.0), radians(-2.0))
    ghost_root.keyframe_insert(data_path="location", frame=45)
    ghost_root.keyframe_insert(data_path="rotation_euler", frame=45)

    # Frame 60 (back to start loop)
    ghost_root.location = (0, 0, 0)
    ghost_root.rotation_euler = (0, 0, 0)
    ghost_root.keyframe_insert(data_path="location", frame=60)
    ghost_root.keyframe_insert(data_path="rotation_euler", frame=60)

    # Make interpolation smooth bezier for looping
    if ghost_root.animation_data and ghost_root.animation_data.action:
        for fcurve in ghost_root.animation_data.action.fcurves:
            for kp in fcurve.keyframe_points:
                kp.interpolation = 'BEZIER'

    # Set frame range
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 60

    # 7. Export GhostSoul.glb
    bpy.ops.object.select_all(action='DESELECT')
    ghost_root.select_set(True)
    for child in ghost_root.children_recursive:
        child.select_set(True)

    out_file = os.path.join(PUBLIC_MODELS, "GhostSoul.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_file,
        export_format='GLB',
        use_selection=False,
        export_apply=False,  # Keep hierarchy & animation intact
        export_animations=True,
        export_materials='EXPORT'
    )
    print(f"Successfully generated and exported: {out_file}")
    return out_file


def main():
    print("==================================================")
    print("STARTING BLENDER HEADLESS GAME PROPS GENERATION")
    print("==================================================")
    tomb_path = build_tombstone()
    ghost_path = build_ghost_soul()
    print("==================================================")
    print("COMPLETED ALL GAME PROPS GENERATION:")
    print(f"1. Tombstone: {tomb_path} (exists={os.path.exists(tomb_path)}, size={os.path.getsize(tomb_path)} bytes)")
    print(f"2. GhostSoul: {ghost_path} (exists={os.path.exists(ghost_path)}, size={os.path.getsize(ghost_path)} bytes)")
    print("==================================================")


if __name__ == '__main__':
    main()
