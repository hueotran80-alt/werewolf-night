import bpy
from mathutils import Quaternion, Vector, Euler
from math import sin, pi, radians

def create_sit_floor_hold_card_action(rig):
    act_name = 'Sit_Floor_Hold_Card'
    if act_name in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions[act_name])

    new_act = bpy.data.actions.new(act_name)
    new_act.use_fake_user = True

    # Base pose from Sit_Floor_Idle
    sit_idle = bpy.data.actions.get('Sit_Floor_Idle')
    rig.animation_data.action = sit_idle

    # Sample Sit_Floor_Idle base tracks
    total_frames = 60
    fps = 30

    # We build 60 frames (2.0s smooth loop)
    for frame in range(total_frames + 1):
        bpy.context.scene.frame_set(frame % int(sit_idle.frame_range[1]))

        # Idle breathing cycle (sine wave)
        breath = sin(frame / total_frames * 2 * pi)

        rig.animation_data.action = new_act

        # 1. Hips, legs, feet remain grounded in sit pose
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

        # 2. Spine & Chest: slight forward attention + subtle breathing
        pb_spine = rig.pose.bones.get('spine')
        if pb_spine:
            pb_spine.rotation_quaternion = Quaternion((0.985, 0.03, 0.16, 0.005))
            pb_spine.keyframe_insert('rotation_quaternion', frame=frame)
            pb_spine.keyframe_insert('location', frame=frame)

        pb_chest = rig.pose.bones.get('chest')
        if pb_chest:
            # Subtle breath pitch
            chest_pitch = radians(4 + breath * 1.5)
            pb_chest.rotation_quaternion = Quaternion((0.985, 0.08, -0.14, -0.02)) @ Euler((chest_pitch, 0, 0)).to_quaternion()
            pb_chest.keyframe_insert('rotation_quaternion', frame=frame)
            pb_chest.keyframe_insert('location', frame=frame)

        # 3. Head: tilted down 18 deg looking at card held in hands
        pb_head = rig.pose.bones.get('head')
        if pb_head:
            head_nod = radians(-18 + breath * 0.8)
            pb_head.rotation_quaternion = Quaternion((0.98, 0.08, -0.15, 0.04)) @ Euler((head_nod, 0, 0)).to_quaternion()
            pb_head.keyframe_insert('rotation_quaternion', frame=frame)
            pb_head.keyframe_insert('location', frame=frame)

        # 4. Arms & Hands: Holding card up at chest height
        # Left arm
        pb_ua_l = rig.pose.bones.get('upperarm.l')
        if pb_ua_l:
            pb_ua_l.rotation_quaternion = Quaternion((0.789, -0.227, 0.481, 0.308)) @ Euler((radians(-5), radians(5), radians(-10))).to_quaternion()
            pb_ua_l.keyframe_insert('rotation_quaternion', frame=frame)
            pb_ua_l.keyframe_insert('location', frame=frame)

        pb_la_l = rig.pose.bones.get('lowerarm.l')
        if pb_la_l:
            pb_la_l.rotation_quaternion = Quaternion((0.857, 0.0, 0.0, -0.515)) @ Euler((0, 0, radians(-15))).to_quaternion()
            pb_la_l.keyframe_insert('rotation_quaternion', frame=frame)
            pb_la_l.keyframe_insert('location', frame=frame)

        pb_h_l = rig.pose.bones.get('hand.l')
        if pb_h_l:
            pb_h_l.rotation_quaternion = Quaternion((0.908, -0.195, -0.345, 0.137))
            pb_h_l.keyframe_insert('rotation_quaternion', frame=frame)
            pb_h_l.keyframe_insert('location', frame=frame)

        # Right arm
        pb_ua_r = rig.pose.bones.get('upperarm.r')
        if pb_ua_r:
            pb_ua_r.rotation_quaternion = Quaternion((0.948, -0.307, 0.080, -0.030)) @ Euler((radians(-5), radians(-5), radians(10))).to_quaternion()
            pb_ua_r.keyframe_insert('rotation_quaternion', frame=frame)
            pb_ua_r.keyframe_insert('location', frame=frame)

        pb_la_r = rig.pose.bones.get('lowerarm.r')
        if pb_la_r:
            pb_la_r.rotation_quaternion = Quaternion((0.800, 0.0, 0.0, 0.600)) @ Euler((0, 0, radians(15))).to_quaternion()
            pb_la_r.keyframe_insert('rotation_quaternion', frame=frame)
            pb_la_r.keyframe_insert('location', frame=frame)

        pb_h_r = rig.pose.bones.get('hand.r')
        if pb_h_r:
            pb_h_r.rotation_quaternion = Quaternion((0.841, -0.315, 0.348, 0.271))
            pb_h_r.keyframe_insert('rotation_quaternion', frame=frame)
            pb_h_r.keyframe_insert('location', frame=frame)

        # Switch back to sample next frame of Sit_Floor_Idle
        rig.animation_data.action = sit_idle

    rig.animation_data.action = new_act
    print(f'Successfully created action {act_name} with {len(new_act.fcurves)} fcurves.')
    return new_act

