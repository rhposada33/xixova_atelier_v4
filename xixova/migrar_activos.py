"""Migración explícita y reproducible de los recursos locales históricos.
Ejecutar en Blender. Las bibliotecas de origen solo se leen.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

p=argparse.ArgumentParser(); p.add_argument('--biblioteca',required=True); p.add_argument('--escena',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); out=Path(a.salida).resolve(); out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); entries=[]

def export(c,id,rotation,category,license,author):
    bpy.context.scene.collection.children.link(c); bpy.context.view_layer.update(); objects=list(c.all_objects)
    points=[o.matrix_world@Vector(p) for o in objects if o.type in {'MESH','CURVE'} for p in o.bound_box]
    low=Vector([min(p[j] for p in points) for j in range(3)]); high=Vector([max(p[j] for p in points) for j in range(3)])
    anchor=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z)); transform=Matrix.Rotation(rotation,4,'Z')@Matrix.Translation(-anchor)
    for o in objects:
        o.hide_render=False; o.hide_viewport=False; o.hide_set(False)
        if o.parent not in objects: o.matrix_world=transform@o.matrix_world
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(p) for o in objects if o.type in {'MESH','CURVE'} for p in o.bound_box]
    dims=[max(p[j] for p in points)-min(p[j] for p in points) for j in range(3)]
    for im in bpy.data.images:
        if im.source=='FILE' and not im.packed_file:
            if not Path(bpy.path.abspath(im.filepath)).exists():raise RuntimeError('Textura ausente: '+im.filepath)
            im.pack()
    c.name=id; c['xixova_origen']='CENTER_XY_BASE_Z'; c['xixova_frente']='+Y'; c.hide_render=False; c.hide_viewport=False
    target=out/(id+'.blend'); bpy.data.libraries.write(str(target),{c},fake_user=True)
    entries.append(dict(id=id,archivo='../../cache/framework/activos/'+target.name,coleccion=id,categoria=category,dimensiones=[round(v,6) for v in dims],origen='CENTER_XY_BASE_Z',frente='+Y',apoyo='suelo',holgura=.02,licencia=license,autor=author,sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    bpy.context.scene.collection.children.unlink(c)

# Orientaciones verificadas en el constructor histórico: cama/baño/mesita -Y,
# armarios -X, frentes de cocina +X. Se convierten al frente canónico +Y.
for id,angle,category in [('XVA3_Cama_king',math.pi,'Dormitorio'),('XVA3_Cama_doble',math.pi,'Dormitorio'),('XVA3_Mesita_L',math.pi,'Dormitorio'),('XVA3_Mesita_R',math.pi,'Dormitorio'),('XVA3_Armario_principal',-math.pi/2,'Dormitorio'),('XVA3_Cocina_premium',math.pi/2,'Cocina'),('XVA3_Bano_principal',math.pi,'Baño')]:
    with bpy.data.libraries.load(str(Path(a.biblioteca).resolve()),link=False) as (src,dst): dst.collections=[id]
    export(dst.collections[0],id,angle,category,'propia','XIXOVÁ Atelier')
selections=[('sofa_recto',lambda n:n.startswith('SOFA_RECTO_SKETCHFAB /'),0,'Sala','CC Attribution','mk.ldeclaros / Sketchfab'),('comedor',lambda n:n.startswith(('Atelier mesa comedor','Atelier pata comedor','Atelier silla ','Atelier plato','Atelier vaso','Atelier servilleta','Atelier florero comedor')),0,'Comedor','propia','XIXOVÁ Atelier'),('mesa_centro',lambda n:n.startswith(('Atelier mesa centro','Atelier base mesa','Atelier libro mesa','Atelier cuenco')),0,'Sala','propia','XIXOVÁ Atelier')]
for id,predicate,angle,category,license,author in selections:
    with bpy.data.libraries.load(str(Path(a.escena).resolve()),link=False) as (src,dst):dst.objects=[n for n in src.objects if predicate(n)]
    c=bpy.data.collections.new(id)
    for o in dst.objects:c.objects.link(o)
    if not len(c.objects):raise RuntimeError('Selección vacía: '+id)
    export(c,id,angle,category,license,author)
(out/'catalogo.json').write_text(json.dumps({'schema':1,'activos':entries},indent=2,ensure_ascii=False)+'\n')
print('MIGRADOS',len(entries))
