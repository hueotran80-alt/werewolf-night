import bpy
import bmesh
import os
from mathutils import Quaternion, Vector, Euler
from math import sin, cos, pi, radians

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_MODELS = os.path.join(PROJECT_ROOT, 'public', 'models')
PUBLIC_CARDS = os.path.join(PROJECT_ROOT, 'public', 'cards')
import sys
sys.path.append(os.path.dirname(__file__))

def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)

def create_mini_deck_mesh(name='Dealer_Deck'):
    # Dimensions: 0.10m x 0.14m x 0.03m (realistic card deck in hand)
    bm = bmesh.new()
    w = 0.10
    h = 0.14
    t = 0.03
    r = 0.012
    segs = 6

    corners = [
        (w/2 - r, h/2 - r, 0),
        (-w/2 + r, h/2 - r, pi/2),
        (-w/2 + r, -h/2 + r, pi),
        (w/2 - r, -h/2 + r, 3*pi/2),
    ]

    pts = []
    for cx, cy, start_angle in corners:
        for i in range(segs):
            ang = start_angle + (pi/2) * (i / segs)
            pts.append((cx + r * sin(ang), cy + r * cos(ang)))

    n = len(pts)
    top_verts = [bm.verts.new((x, y, t/2)) for x, y in pts]
    bot_verts = [bm.verts.new((x, y, -t/2)) for x, y in pts]
    top_center = bm.verts.new((0, 0, t/2))
    bot_center = bm.verts.new((0, 0, -t/2))

    top_faces = []
    for i in range(n):
        next_i = (i + 1) % n
        f = bm.faces.new([top_center, top_verts[i], top_verts[next_i]])
        f.material_index = 0
        top_faces.append(f)

    bot_faces = []
    for i in range(n):
        next_i = (i + 1) % n
        f = bm.faces.new([bot_center, bot_verts[next_i], bot_verts[i]])
        f.material_index = 0
        bot_faces.append(f)

    side_faces = []
    for i in range(n):
        next_i = (i + 1) % n
        f = bm.faces.new([top_verts[i], bot_verts[i], bot_verts[next_i], top_verts[next_i]])
        f.material_index = 1
        side_faces.append(f)

    uv_layer = bm.loops.layers.uv.verify()
    for f in top_faces:
        for loop in f.loops:
            loop[uv_layer].uv = ((loop.vert.co.x + w/2)/w, (loop.vert.co.y + h/2)/h)

    for f in bot_faces:
        for loop in f.loops:
            loop[uv_layer].uv = ((-loop.vert.co.x + w/2)/w, (loop.vert.co.y + h/2)/h)

    for f in side_faces:
        for loop in f.loops:
            loop[uv_layer].uv = (0.5, 0.5)

    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Bevel
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.002
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier='Bevel')
    bpy.ops.object.shade_smooth()

    # Deck Back Material
    mat_back = bpy.data.materials.new(name=f'{name}_Back')
    mat_back.use_nodes = True
    bsdf_b = mat_back.node_tree.nodes.get('Principled BSDF')
    bsdf_b.inputs['Roughness'].default_value = 0.35
    bsdf_b.inputs['Metallic'].default_value = 0.15
    back_img_path = os.path.join(PUBLIC_CARDS, 'back.png')
    if os.path.exists(back_img_path):
        img_b = bpy.data.images.load(back_img_path)
        tex_b = mat_back.node_tree.nodes.new(type='ShaderNodeTexImage')
        tex_b.image = img_b
        mat_back.node_tree.links.new(tex_b.outputs['Color'], bsdf_b.inputs['Base Color'])
    obj.data.materials.append(mat_back)

    # Deck Side Rim (Gold edge)
    mat_edge = bpy.data.materials.new(name=f'{name}_Edge')
    mat_edge.use_nodes = True
    bsdf_e = mat_edge.node_tree.nodes.get('Principled BSDF')
    bsdf_e.inputs['Base Color'].default_value = (0.85, 0.72, 0.35, 1.0)
    bsdf_e.inputs['Metallic'].default_value = 0.8
    bsdf_e.inputs['Roughness'].default_value = 0.3
    obj.data.materials.append(mat_edge)

    return obj

