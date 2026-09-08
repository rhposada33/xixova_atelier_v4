"""Audita un candidato abierto en Blender y produce métricas reproducibles."""
import argparse, json, sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser(); p.add_argument('--salida',required=True); p.add_argument('--id',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','CURVE','FONT'} and not o.hide_render]
meshes=[o for o in objects if o.type=='MESH']; images=[i for i in bpy.data.images if i.source=='FILE']
missing=[i.filepath for i in images if i.packed_file is None and not Path(bpy.path.abspath(i.filepath)).is_file()]
triangles=0; invalid_normals=0; uv_ok=True
for obj in meshes:
    triangles += sum(max(1,len(p.vertices)-2) for p in obj.data.polygons)
    invalid_normals += sum(1 for p in obj.data.polygons if p.area <= 1e-10)
    uv_ok = uv_ok and bool(obj.data.uv_layers)
memory=sum((i.size[0]*i.size[1]*4 for i in images if i.size[0] and i.size[1]))/(1024*1024)+triangles*48/(1024*1024)
if objects:
    points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
    dims=[max(p[i] for p in points)-min(p[i] for p in points) for i in range(3)] if points else [0,0,0]
else:dims=[0,0,0]
report={'schema':1,'provider_id':a.id,'objetos':len(objects),'mallas':len(meshes),'triangulos':triangles,
 'materiales':len(bpy.data.materials),'imagenes':len(images),'texturas_ausentes':missing,
 'uv_validado':uv_ok,'normales_validas':invalid_normals==0,'dimensiones':[round(x,4) for x in dims],
 'memoria_estimada_mb':round(memory,2),'cycles_compatible':all(m.use_nodes for m in bpy.data.materials)}
target=Path(a.salida); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(report,indent=2)+'\n')
print('BIBLIOTECA_AUDITORIA_OK',a.id)
