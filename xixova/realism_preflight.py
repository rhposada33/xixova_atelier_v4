"""Auditoría de recursos y geometría necesarios para render fotográfico."""
import argparse, json, sys
from pathlib import Path
import bpy

p=argparse.ArgumentParser(); p.add_argument('--datos',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); data=json.loads(Path(a.datos).read_text()); scene=bpy.context.scene
errors=[]; warnings=[]; texture_bytes=0; missing=[]
for image in bpy.data.images:
    if image.source!='FILE': continue
    path=Path(bpy.path.abspath(image.filepath))
    if not path.is_file() and not image.packed_file: missing.append(str(path))
    elif path.is_file(): texture_bytes += path.stat().st_size
if missing: errors.append({'codigo':'TEXTURA_AUSENTE','elementos':missing[:12]})
environment=data['presentacion']['entorno'].get('archivo')
if not environment: warnings.append('Presentación sin HDRI; se usará fondo uniforme.')
elif not Path(environment).is_file(): errors.append({'codigo':'HDRI_AUSENTE','archivo':environment})
uv_missing=[]; bad_normals=[]
for obj in scene.objects:
    if obj.type!='MESH' or not obj.data.polygons: continue
    if not obj.data.uv_layers: uv_missing.append(obj.name)
    if any(p.area<=1e-10 for p in obj.data.polygons): bad_normals.append(obj.name)
if uv_missing: warnings.append(f'{len(uv_missing)} mallas sin UV; materiales procedurales siguen disponibles.')
if bad_normals: errors.append({'codigo':'GEOMETRIA_DEGENERADA','elementos':bad_normals[:12]})
photographic=data['proyecto']['produccion']['perfiles'].get('fotografico_1080p')
if not photographic: errors.append({'codigo':'PERFIL_AUSENTE','elemento':'fotografico_1080p'})
elif photographic['resolucion'] != [1920,1080]: errors.append({'codigo':'RESOLUCION_FINAL','valor':photographic['resolucion']})
report={'ok':not errors,'hdri':environment,'imagenes':len(bpy.data.images),'texturas_mb':round(texture_bytes/1048576,2),
        'mallas':sum(o.type=='MESH' for o in scene.objects),'mallas_sin_uv':uv_missing,'errores':errors,'avisos':warnings,
        'presupuesto':{'vram_gb':data['proyecto']['produccion']['gpu_vram_gb'],'ram_gb':data['proyecto']['produccion']['ram_gb']}}
target=Path(a.salida); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print('REALISMO='+json.dumps({'ok':report['ok'],'errores':len(errors),'avisos':len(warnings)},ensure_ascii=False))
if errors: raise RuntimeError('Preflight fotográfico fallido')