def build_animations_for_dealer(rig):
    idle_act = bpy.data.actions['Idle']
    sit_idle_act = bpy.data.actions.get('Sit_Floor_Idle')

    # -------------------------------------------------------------
    # 1. Dealer_Idle
    # -------------------------------------------------------------
    dealer_idle = bpy.data.actions.new('Dealer_Idle')
    dealer_idle.use_fake_user = True
    total_frames = 60

    for frame in range(total_frames + 1):
        bpy.context.scene.frame_set(frame % int(idle_act.frame_range[1]))
        breath = sin(frame / total_frames * 2 * pi)
        rig.animation_data.action = dealer_idle

        # Lower body from Idle
        for pb_name in ['root', 'hips', 'upperleg.l', 'lowerleg.l', 'foot.l', 'toes.l',
                        'upperleg.r', 'lowerleg.r', 'foot.r', 'toes.r',
                        'kneeIK.l', 'kneeIK.r', 'IK-foot.l', 'IK-foot.r',
                        'control-foot-roll.l', 'control-foot-roll.r',
                        'control-toe-roll.l', 'control-toe-roll.r',
                        'control-heel-roll.l', 'control-heel-roll.r']:
            pb = rig.pose.bones.get(pb_name)
            if pb:
                pb.keyframe_insert('location', frame=frame)
                pb.keyframe_insert('rotation_quaternion', frame=frame)
                pb.keyframe_insert('scale', frame=frame)

        pb_spine = rig.pose.bones.get('spine')
        if pb_spine:
            pb_spine.rotation_quaternion = Quaternion((0.999, 0.0, 0.03, 0.0))
            pb_spine.keyframe_insert('rotation_quaternion', frame=frame)

        pb_chest = rig.pose.bones.get('chest')
        if pb_chest:
            pb_chest.rotation_quaternion = Quaternion((0.999, 0.01 + breath * 0.015, 0.0, 0.0))
            pb_chest.keyframe_insert('rotation_quaternion', frame=frame)

        pb_head = rig.pose.bones.get('head')
        if pb_head:
            pb_head.rotation_quaternion = Quaternion((0.998, 0.05 + breath * 0.01, 0.0, 0.0))
            pb_head.keyframe_insert('rotation_quaternion', frame=frame)

        # Left arm holds deck at waist
        pb_ua_l = rig.pose.bones.get('upperarm.l')
        if pb_ua_l:
            pb_ua_l.rotation_quaternion = Quaternion((0.789, -0.227, 0.481, 0.308))
            pb_ua_l.keyframe_insert('rotation_quaternion', frame=frame)

        pb_la_l = rig.pose.bones.get('lowerarm.l')
        if pb_la_l:
            pb_la_l.rotation_quaternion = Quaternion((0.857, 0.0, 0.0, -0.515))
            pb_la_l.keyframe_insert('rotation_quaternion', frame=frame)

        pb_h_l = rig.pose.bones.get('hand.l')
        if pb_h_l:
            pb_h_l.rotation_quaternion = Quaternion((0.908, -0.195, -0.345, 0.137))
            pb_h_l.keyframe_insert('rotation_quaternion', frame=frame)

        # Right arm relaxed
        pb_ua_r = rig.pose.bones.get('upperarm.r')
        if pb_ua_r:
            pb_ua_r.rotation_quaternion = Quaternion((0.950, -0.200 + breath * 0.01, -0.150, -0.100))
            pb_ua_r.keyframe_insert('rotation_quaternion', frame=frame)

        pb_la_r = rig.pose.bones.get('lowerarm.r')
        if pb_la_r:
            pb_la_r.rotation_quaternion = Quaternion((0.950, 0.0, 0.0, 0.300 + breath * 0.01))
            pb_la_r.keyframe_insert('rotation_quaternion', frame=frame)

        pb_h_r = rig.pose.bones.get('hand.r')
        if pb_h_r:
            pb_h_r.rotation_quaternion = Quaternion((0.898, -0.252, 0.144, -0.330))
            pb_h_r.keyframe_insert('rotation_quaternion', frame=frame)

        rig.animation_data.action = idle_act

    # -------------------------------------------------------------
    # 2. Deal_Cards
    # -------------------------------------------------------------
    deal_cards = bpy.data.actions.new('Deal_Cards')
    deal_cards.use_fake_user = True
    total_frames = 60

    # Key poses for right arm
    # Draw from deck pose (reaches over to left hand deck)
    draw_ua_r = Quaternion((0.948, -0.307, 0.080, -0.030)) @ Euler((radians(-15), radians(-10), radians(20))).to_quaternion()
    draw_la_r = Quaternion((0.800, 0.0, 0.0, 0.600)) @ Euler((0, 0, radians(15))).to_quaternion()
    draw_h_r = Quaternion((0.841, -0.315, 0.348, 0.271))

    # Flick / Deal forward pose (arm sweeps forward towards player)
    flick_ua_r = Quaternion((0.997, -0.056, 0.043, -0.016)) @ Euler((radians(-20), radians(15), radians(-10))).to_quaternion()
    flick_la_r = Quaternion((0.829, 0.0, 0.0, 0.559)) @ Euler((0, 0, radians(-20))).to_quaternion()
    flick_h_r = Quaternion((0.785, -0.082, 0.587, 0.182)) @ Euler((radians(30), radians(-20), radians(15))).to_quaternion()

    # Follow-through flourish pose
    flourish_ua_r = Quaternion((0.950, -0.150, -0.100, -0.120)) @ Euler((radians(10), radians(25), radians(-15))).to_quaternion()
    flourish_la_r = Quaternion((0.900, 0.0, 0.0, 0.400))
    flourish_h_r = Quaternion((0.850, -0.150, 0.200, -0.200))

    # Return pose
    return_ua_r = Quaternion((0.950, -0.200, -0.150, -0.100))
    return_la_r = Quaternion((0.950, 0.0, 0.0, 0.300))
    return_h_r = Quaternion((0.898, -0.252, 0.144, -0.330))

    for frame in range(total_frames + 1):
        bpy.context.scene.frame_set(frame % int(idle_act.frame_range[1]))
        rig.animation_data.action = deal_cards

        # Lower body from Idle
        for pb_name in ['root', 'hips', 'upperleg.l', 'lowerleg.l', 'foot.l', 'toes.l',
                        'upperleg.r', 'lowerleg.r', 'foot.r', 'toes.r',
                        'kneeIK.l', 'kneeIK.r', 'IK-foot.l', 'IK-foot.r',
                        'control-foot-roll.l', 'control-foot-roll.r',
                        'control-toe-roll.l', 'control-toe-roll.r',
                        'control-heel-roll.l', 'control-heel-roll.r']:
            pb = rig.pose.bones.get(pb_name)
            if pb:
                pb.keyframe_insert('location', frame=frame)
                pb.keyframe_insert('rotation_quaternion', frame=frame)
                pb.keyframe_insert('scale', frame=frame)

        # Left arm holding deck steady
        pb_ua_l = rig.pose.bones.get('upperarm.l')
        if pb_ua_l:
            pb_ua_l.rotation_quaternion = Quaternion((0.789, -0.227, 0.481, 0.308))
            pb_ua_l.keyframe_insert('rotation_quaternion', frame=frame)

        pb_la_l = rig.pose.bones.get('lowerarm.l')
        if pb_la_l:
            pb_la_l.rotation_quaternion = Quaternion((0.857, 0.0, 0.0, -0.515))
            pb_la_l.keyframe_insert('rotation_quaternion', frame=frame)

        pb_h_l = rig.pose.bones.get('hand.l')
        if pb_h_l:
            pb_h_l.rotation_quaternion = Quaternion((0.908, -0.195, -0.345, 0.137))
            pb_h_l.keyframe_insert('rotation_quaternion', frame=frame)

        # Right arm 4-phase sequence
        if frame <= 14:
            # Phase 1: Draw from deck
            t = smoothstep(0, 14, frame)
            cur_ua_r = return_ua_r.slerp(draw_ua_r, t)
            cur_la_r = return_la_r.slerp(draw_la_r, t)
            cur_h_r = return_h_r.slerp(draw_h_r, t)
            head_pitch = radians(8 * t)
            chest_yaw = radians(-5 * t)
        elif frame <= 28:
            # Phase 2: Swing & Deal flick
            t = smoothstep(14, 28, frame)
            cur_ua_r = draw_ua_r.slerp(flick_ua_r, t)
            cur_la_r = draw_la_r.slerp(flick_la_r, t)
            cur_h_r = draw_h_r.slerp(flick_h_r, t)
            head_pitch = radians(8 - 14 * t)
            chest_yaw = radians(-5 + 12 * t)
        elif frame <= 42:
            # Phase 3: Flourish follow-through
            t = smoothstep(28, 42, frame)
            cur_ua_r = flick_ua_r.slerp(flourish_ua_r, t)
            cur_la_r = flick_la_r.slerp(flourish_la_r, t)
            cur_h_r = flick_h_r.slerp(flourish_h_r, t)
            head_pitch = radians(-6 + 6 * t)
            chest_yaw = radians(7 - 7 * t)
        else:
            # Phase 4: Return to deck
            t = smoothstep(42, 60, frame)
            cur_ua_r = flourish_ua_r.slerp(return_ua_r, t)
            cur_la_r = flourish_la_r.slerp(return_la_r, t)
            cur_h_r = flourish_h_r.slerp(return_h_r, t)
            head_pitch = 0.0
            chest_yaw = 0.0

        pb_spine = rig.pose.bones.get('spine')
        if pb_spine:
            pb_spine.rotation_quaternion = Quaternion((0.999, 0.0, 0.03, 0.0))
            pb_spine.keyframe_insert('rotation_quaternion', frame=frame)

        pb_chest = rig.pose.bones.get('chest')
        if pb_chest:
            pb_chest.rotation_quaternion = Quaternion((0.999, 0.01, 0.0, 0.0)) @ Euler((0, chest_yaw, 0)).to_quaternion()
            pb_chest.keyframe_insert('rotation_quaternion', frame=frame)

        pb_head = rig.pose.bones.get('head')
        if pb_head:
            pb_head.rotation_quaternion = Quaternion((0.998, 0.05, 0.0, 0.0)) @ Euler((head_pitch, 0, 0)).to_quaternion()
            pb_head.keyframe_insert('rotation_quaternion', frame=frame)

        for b, q in [('upperarm.r', cur_ua_r), ('lowerarm.r', cur_la_r), ('hand.r', cur_h_r)]:
            pb = rig.pose.bones.get(b)
            if pb:
                pb.rotation_quaternion = q
                pb.keyframe_insert('rotation_quaternion', frame=frame)

        rig.animation_data.action = idle_act

    # -------------------------------------------------------------
    # 3. Give_Card (Presenting card forward)
    # -------------------------------------------------------------
    give_card = bpy.data.actions.new('Give_Card')
    give_card.use_fake_user = True
    total_frames = 60

    present_ua_r = Quaternion((0.997, -0.056, 0.043, -0.016)) @ Euler((radians(-15), radians(10), 0)).to_quaternion()
    present_la_r = Quaternion((0.829, 0.0, 0.0, 0.559)) @ Euler((0, 0, radians(-10))).to_quaternion()
    present_h_r = Quaternion((0.785, -0.082, 0.587, 0.182)) @ Euler((radians(20), 0, 0)).to_quaternion()

    for frame in range(total_frames + 1):
        bpy.context.scene.frame_set(frame % int(idle_act.frame_range[1]))
        rig.animation_data.action = give_card

        # Lower body
        for pb_name in ['root', 'hips', 'upperleg.l', 'lowerleg.l', 'foot.l', 'toes.l',
                        'upperleg.r', 'lowerleg.r', 'foot.r', 'toes.r',
                        'kneeIK.l', 'kneeIK.r', 'IK-foot.l', 'IK-foot.r',
                        'control-foot-roll.l', 'control-foot-roll.r',
                        'control-toe-roll.l', 'control-toe-roll.r',
                        'control-heel-roll.l', 'control-heel-roll.r']:
            pb = rig.pose.bones.get(pb_name)
            if pb:
                pb.keyframe_insert('location', frame=frame)
                pb.keyframe_insert('rotation_quaternion', frame=frame)
                pb.keyframe_insert('scale', frame=frame)

        # Left arm holds deck
        pb_ua_l = rig.pose.bones.get('upperarm.l')
        if pb_ua_l:
            pb_ua_l.rotation_quaternion = Quaternion((0.789, -0.227, 0.481, 0.308))
            pb_ua_l.keyframe_insert('rotation_quaternion', frame=frame)

        pb_la_l = rig.pose.bones.get('lowerarm.l')
        if pb_la_l:
            pb_la_l.rotation_quaternion = Quaternion((0.857, 0.0, 0.0, -0.515))
            pb_la_l.keyframe_insert('rotation_quaternion', frame=frame)

        pb_h_l = rig.pose.bones.get('hand.l')
        if pb_h_l:
            pb_h_l.rotation_quaternion = Quaternion((0.908, -0.195, -0.345, 0.137))
            pb_h_l.keyframe_insert('rotation_quaternion', frame=frame)

        if frame <= 18:
            t = smoothstep(0, 18, frame)
            cur_ua_r = return_ua_r.slerp(present_ua_r, t)
            cur_la_r = return_la_r.slerp(present_la_r, t)
            cur_h_r = return_h_r.slerp(present_h_r, t)
        elif frame <= 38:
            cur_ua_r = present_ua_r
            cur_la_r = present_la_r
            cur_h_r = present_h_r
        else:
            t = smoothstep(38, 60, frame)
            cur_ua_r = present_ua_r.slerp(return_ua_r, t)
            cur_la_r = present_la_r.slerp(return_la_r, t)
            cur_h_r = present_h_r.slerp(return_h_r, t)

        for b, q in [('upperarm.r', cur_ua_r), ('lowerarm.r', cur_la_r), ('hand.r', cur_h_r)]:
            pb = rig.pose.bones.get(b)
            if pb:
                pb.rotation_quaternion = q
                pb.keyframe_insert('rotation_quaternion', frame=frame)

        rig.animation_data.action = idle_act

    print('Dealer animations created: Dealer_Idle, Deal_Cards, Give_Card')

