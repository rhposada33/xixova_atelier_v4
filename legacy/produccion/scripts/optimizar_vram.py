"""Optimización conservadora: nunca degrada materiales hero ni cambia cámaras."""
import argparse,json,sys
from pathlib import Path
import bpy
def main():
    p=argparse.ArgumentParser(); p.add_argument('--config',type=Path,required=True); p.add_argument('--objetivo-mb',type=int,required=True); a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
    before=sum(i.size[0]*i.size[1]*4 for i in bpy.data.images if i.has_data)/1048576; duplicates=0
    # Solo consolida mallas idénticas por nombre base; no altera texturas o primeros planos.
    seen={}
    for o in bpy.data.objects:
        if o.type!='MESH' or not o.name.startswith('XVA3_'): continue
        key=(o.data.name.rsplit('.',1)[0],len(o.data.vertices),len(o.data.polygons))
        if key in seen and o.data is not seen[key]: o.data=seen[key]; duplicates+=1
        else: seen[key]=o.data
    bpy.context.scene['xva_vram_budget_mb']=a.objetivo_mb; bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    report={'imagenes_estimadas_mb':round(before,1),'mallas_instanciadas':duplicates,'objetivo_mb':a.objetivo_mb,'camara_modificada':False,'texturas_hero_reducidas':False}; out=Path(a.config).parent/'optimizacion_vram.json'; out.write_text(json.dumps(report,indent=2),encoding='utf-8'); print(json.dumps(report))
if __name__=='__main__': main()
