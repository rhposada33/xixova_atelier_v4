"""Exporta copias normalizadas; nunca modifica la biblioteca de origen."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser(); p.add_argument('--catalogo',required=True); p.add_argument('--biblioteca',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); source=json.loads(Path(a.catalogo).read_text()); out=Path(a.salida).resolve(); out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
entries=[]
for asset in source['activos']:
    with bpy.data.libraries.load(str(Path(a.biblioteca).resolve()),link=False) as (src,dst):
        if asset['id'] not in src.collections: continue
        dst.collections=[asset['id']]
    c=dst.collections[0]; bpy.context.scene.collection.children.link(c); bpy.context.view_layer.update()
    objects=list(c.all_objects); points=[o.matrix_world@Vector(p) for o in objects if o.type in {'MESH','CURVE'} for p in o.bound_box]
    if not points: continue
    low=Vector([min(p[j] for p in points) for j in range(3)]); high=Vector([max(p[j] for p in points) for j in range(3)])
    anchor=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
    for o in objects:
        if o.parent not in objects: o.location-=anchor
    c['xixova_origen']='CENTER_XY_BASE_Z'; c['xixova_frente']='+Y'
    # Pack image resources into each independent asset, preserving PBR materials.
    for image in bpy.data.images:
        if image.source=='FILE' and not image.packed_file:
            if not Path(bpy.path.abspath(image.filepath)).exists(): raise RuntimeError('Textura ausente: '+image.filepath)
            image.pack()
    target=out/(asset['id']+'.blend'); bpy.data.libraries.write(str(target),{c},fake_user=True)
    entries.append(dict(id=asset['id'],archivo=str(target),coleccion=c.name,categoria=asset['categoria'],dimensiones=[round(v,6) for v in high-low],origen='CENTER_XY_BASE_Z',frente='+Y',apoyo='suelo',holgura=.04,licencia=asset['licencia'],autor=asset['autor'],sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    bpy.context.scene.collection.children.unlink(c)
(out/'catalogo.json').write_text(json.dumps({'schema':1,'activos':entries},indent=2)+'\n')
print('CATALOGO_NORMALIZADO',len(entries),out/'catalogo.json')