def build_sit_card_actions(rig):
    from test_card_anims import create_sit_floor_hold_card_action, create_sit_floor_place_down_action
    create_sit_floor_hold_card_action(rig)
    create_sit_floor_place_down_action(rig)

def export_dealer_host():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mage_path = os.path.join(PUBLIC_MODELS, 'Mage.glb')
    bpy.ops.import_scene.gltf(filepath=mage_path)
    rig = bpy.data.objects['Rig']

    # Remove weapon objects
    for item_name in ['1H_Wand', '2H_Staff', 'Spellbook', 'Spellbook_open']:
        item = bpy.data.objects.get(item_name)
        if item:
            bpy.data.objects.remove(item, do_unlink=True)

    # Attach mini deck to handslot.l
    deck_obj = create_mini_deck_mesh('Dealer_Deck')
    deck_obj.parent = rig
    deck_obj.parent_type = 'BONE'
    deck_obj.parent_bone = 'handslot.l'
    # Orient deck flat in palm
    deck_obj.rotation_euler = (radians(90), 0, radians(90))
    deck_obj.location = (0.02, -0.04, 0.02)

    # Add dealer and sitting card animations
    build_animations_for_dealer(rig)
    build_sit_card_actions(rig)

    # Ensure all actions have fake users so glTF exporter retains all of them
    for a in bpy.data.actions:
        a.use_fake_user = True

    # Set default action to Dealer_Idle
    dealer_idle = bpy.data.actions.get('Dealer_Idle')
    if dealer_idle:
        rig.animation_data.action = dealer_idle

    out_path = os.path.join(PUBLIC_MODELS, 'Dealer_Host.glb')
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_animations=True,
        export_apply=False
    )
    print(f'Dealer_Host.glb successfully exported to {out_path}!')

if __name__ == '__main__':
    export_dealer_host()
