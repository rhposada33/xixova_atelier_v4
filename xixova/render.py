"""Render atómico reanudable: solo Blender; no altera la escena guardada."""
import argparse
import json
import os
import struct
import sys
import time
from pathlib import Path
import bpy

def png_ok(path,w,h):
    try:
        data=path.read_bytes()
        return len(data)>100 and data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(w,h) and data[-12:]==b'\x00\x00\x00\x00IEND\xaeB`\x82'
    except OSError:return False

p=argparse.ArgumentParser(); p.add_argument('--datos',required=True); p.add_argument('--salida',required=True); p.add_argument('--perfil',required=True); p.add_argument('--frames',default='')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); data=json.loads(Path(a.datos).read_text()); profile=data['proyecto']['produccion']['perfiles'][a.perfil]
scene=bpy.context.scene; engine=profile.get('motor','CYCLES'); scene.render.engine=engine
scene.render.use_persistent_data=engine=='CYCLES'; w,h=profile['resolucion']; scene.render.resolution_x=w; scene.render.resolution_y=h; scene.render.resolution_percentage=100
out=Path(a.salida); out.mkdir(parents=True,exist_ok=True); frames=list(map(int,a.frames.split(','))) if a.frames else range(scene.frame_start,scene.frame_end+1)
# Device preferences are per process, not stored in the .blend.
if engine=='CYCLES':
    scene.cycles.samples=profile['muestras']; scene.cycles.use_denoising=profile.get('denoise',True)
    scene.cycles.use_adaptive_sampling=True; scene.cycles.adaptive_threshold=profile.get('umbral_adaptativo',.03)
    scene.cycles.max_bounces=profile.get('max_rebotes',8); scene.cycles.diffuse_bounces=profile.get('rebotes_difusos',3)
    scene.cycles.glossy_bounces=profile.get('rebotes_brillantes',3); scene.cycles.transmission_bounces=profile.get('rebotes_transmision',6)
    scene.cycles.volume_bounces=0; scene.cycles.sample_clamp_indirect=profile.get('clamp_indirecto',8)
    bpy.context.view_layer.cycles.use_denoising=profile.get('denoise',True)
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='CUDA'; prefs.get_devices()
        for device in prefs.devices: device.use=device.type=='CUDA'
        scene.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
    except Exception: scene.cycles.device='CPU'
else:
    scene.display.shading.light='STUDIO'; scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True; scene.display.shading.color_type='MATERIAL'
scene.render.image_settings.color_depth=profile.get('profundidad_color','8')
for frame in frames:
    target=out/f'frame_{frame:04d}.png'
    if png_ok(target,w,h): print('OMITIDO',frame,flush=True); continue
    scene.frame_set(frame); marker=max((m for m in scene.timeline_markers if m.frame<=frame),key=lambda m:m.frame); scene.camera=marker.camera
    cutaways=json.loads(scene.get('xixova_cortes','{}')).get(marker.camera.get('xixova_id'),[])
    architecture=bpy.data.collections.get('ARQUITECTURA')
    if architecture:
        for obj in architecture.all_objects:
            if obj is None: continue
            identifier=obj.get('xixova_id',''); obj.hide_render=any(identifier==wall or identifier.startswith(wall+':') for wall in cutaways)
    shot=next((x for x in data['presentacion']['tomas'] if x['id']==marker.camera.get('xixova_id')),None)
    scene.view_settings.exposure=shot.get('exposicion',data['presentacion']['exposicion']) if shot else data['presentacion']['exposicion']
    tmp=out/f'frame_{frame:04d}.tmp.png'; scene.render.filepath=str(tmp); start=time.monotonic(); bpy.ops.render.render(write_still=True)
    if not png_ok(tmp,w,h):raise RuntimeError(f'PNG inválido: {tmp}')
    os.replace(tmp,target)
    with (out/'render.jsonl').open('a') as log: log.write(json.dumps({'frame':frame,'segundos':time.monotonic()-start,'estado':'ok'})+'\n')
