"""Inventario objetivo por cámara para los 21 controles de calidad."""
import argparse,json,math,sys,time
from pathlib import Path
import bpy
from mathutils import Vector

def cli():
    p=argparse.ArgumentParser(); p.add_argument('--config',type=Path,required=True); p.add_argument('--salida',type=Path,required=True); p.add_argument('--frames',required=True); return p.parse_args(sys.argv[sys.argv.index('--')+1:])
def main():
    a=cli(); a.salida.mkdir(parents=True,exist_ok=True); rows=[]
    for frame in map(int,a.frames.split(',')):
        bpy.context.scene.frame_set(frame); cam=bpy.context.scene.camera; inv=cam.matrix_world.inverted(); visible=[]
        for o in bpy.context.scene.objects:
            if o.hide_render or not o.name.startswith(('XVA3_','XVA_')) or o.type not in {'MESH','CURVE'}: continue
            local=inv@o.matrix_world.translation; distance=(o.matrix_world.translation-cam.matrix_world.translation).length
            if local.z<0 and distance<14: visible.append({'objeto':o.name,'distancia_m':round(distance,2),'tipo':o.type,'materiales':[s.material.name for s in o.material_slots if s.material]})
        rows.append({'frame':frame,'camara':cam.name,'posicion':[round(v,3) for v in cam.matrix_world.translation],'objetos_candidatos':sorted(visible,key=lambda x:x['distancia_m'])})
    payload={'schema':1,'generado':time.time(),'escena':bpy.data.filepath,'controles':rows,'criterios':['escala','silueta','contacto','intersecciones','uv','normales','materiales','licencia']}
    (a.salida/'inventario_por_camara.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8'); print('AUDITORIA_CALIDAD_OK',len(rows))
if __name__=='__main__': main()
