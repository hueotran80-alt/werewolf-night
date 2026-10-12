import bpy
import os
import sys

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_MODELS = os.path.join(PROJECT_ROOT, 'public', 'models')
sys.path.append(os.path.dirname(__file__))

from test_card_anims import create_sit_floor_hold_card_action, create_sit_floor_place_down_action

CHARACTERS = ['Knight.glb', 'Mage.glb', 'Rogue.glb', 'Soldier.glb']

def inject_animations(char_filename):
    char_path = os.path.join(PUBLIC_MODELS, char_filename)
    if not os.path.exists(char_path):
        print(f'File {char_path} not found, skipping.')
        return

    print(f'Processing {char_filename}...')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=char_path)

    rig = bpy.data.objects.get('Rig')
    if not rig:
        print(f'No Rig object found in {char_filename}, skipping.')
        return

    # Add Sit_Floor_Hold_Card and Sit_Floor_Place_Down
    create_sit_floor_hold_card_action(rig)
    create_sit_floor_place_down_action(rig)

    # Ensure all actions have fake users
    for a in bpy.data.actions:
        a.use_fake_user = True

    # Export back
    bpy.ops.export_scene.gltf(
        filepath=char_path,
        export_format='GLB',
        export_materials='EXPORT',
        export_animations=True,
        export_apply=False
    )
    print(f'Successfully updated {char_filename}!')

if __name__ == '__main__':
    for c in CHARACTERS:
        inject_animations(c)
    print('All player characters updated with card sitting animations!')
