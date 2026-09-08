"""Normaliza y crea niveles de detalle de un activo abierto en Blender."""
import argparse, hashlib, json, sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser(); p.add_argument('--id',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); out=Path(a.salida); out.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0

objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','CURVE','FONT','EMPTY'} and not o.hide_render]
meshes=[o for o in objects if o.type=='MESH']
if not meshes: raise RuntimeError('El activo no contiene mallas visibles.')
for obj in list(bpy.data.objects):
    if obj not in objects: bpy.data.objects.remove(obj,do_unlink=True)
points=[o.matrix_world@Vector(corner) for o in meshes for corner in o.bound_box]
lo=Vector((min(p.x for p in points),min(p.y for p in points),min(p.z for p in points)))
hi=Vector((max(p.x for p in points),max(p.y for p in points),max(p.z for p in points)))
shift=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
roots=[o for o in objects if o.parent is None]
for o in roots:o.location+=shift

for collection in list(bpy.data.collections):
    if collection.name!='Collection' and collection.users==0:bpy.data.collections.remove(collection)
collection=bpy.data.collections.get('XIXOVA_ASSET') or bpy.data.collections.new('XIXOVA_ASSET')
if collection.name not in bpy.context.scene.collection.children.keys():bpy.context.scene.collection.children.link(collection)
for o in objects:
    for c in list(o.users_collection): c.objects.unlink(o)
    collection.objects.link(o)

def save(name,ratio):
    if ratio<1:
        for o in meshes:
            if len(o.data.polygons)>1000:
                mod=o.modifiers.new(name='XIXOVA_LOD',type='DECIMATE'); mod.ratio=ratio
                bpy.context.view_layer.objects.active=o; o.select_set(True)
                try:bpy.ops.object.modifier_apply(modifier=mod.name)
                finally:o.select_set(False)
    try:bpy.ops.file.pack_all()
    except RuntimeError:pass
    path=out/f'{name}.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
    h=hashlib.sha256(path.read_bytes()).hexdigest()
    return {'ruta':str(path),'sha256':h,'coleccion':'XIXOVA_ASSET'}

# Guardar de mayor a menor detalle evita intentar reconstruir geometría ya reducida.
levels={'hero':save('hero',1.0),'standard':save('standard',.55),'proxy':save('proxy',.12)}
report={'schema':1,'dimensiones':[round(hi.x-lo.x,5),round(hi.y-lo.y,5),round(hi.z-lo.z,5)],'niveles':levels}
(out/'niveles.json').write_text(json.dumps(report,indent=2)+'\n')
print('BIBLIOTECA_NIVELES_OK',a.id)