def create_sit_floor_place_down_action(rig):
    act_name = 'Sit_Floor_Place_Down'
    if act_name in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions[act_name])

    new_act = bpy.data.actions.new(act_name)
    new_act.use_fake_user = True

    sit_idle = bpy.data.actions.get('Sit_Floor_Idle')
    rig.animation_data.action = sit_idle

    total_frames = 60

    # 4 Phases:
    # 0-15: Holding card
    # 15-32: Leaning down, hands reach to grass
    # 32-42: Placing card flat on ground
    # 42-60: Sitting back up into Sit_Floor_Idle

    hold_chest = Quaternion((0.985, 0.08, -0.14, -0.02)) @ Euler((radians(5), 0, 0)).to_quaternion()
    down_chest = Quaternion((0.985, 0.08, -0.14, -0.02)) @ Euler((radians(28), 0, 0)).to_quaternion()
    idle_chest = Quaternion((0.9852, 0.088, -0.145, -0.025))

    hold_head = Quaternion((0.98, 0.08, -0.15, 0.04)) @ Euler((radians(-18), 0, 0)).to_quaternion()
    down_head = Quaternion((0.98, 0.08, -0.15, 0.04)) @ Euler((radians(-28), 0, 0)).to_quaternion()
    idle_head = Quaternion((0.9956, 0.0786, -0.0204, 0.0468))

    # Hold arm quats
    hold_ua_l = Quaternion((0.789, -0.227, 0.481, 0.308)) @ Euler((radians(-5), radians(5), radians(-10))).to_quaternion()
    hold_la_l = Quaternion((0.857, 0.0, 0.0, -0.515)) @ Euler((0, 0, radians(-15))).to_quaternion()
    hold_h_l = Quaternion((0.908, -0.195, -0.345, 0.137))

    hold_ua_r = Quaternion((0.948, -0.307, 0.080, -0.030)) @ Euler((radians(-5), radians(-5), radians(10))).to_quaternion()
    hold_la_r = Quaternion((0.800, 0.0, 0.0, 0.600)) @ Euler((0, 0, radians(15))).to_quaternion()
    hold_h_r = Quaternion((0.841, -0.315, 0.348, 0.271))

    # Down / reach grass arm quats
    down_ua_l = Quaternion((0.937, -0.320, 0.125, 0.063)) @ Euler((radians(-35), radians(10), radians(-20))).to_quaternion()
    down_la_l = Quaternion((0.978, 0.0, 0.0, -0.209)) @ Euler((0, 0, radians(-25))).to_quaternion()
    down_h_l = Quaternion((0.883, -0.144, -0.286, -0.343)) @ Euler((radians(35), 0, radians(15))).to_quaternion()

    down_ua_r = Quaternion((0.873, -0.443, -0.061, -0.194)) @ Euler((radians(-35), radians(-10), radians(20))).to_quaternion()
    down_la_r = Quaternion((0.869, 0.0, 0.0, 0.494)) @ Euler((0, 0, radians(25))).to_quaternion()
    down_h_r = Quaternion((0.935, -0.066, 0.348, 0.018)) @ Euler((radians(35), 0, radians(-15))).to_quaternion()

    # Idle arm quats
    idle_ua_l = Quaternion((0.812, -0.336, 0.410, 0.243))
    idle_la_l = Quaternion((0.841, 0.0, 0.0, -0.541))
    idle_h_l = Quaternion((0.671, 0.485, -0.207, 0.522))

    idle_ua_r = Quaternion((0.890, -0.409, -0.177, -0.096))
    idle_la_r = Quaternion((0.905, 0.0, 0.0, 0.425))
    idle_h_r = Quaternion((0.898, -0.252, 0.144, -0.330))

    def smoothstep(edge0, edge1, x):
        t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
        return t * t * (3.0 - 2.0 * t)

    for frame in range(total_frames + 1):
        bpy.context.scene.frame_set(frame % int(sit_idle.frame_range[1]))

        rig.animation_data.action = new_act

        # Grounded lower body
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

        # Interpolate spine, chest, head, arms based on phase
        if frame <= 12:
            t = 0.0
            cur_chest = hold_chest
            cur_head = hold_head
            cur_ua_l, cur_la_l, cur_h_l = hold_ua_l, hold_la_l, hold_h_l
            cur_ua_r, cur_la_r, cur_h_r = hold_ua_r, hold_la_r, hold_h_r
        elif frame <= 30:
            t = smoothstep(12, 30, frame)
            cur_chest = hold_chest.slerp(down_chest, t)
            cur_head = hold_head.slerp(down_head, t)
            cur_ua_l = hold_ua_l.slerp(down_ua_l, t)
            cur_la_l = hold_la_l.slerp(down_la_l, t)
            cur_h_l = hold_h_l.slerp(down_h_l, t)
            cur_ua_r = hold_ua_r.slerp(down_ua_r, t)
            cur_la_r = hold_la_r.slerp(down_la_r, t)
            cur_h_r = hold_h_r.slerp(down_h_r, t)
        elif frame <= 42:
            # Holding on the grass
            cur_chest = down_chest
            cur_head = down_head
            cur_ua_l, cur_la_l, cur_h_l = down_ua_l, down_la_l, down_h_l
            cur_ua_r, cur_la_r, cur_h_r = down_ua_r, down_la_r, down_h_r
        else:
            # Retracting back to Sit_Floor_Idle
            t = smoothstep(42, 60, frame)
            cur_chest = down_chest.slerp(idle_chest, t)
            cur_head = down_head.slerp(idle_head, t)
            cur_ua_l = down_ua_l.slerp(idle_ua_l, t)
            cur_la_l = down_la_l.slerp(idle_la_l, t)
            cur_h_l = down_h_l.slerp(idle_h_l, t)
            cur_ua_r = down_ua_r.slerp(idle_ua_r, t)
            cur_la_r = down_la_r.slerp(idle_la_r, t)
            cur_h_r = down_h_r.slerp(idle_h_r, t)

        pb_chest = rig.pose.bones.get('chest')
        if pb_chest:
            pb_chest.rotation_quaternion = cur_chest
            pb_chest.keyframe_insert('rotation_quaternion', frame=frame)
            pb_chest.keyframe_insert('location', frame=frame)

        pb_head = rig.pose.bones.get('head')
        if pb_head:
            pb_head.rotation_quaternion = cur_head
            pb_head.keyframe_insert('rotation_quaternion', frame=frame)
            pb_head.keyframe_insert('location', frame=frame)

        pb_spine = rig.pose.bones.get('spine')
        if pb_spine:
            pb_spine.rotation_quaternion = Quaternion((0.985, 0.03, 0.16, 0.005))
            pb_spine.keyframe_insert('rotation_quaternion', frame=frame)
            pb_spine.keyframe_insert('location', frame=frame)

        for b, q in [('upperarm.l', cur_ua_l), ('lowerarm.l', cur_la_l), ('hand.l', cur_h_l),
                     ('upperarm.r', cur_ua_r), ('lowerarm.r', cur_la_r), ('hand.r', cur_h_r)]:
            pb = rig.pose.bones.get(b)
            if pb:
                pb.rotation_quaternion = q
                pb.keyframe_insert('rotation_quaternion', frame=frame)
                pb.keyframe_insert('location', frame=frame)

        rig.animation_data.action = sit_idle

    rig.animation_data.action = new_act
    print(f'Successfully created action {act_name} with {len(new_act.fcurves)} fcurves.')
    return new_act

if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath='public/models/Knight.glb')
    rig = bpy.data.objects['Rig']
    act1 = create_sit_floor_hold_card_action(rig)
    act2 = create_sit_floor_place_down_action(rig)
    print('Testing card actions completed successfully!')
