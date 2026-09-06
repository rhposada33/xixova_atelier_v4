"""Auditoría de integración sobre un .blend generado (sin mutaciones)."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser(); p.add_argument('--datos',required=True); a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); b=json.loads(Path(a.datos).read_text()); scene=bpy.context.scene
assert scene['xixova_arquitectura_hash']==b['arquitectura_hash']
assert scene['xixova_variante']==b['interiorismo']['id']
assert {'ARQUITECTURA','INTERIORISMO','PRESENTACION'}.issubset(bpy.data.collections.keys())
for layer in ('ARQUITECTURA','INTERIORISMO'):
 for o in bpy.data.collections[layer].all_objects: assert o['xixova_capa']==layer
for item in b['resueltos']:
 root=next(o for o in bpy.data.collections['INTERIORISMO'].objects if o.get('xixova_id')==item['id'])
 assert math.dist(root.location,item['posicion'])<1e-5
 assert abs(root.rotation_euler.z-math.radians(item['rotacion']))<1e-5
 objs=[o for o in bpy.data.collections['INTERIORISMO'].all_objects if o.get('xixova_id')==item['id'] and o.type in {'MESH','CURVE'}]
 points=[root.matrix_world.inverted()@o.matrix_world@Vector(v) for o in objs for v in o.bound_box]
 low=[min(v[j] for v in points) for j in range(3)]; high=[max(v[j] for v in points) for j in range(3)]
 nominal=next(v for v in b['catalogo']['activos'] if v['id']==item['activo'])['dimensiones']
 assert abs(low[2])<.002,(item['id'],'base',low)
 assert abs(low[0]+high[0])<.002 and abs(low[1]+high[1])<.002,(item['id'],'origen')
 assert all(abs(high[j]-low[j]-nominal[j])<.002 for j in range(3)),(item['id'],'dimensiones')
offset=0
for shot in b['presentacion']['tomas']:
 camera=scene.timeline_markers[shot['id']].camera
 for frame in (v for v in b['fotogramas'] if v['toma']==shot['id']):
  scene.frame_set(offset+frame['numero'])
  assert math.dist(camera.location,frame['posicion'])<1e-5,(shot['id'],frame['numero'],list(camera.location),frame['posicion'])
 offset+=shot['fotogramas']
assert offset==scene.frame_end
missing=[im.name for im in bpy.data.images if im.source=='FILE' and not im.packed_file and not Path(bpy.path.abspath(im.filepath)).exists()]
assert not missing,missing
print('INTEGRACION_OK',b['proyecto']['id'],b['interiorismo']['id'],offset,'fotogramas',len(b['resueltos']),'activos')
