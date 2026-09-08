"""Preflight de una escena Xixova, ejecutado dentro de Blender."""
import argparse
import json
import sys
from pathlib import Path

import bpy


p=argparse.ArgumentParser(); p.add_argument('--datos',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); data=json.loads(Path(a.datos).read_text()); scene=bpy.context.scene
errors=[]; warnings=[]
if scene.get('xixova_arquitectura_hash') != data['arquitectura_hash']: errors.append('Hash arquitectónico distinto.')
if scene.get('xixova_variante') != data['interiorismo']['id']: errors.append('Variante distinta.')
if (scene.frame_start,scene.frame_end)!=(1,len(data['fotogramas'])): errors.append('Rango de fotogramas distinto.')
missing=[image.name for image in bpy.data.images if image.source=='FILE' and not image.packed_file and not Path(bpy.path.abspath(image.filepath)).is_file()]
if missing: errors.append(f'{len(missing)} imágenes ausentes: {missing[:8]}')
devices=[]
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='CUDA'; prefs.get_devices()
    devices=[device.name for device in prefs.devices if device.type=='CUDA']
except Exception as exc: warnings.append('CUDA no comprobable: '+str(exc))
if not devices: warnings.append('CUDA no disponible; Cycles usará CPU.')
report={'ok':not errors,'blender':bpy.app.version_string,'cuda':devices,'presupuestos':{'vram_gb':data['proyecto']['produccion']['gpu_vram_gb'],'ram_gb':data['proyecto']['produccion']['ram_gb']},'errores':errors,'avisos':warnings}
target=Path(a.salida); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print('PREFLIGHT='+json.dumps(report,ensure_ascii=False))
if errors: raise RuntimeError('; '.join(errors))
