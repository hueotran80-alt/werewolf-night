import bpy
import bmesh
import os
from math import pi, sin, cos

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_MODELS = os.path.join(PROJECT_ROOT, 'public', 'models')
PUBLIC_CARDS = os.path.join(PROJECT_ROOT, 'public', 'cards')

os.makedirs(PUBLIC_MODELS, exist_ok=True)

def create_card_object(name='RoleCard', front_texture_file='werewolf.png', back_texture_file='back.png'):
    bm = bmesh.new()
    w = 0.63
    h = 0.88
    t = 0.005
    r = 0.04
    segs = 8

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
            pts.append((cx + r * cos(ang), cy + r * sin(ang)))

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
        f.material_index = 1
        bot_faces.append(f)

    side_faces = []
    for i in range(n):
        next_i = (i + 1) % n
        f = bm.faces.new([top_verts[i], bot_verts[i], bot_verts[next_i], top_verts[next_i]])
        f.material_index = 2
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

    # Bevel top & bottom rim for subtle specular highlight
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = 0.0008
    mod.segments = 2
    mod.limit_method = 'ANGLE'
    mod.angle_limit = 0.5
    bpy.ops.object.modifier_apply(modifier='Bevel')
    bpy.ops.object.shade_smooth()

    # Create Material 0: Card_Front
    mat_front = bpy.data.materials.new(name=f'{name}_Front')
    mat_front.use_nodes = True
    bsdf_f = mat_front.node_tree.nodes.get('Principled BSDF')
    bsdf_f.inputs['Roughness'].default_value = 0.35
    bsdf_f.inputs['Metallic'].default_value = 0.05
    front_img_path = os.path.join(PUBLIC_CARDS, front_texture_file)
    if os.path.exists(front_img_path):
        img_f = bpy.data.images.load(front_img_path)
        tex_f = mat_front.node_tree.nodes.new(type='ShaderNodeTexImage')
        tex_f.image = img_f
        mat_front.node_tree.links.new(tex_f.outputs['Color'], bsdf_f.inputs['Base Color'])
    obj.data.materials.append(mat_front)

    # Create Material 1: Card_Back
    mat_back = bpy.data.materials.new(name=f'{name}_Back')
    mat_back.use_nodes = True
    bsdf_b = mat_back.node_tree.nodes.get('Principled BSDF')
    bsdf_b.inputs['Roughness'].default_value = 0.35
    bsdf_b.inputs['Metallic'].default_value = 0.15
    back_img_path = os.path.join(PUBLIC_CARDS, back_texture_file)
    if os.path.exists(back_img_path):
        img_b = bpy.data.images.load(back_img_path)
        tex_b = mat_back.node_tree.nodes.new(type='ShaderNodeTexImage')
        tex_b.image = img_b
        mat_back.node_tree.links.new(tex_b.outputs['Color'], bsdf_b.inputs['Base Color'])
    obj.data.materials.append(mat_back)

    # Create Material 2: Card_Edge (Gilded gold trim)
    mat_edge = bpy.data.materials.new(name=f'{name}_Edge')
    mat_edge.use_nodes = True
    bsdf_e = mat_edge.node_tree.nodes.get('Principled BSDF')
    bsdf_e.inputs['Base Color'].default_value = (0.85, 0.72, 0.35, 1.0)
    bsdf_e.inputs['Metallic'].default_value = 0.85
    bsdf_e.inputs['Roughness'].default_value = 0.28
    obj.data.materials.append(mat_edge)

    return obj

def export_single_card(out_filename, front_img, back_img='back.png'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obj = create_card_object('RoleCard', front_img, back_img)
    out_path = os.path.join(PUBLIC_MODELS, out_filename)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True
    )
    print(f'Exported card: {out_path}')

def export_card_deck(out_filename='RoleCard_Deck.glb'):
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Create a neat stack of 12 cards with slight rotation jitter for realism
    import random
    random.seed(42)

    deck_parent = bpy.data.objects.new('Card_Deck', None)
    bpy.context.collection.objects.link(deck_parent)

    num_cards = 14
    for idx in range(num_cards):
        # Top card can be face down (back showing)
        card_obj = create_card_object(f'Card_{idx}', 'werewolf.png', 'back.png')
        # Flip card so back is facing UP on the deck
        card_obj.rotation_euler = (pi, 0, (random.random() - 0.5) * 0.04)
        card_obj.location = (
            (random.random() - 0.5) * 0.003,
            (random.random() - 0.5) * 0.003,
            idx * 0.0052
        )
        card_obj.parent = deck_parent

    # Select all and join into one single optimized deck mesh
    bpy.ops.object.select_all(action='DESELECT')
    for child in deck_parent.children:
        child.select_set(True)
    bpy.context.view_layer.objects.active = deck_parent.children[0]
    bpy.ops.object.join()
    joined_mesh = bpy.context.active_object
    joined_mesh.name = 'Deck_Mesh'
    joined_mesh.parent = None
    bpy.data.objects.remove(deck_parent)

    out_path = os.path.join(PUBLIC_MODELS, out_filename)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True
    )
    print(f'Exported deck: {out_path}')

if __name__ == '__main__':
    # 1. Main RoleCard.glb (Ma Sói)
    export_single_card('RoleCard.glb', 'werewolf.png')
    # 2. Villager RoleCard
    export_single_card('RoleCard_Villager.glb', 'villager.png')
    # 3. Seer RoleCard
    export_single_card('RoleCard_Seer.glb', 'seer.png')
    # 4. RoleCard_Deck.glb
    export_card_deck('RoleCard_Deck.glb')
    print('All card models exported successfully!')
