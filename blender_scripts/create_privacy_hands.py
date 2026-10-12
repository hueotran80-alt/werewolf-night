import bpy
import bmesh
from mathutils import Vector, Matrix, Euler
from math import pi, sin, cos, radians
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_MODELS = os.path.join(PROJECT_ROOT, 'public', 'models')
os.makedirs(PUBLIC_MODELS, exist_ok=True)

def create_privacy_hands_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # -------------------------------------------------------------------------
    # 1. PBR Materials
    # -------------------------------------------------------------------------
    # Material 0: Rich Medieval Leather Glove
    mat_leather = bpy.data.materials.new(name="Mat_Glove_Leather")
    mat_leather.use_nodes = True
    bsdf_leather = mat_leather.node_tree.nodes.get("Principled BSDF")
    bsdf_leather.inputs["Base Color"].default_value = (0.22, 0.11, 0.05, 1.0)
    bsdf_leather.inputs["Roughness"].default_value = 0.42
    bsdf_leather.inputs["Metallic"].default_value = 0.02

    # Material 1: Dark Charcoal Leather Cuff & Straps
    mat_dark = bpy.data.materials.new(name="Mat_Glove_DarkTrim")
    mat_dark.use_nodes = True
    bsdf_dark = mat_dark.node_tree.nodes.get("Principled BSDF")
    bsdf_dark.inputs["Base Color"].default_value = (0.07, 0.05, 0.04, 1.0)
    bsdf_dark.inputs["Roughness"].default_value = 0.55
    bsdf_dark.inputs["Metallic"].default_value = 0.0

    # Material 2: Antique Gold Brass Accents & Buckles
    mat_gold = bpy.data.materials.new(name="Mat_Glove_Gold")
    mat_gold.use_nodes = True
    bsdf_gold = mat_gold.node_tree.nodes.get("Principled BSDF")
    bsdf_gold.inputs["Base Color"].default_value = (0.85, 0.68, 0.22, 1.0)
    bsdf_gold.inputs["Roughness"].default_value = 0.28
    bsdf_gold.inputs["Metallic"].default_value = 0.92

    # Material 3: Ethereal Privacy Shield Aura (Translucent fog / magical shroud)
    mat_aura = bpy.data.materials.new(name="Mat_Privacy_Aura")
    mat_aura.use_nodes = True
    mat_aura.blend_method = 'BLEND'
    bsdf_aura = mat_aura.node_tree.nodes.get("Principled BSDF")
    bsdf_aura.inputs["Base Color"].default_value = (0.09, 0.05, 0.18, 0.50)
    bsdf_aura.inputs["Roughness"].default_value = 0.25
    bsdf_aura.inputs["Transmission Weight"].default_value = 0.40
    if "Emission Color" in bsdf_aura.inputs:
        bsdf_aura.inputs["Emission Color"].default_value = (0.35, 0.20, 0.55, 1.0)
        bsdf_aura.inputs["Emission Strength"].default_value = 0.8
    elif "Emission" in bsdf_aura.inputs:
        bsdf_aura.inputs["Emission"].default_value = (0.35, 0.20, 0.55, 1.0)

    # -------------------------------------------------------------------------
    # Helper: Build a curved finger mesh
    # -------------------------------------------------------------------------
    def build_finger(bm, start_pt, mid_pt, end_pt, base_radius=0.016, tip_radius=0.011, segs=8, mat_idx=0):
        # Creates a smooth tapered 3-segment finger tube
        ctrl_pts = [start_pt, mid_pt, end_pt]
        steps = 6
        points = []
        radii = []
        for i in range(steps + 1):
            t = i / steps
            # Quadratic Bezier
            p = (1-t)**2 * ctrl_pts[0] + 2*(1-t)*t * ctrl_pts[1] + t**2 * ctrl_pts[2]
            r = base_radius * (1 - t) + tip_radius * t
            points.append(p)
            radii.append(r)

        # Generate rings along the tangent
        rings = []
        for i in range(len(points)):
            p = points[i]
            r = radii[i]
            if i < len(points) - 1:
                tangent = (points[i+1] - p).normalized()
            else:
                tangent = (p - points[i-1]).normalized()

            # Normal and binormal
            arbitrary = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((0, 1, 0))
            norm = tangent.cross(arbitrary).normalized()
            binorm = tangent.cross(norm).normalized()

            ring_verts = []
            for j in range(segs):
                ang = 2 * pi * j / segs
                v_pos = p + r * (cos(ang) * norm + sin(ang) * binorm)
                ring_verts.append(bm.verts.new(v_pos))
            rings.append(ring_verts)

        # Connect rings
        for i in range(len(rings) - 1):
            r1 = rings[i]
            r2 = rings[i+1]
            for j in range(segs):
                nj = (j + 1) % segs
                f = bm.faces.new([r1[j], r1[nj], r2[nj], r2[j]])
                f.material_index = mat_idx

        # Cap base and tip
        base_center = bm.verts.new(points[0])
        for j in range(segs):
            nj = (j + 1) % segs
            f = bm.faces.new([base_center, rings[0][nj], rings[0][j]])
            f.material_index = mat_idx

        tip_center = bm.verts.new(points[-1])
        for j in range(segs):
            nj = (j + 1) % segs
            f = bm.faces.new([tip_center, rings[-1][j], rings[-1][nj]])
            f.material_index = mat_idx

    # -------------------------------------------------------------------------
    # Helper: Build left hand mesh
    # Card is width=0.52 (x from -0.26 to +0.26), height=0.78 (y from -0.39 to +0.39)
    # Left edge is at x = -0.26
    # -------------------------------------------------------------------------
    def build_hand_mesh(is_left=True):
        bm = bmesh.new()

        # Left hand coordinates
        # Palm block (stylized glove body)
        # Sits along x = -0.28 to -0.25, y = -0.32 to -0.10, z = -0.02 to 0.03
        palm_box = bmesh.ops.create_cube(bm, size=1.0)
        palm_verts = palm_box['verts']
        # Transform palm cube into an ergonomic cupped palm shape
        for v in palm_verts:
            # Normalize around (0,0,0)
            x, y, z = v.co.x, v.co.y, v.co.z
            # Shape into palm: width~0.065, height~0.18, depth~0.04
            new_x = -0.285 + (x + 0.5) * 0.055
            new_y = -0.24 + (y + 0.5) * 0.17
            # Give a slight outward curve along Z
            curve_z = sin((y + 0.5) * pi) * 0.015
            new_z = 0.005 + (z + 0.5) * 0.035 + curve_z
            v.co = Vector((new_x, new_y, new_z))

        for f in bm.faces:
            f.material_index = 0

        # Build Thumb (gripping front edge of card)
        # From base (x=-0.26, y=-0.28, z=0.015) to front card surface (x=-0.22, y=-0.22, z=0.035)
        build_finger(
            bm,
            start_pt=Vector((-0.265, -0.285, 0.012)),
            mid_pt=Vector((-0.245, -0.255, 0.032)),
            end_pt=Vector((-0.218, -0.215, 0.036)),
            base_radius=0.017, tip_radius=0.013, segs=8, mat_idx=0
        )

        # Build 4 Cupped Fingers:
        # Index finger (topmost)
        build_finger(
            bm,
            start_pt=Vector((-0.272, -0.095, 0.022)),
            mid_pt=Vector((-0.280, -0.045, 0.085)),
            end_pt=Vector((-0.225, 0.010, 0.115)),
            base_radius=0.016, tip_radius=0.012, segs=8, mat_idx=0
        )

        # Middle finger (longest, arches slightly higher)
        build_finger(
            bm,
            start_pt=Vector((-0.275, -0.145, 0.020)),
            mid_pt=Vector((-0.292, -0.110, 0.092)),
            end_pt=Vector((-0.215, -0.075, 0.125)),
            base_radius=0.0165, tip_radius=0.0125, segs=8, mat_idx=0
        )

        # Ring finger
        build_finger(
            bm,
            start_pt=Vector((-0.276, -0.195, 0.018)),
            mid_pt=Vector((-0.288, -0.170, 0.082)),
            end_pt=Vector((-0.220, -0.150, 0.110)),
            base_radius=0.0155, tip_radius=0.012, segs=8, mat_idx=0
        )

        # Pinky finger (bottom)
        build_finger(
            bm,
            start_pt=Vector((-0.278, -0.245, 0.014)),
            mid_pt=Vector((-0.285, -0.230, 0.065)),
            end_pt=Vector((-0.230, -0.220, 0.085)),
            base_radius=0.014, tip_radius=0.011, segs=8, mat_idx=0
        )

        # Gauntlet Cuff / Forearm Bracer:
        # Tapered cylinder extending back from wrist
        wrist_start = Vector((-0.295, -0.325, 0.005))
        forearm_end = Vector((-0.370, -0.460, -0.050))
        cuff_steps = 4
        cuff_segs = 12
        cuff_rings = []
        cuff_dir = (forearm_end - wrist_start).normalized()
        arb = Vector((0, 0, 1)) if abs(cuff_dir.z) < 0.9 else Vector((0, 1, 0))
        cuff_n = cuff_dir.cross(arb).normalized()
        cuff_bn = cuff_dir.cross(cuff_n).normalized()

        for s in range(cuff_steps + 1):
            ts = s / cuff_steps
            cp = wrist_start * (1 - ts) + forearm_end * ts
            cr = 0.038 * (1 - ts) + 0.052 * ts
            ring = []
            for j in range(cuff_segs):
                ang = 2 * pi * j / cuff_segs
                v_pos = cp + cr * (cos(ang) * cuff_n + sin(ang) * cuff_bn)
                ring.append(bm.verts.new(v_pos))
            cuff_rings.append(ring)

        for s in range(cuff_steps):
            r1 = cuff_rings[s]
            r2 = cuff_rings[s+1]
            # Cuff rim is dark leather, with gold trim at wrist
            f_mat = 2 if s == 0 else 1
            for j in range(cuff_segs):
                nj = (j + 1) % cuff_segs
                f = bm.faces.new([r1[j], r1[nj], r2[nj], r2[j]])
                f.material_index = f_mat

        # Cap back of forearm
        back_center = bm.verts.new(forearm_end)
        for j in range(cuff_segs):
            nj = (j + 1) % cuff_segs
            f = bm.faces.new([back_center, cuff_rings[-1][j], cuff_rings[-1][nj]])
            f.material_index = 1

        # Gold Studs / Rivets along the cuff ring
        for j in range(0, cuff_segs, 2):
            stud_pos = cuff_rings[1][j].co + cuff_n * 0.004
            stud = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.006)
            for sv in stud['verts']:
                sv.co += stud_pos
                for sf in sv.link_faces:
                    sf.material_index = 2

        # Mirror across X if right hand
        if not is_left:
            for v in bm.verts:
                v.co.x = -v.co.x
            # Flip normals after mirror
            bmesh.ops.reverse_faces(bm, faces=bm.faces)

        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        mesh = bpy.data.meshes.new(f"Hand_{'Left' if is_left else 'Right'}_Mesh")
        bm.to_mesh(mesh)
        bm.free()
        return mesh

    # -------------------------------------------------------------------------
    # Helper: Build Privacy Shield / Mist Canopy Mesh
    # An elegant curved translucent shroud blocking 2 lateral sight lines
    # -------------------------------------------------------------------------
    def build_privacy_aura_mesh():
        bm = bmesh.new()
        # Create two arched wings flanking the card sides
        # Card width: 0.52 (X from -0.26 to +0.26), height: 0.78 (Y from -0.39 to +0.39)
        # Left wing: X from -0.27 to -0.18, Y from -0.30 to +0.28, Z from 0.00 to 0.14
        y_steps = 10
        arc_steps = 6

        for side in [-1, 1]:  # -1 = Left, +1 = Right
            wing_grid = []
            for iy in range(y_steps + 1):
                ty = iy / y_steps
                y_pos = -0.32 + ty * 0.62
                row = []
                for ia in range(arc_steps + 1):
                    ta = ia / arc_steps
                    # Radial arc curling forward around the card edge
                    ang = ta * (pi * 0.48)
                    x_pos = side * (0.265 - 0.075 * sin(ang))
                    z_pos = 0.01 + 0.14 * sin(ang)
                    row.append(bm.verts.new((x_pos, y_pos, z_pos)))
                wing_grid.append(row)

            for iy in range(y_steps):
                for ia in range(arc_steps):
                    v1 = wing_grid[iy][ia]
                    v2 = wing_grid[iy][ia+1]
                    v3 = wing_grid[iy+1][ia+1]
                    v4 = wing_grid[iy+1][ia]
                    if side == -1:
                        f = bm.faces.new([v1, v2, v3, v4])
                    else:
                        f = bm.faces.new([v1, v4, v3, v2])
                    f.material_index = 3

        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        mesh = bpy.data.meshes.new("Privacy_Aura_Mesh")
        bm.to_mesh(mesh)
        bm.free()
        return mesh

    # -------------------------------------------------------------------------
    # 2. Instantiate Objects & Hierarchy
    # -------------------------------------------------------------------------
    root_obj = bpy.data.objects.new("PrivacyHands", None)
    bpy.context.collection.objects.link(root_obj)

    # Hand Left
    mesh_left = build_hand_mesh(is_left=True)
    obj_left = bpy.data.objects.new("Hand_Left", mesh_left)
    obj_left.parent = root_obj
    bpy.context.collection.objects.link(obj_left)
    for mat in [mat_leather, mat_dark, mat_gold, mat_aura]:
        obj_left.data.materials.append(mat)

    # Hand Right
    mesh_right = build_hand_mesh(is_left=False)
    obj_right = bpy.data.objects.new("Hand_Right", mesh_right)
    obj_right.parent = root_obj
    bpy.context.collection.objects.link(obj_right)
    for mat in [mat_leather, mat_dark, mat_gold, mat_aura]:
        obj_right.data.materials.append(mat)

    # Privacy Aura / Shield
    mesh_aura = build_privacy_aura_mesh()
    obj_aura = bpy.data.objects.new("Privacy_Shield_Aura", mesh_aura)
    obj_aura.parent = root_obj
    bpy.context.collection.objects.link(obj_aura)
    for mat in [mat_leather, mat_dark, mat_gold, mat_aura]:
        obj_aura.data.materials.append(mat)

    # Smooth shading and subdivision modifiers for stylized beauty
    for obj in [obj_left, obj_right]:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_smooth()
        mod_sub = obj.modifiers.new("Subsurf", "SUBSURF")
        mod_sub.levels = 1
        mod_sub.render_levels = 1

    bpy.context.view_layer.objects.active = obj_aura
    bpy.ops.object.shade_smooth()

    # -------------------------------------------------------------------------
    # 3. Export GLB Files
    # -------------------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    root_obj.select_set(True)
    for child in root_obj.children:
        child.select_set(True)

    out_file = os.path.join(PUBLIC_MODELS, "PrivacyHands.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_file,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT'
    )
    print(f"Successfully generated and exported: {out_file}")

    # Also export copy as PrivacyShield.glb and CuppedHands.glb for flexibility
    shield_file = os.path.join(PUBLIC_MODELS, "PrivacyShield.glb")
    cupped_file = os.path.join(PUBLIC_MODELS, "CuppedHands.glb")
    import shutil
    shutil.copyfile(out_file, shield_file)
    shutil.copyfile(out_file, cupped_file)
    print(f"Copied alias to: {shield_file}")
    print(f"Copied alias to: {cupped_file}")

if __name__ == '__main__':
    create_privacy_hands_scene()
