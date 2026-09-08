"""Preflight de Blender: versión, CUDA, escena, recursos y rango."""
import json, sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from pipeline_common import assert_working_copy, load_config, review_frames

cfg=load_config(Path(sys.argv[sys.argv.index('--config')+1]))
phase=sys.argv[sys.argv.index('--fase')+1] if '--fase' in sys.argv else 'render'
errors=[]; warnings=[]; scene=bpy.context.scene
try: assert_working_copy(bpy.data.filepath)
except RuntimeError as exc: errors.append(str(exc))
required=tuple(map(int,cfg['blender']['version'].split('.')))
if bpy.app.version[:2]!=required: errors.append(f'Blender esperado {required}, detectado {bpy.app.version[:2]}')
if phase=='render' and (scene.frame_start,scene.frame_end)!=(cfg['video']['inicio'],cfg['video']['fin']): errors.append('Rango de escena distinto del YAML')
missing=[]
for image in bpy.data.images:
    if image.source=='FILE' and not image.packed_file and not Path(bpy.path.abspath(image.filepath)).is_file(): missing.append(image.name)
if missing: errors.append(f'{len(missing)} imágenes ausentes: {missing[:8]}')
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='CUDA'; prefs.refresh_devices()
    devices=[d.name for d in prefs.devices if d.type=='CUDA']
    if not devices: errors.append('CUDA no disponible')
except Exception as exc: errors.append('No se pudo comprobar CUDA: '+str(exc))
camera_frames=[]
collisions=[]
if phase=='render':
    for frame in review_frames(cfg):
        scene.frame_set(frame)
        if scene.camera is None: camera_frames.append(frame)
        elif scene.camera:
            point=scene.camera.matrix_world.translation
            for obj in scene.objects:
                if obj.type!='MESH' or obj.hide_render or any(k in obj.name.lower() for k in ('piso','techo','alero')): continue
                local=obj.matrix_world.inverted_safe()@point
                lo=Vector(tuple(min(c[i] for c in obj.bound_box) for i in range(3))); hi=Vector(tuple(max(c[i] for c in obj.bound_box) for i in range(3)))
                if all(lo[i]-.02<=local[i]<=hi[i]+.02 for i in range(3)): collisions.append({'frame':frame,'objeto':obj.name})
if camera_frames: errors.append(f'Sin cámara activa: {camera_frames}')
if collisions: errors.append(f'Cámaras dentro de geometría: {collisions[:8]}')
report={'ok':not errors,'blender':bpy.app.version_string,'archivo':bpy.data.filepath,'cuda':devices if 'devices' in locals() else [],'errores':errors,'avisos':warnings}
print('PREFLIGHT='+json.dumps(report,ensure_ascii=False))
if errors: raise RuntimeError('; '.join(errors))
