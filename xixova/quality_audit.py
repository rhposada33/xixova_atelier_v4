"""Inventario visual de activos por toma, ejecutado dentro de Blender."""
import argparse
import json
import sys
from pathlib import Path

import bpy


p=argparse.ArgumentParser(); p.add_argument('--datos',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); data=json.loads(Path(a.datos).read_text()); scene=bpy.context.scene
frames=[]; offset=0
for shot in data['presentacion']['tomas']:
    frames.extend((offset+1,offset+(shot['fotogramas']+1)//2,offset+shot['fotogramas'])); offset+=shot['fotogramas']
rows=[]
for frame in frames:
    scene.frame_set(frame); marker=max((marker for marker in scene.timeline_markers if marker.frame<=frame),key=lambda marker:marker.frame); camera=marker.camera
    candidates=[]
    for root in bpy.data.collections['INTERIORISMO'].objects:
        if root.get('xixova_sync_role')!='elemento': continue
        local=camera.matrix_world.inverted()@root.matrix_world.translation
        if local.z<0:
            candidates.append({'elemento':root['xixova_id'],'distancia_m':round((root.matrix_world.translation-camera.matrix_world.translation).length,2)})
    rows.append({'fotograma':frame,'camara':camera.get('xixova_id',camera.name),'elementos':sorted(candidates,key=lambda item:item['distancia_m'])})
report={'schema':1,'criterios':['escala','silueta','contacto','intersecciones','materiales','licencia'],'controles':rows}
target=Path(a.salida); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('AUDITORIA_CALIDAD_OK',len(rows))
