"""Centra activos de colección en XY y apoya su base en Z=0 dentro de la biblioteca."""
import hashlib, sys
from pathlib import Path
import bpy
from mathutils import Vector

library=Path(sys.argv[sys.argv.index('--biblioteca')+1]).resolve()
if Path(bpy.data.filepath).resolve()!=library:
    bpy.ops.wm.open_mainfile(filepath=str(library),load_ui=False,use_scripts=False)
normalized=[]
for col in [c for c in bpy.data.collections if c.asset_data]:
    meshes=[o for o in col.all_objects if o.type=='MESH']
    points=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    if not points: continue
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3))); hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    anchor=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    roots=[o for o in col.objects if o.parent is None]
    for obj in roots: obj.location-=anchor
    col['xva_insertion']='CENTER_XY_BASE_Z'; col['xva_source_anchor']=[round(v,6) for v in anchor]
    normalized.append(col.name)
bpy.ops.wm.save_as_mainfile(filepath=str(library))
digest=hashlib.sha256(library.read_bytes()).hexdigest()
(library.parent/'SHA256.txt').write_text(digest+'  '+library.name+'\n',encoding='utf-8')
print(f'NORMALIZADOS={len(normalized)} sha256={digest}')
