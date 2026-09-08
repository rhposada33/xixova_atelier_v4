"""Auditoría 3D compacta de una escena compilada, ejecutada en Blender."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser(); p.add_argument('--datos',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); data=json.loads(Path(a.datos).read_text()); scene=bpy.context.scene; deps=bpy.context.evaluated_depsgraph_get()
diagnostics=[]
def add(code,element,explanation): diagnostics.append({'codigo':code,'gravedad':'error','elemento':element,'explicacion':explanation})
for obj in scene.objects:
    if obj.type=='MESH' and obj.get('xixova_capa')=='ARQUITECTURA' and not obj.data.uv_layers:add('UV_AUSENTE',obj.name,'Superficie arquitectónica sin UV métrica.')
for root in [o for o in scene.objects if o.get('xixova_sync_role')=='elemento']:
    points=[child.matrix_world@Vector(v) for child in root.children_recursive if child.type=='MESH' for v in child.bound_box]
    if points:
        bottom=min(p.z for p in points)
        if bottom>.025:add('MUEBLE_FLOTANDO',root.get('xixova_id',root.name),f'Base a {bottom:.3f} m sobre el piso.')
        if bottom<-.04:add('MUEBLE_PENETRANDO',root.get('xixova_id',root.name),f'Base a {bottom:.3f} m bajo el piso.')
physical={o.get('xixova_fuente_luz') for o in scene.objects if o.get('xixova_fuente_luz')}
for obj in scene.objects:
    if obj.type=='LIGHT' and obj.data.type!='SUN' and obj.get('xixova_id') not in physical:add('LUZ_SIN_LUMINARIA',obj.get('xixova_id',obj.name),'La fuente no tiene difusor físico asociado.')
offset=0
for shot in data['presentacion']['tomas']:
    marker=next((m for m in scene.timeline_markers if m.frame==offset+1),None); offset+=shot['fotogramas']
    if not marker or not marker.camera: add('CAMARA_AUSENTE',shot['id'],'No existe cámara para la toma.'); continue
    camera=marker.camera; focus=next((o for o in scene.objects if o.get('xixova_sync_role')=='elemento' and o.get('xixova_id')==shot.get('foco')),None)
    for frame in (marker.frame,marker.frame+(shot['fotogramas']-1)//2,marker.frame+shot['fotogramas']-1):
        scene.frame_set(frame)
        origin=camera.matrix_world.translation
        for direction in (Vector((1,0,0)),Vector((-1,0,0)),Vector((0,1,0)),Vector((0,-1,0))):
            hit,loc,normal,index,obj,matrix=scene.ray_cast(deps,origin,direction,distance=.12)
            if hit and obj.get('xixova_capa')=='ARQUITECTURA':add('CAMARA_EN_GEOMETRIA',shot['id'],f'Cámara sin margen en fotograma {frame}.'); break
        if focus:
            target=focus.matrix_world.translation+Vector((0,0,.5)); vector=target-origin; distance=vector.length
            if distance>.01:
                hit,loc,normal,index,obj,matrix=scene.ray_cast(deps,origin,vector.normalized(),distance=distance-.03)
                cutaways=str(obj.get('xixova_corte_tomas','')).split(',') if obj else []
                if hit and obj and obj.get('xixova_id')!=focus.get('xixova_id') and shot['id'] not in cutaways: add('CAMARA_OBSTRUIDA',shot['id'],f'{obj.name} bloquea al protagonista en fotograma {frame}.')
report={'schema':1,'ok':not diagnostics,'diagnosticos':list({(d['codigo'],d['elemento'],d['explicacion']):d for d in diagnostics}.values()),
 'controles':{'mallas':sum(o.type=='MESH' for o in scene.objects),'luces':sum(o.type=='LIGHT' for o in scene.objects),'tomas':len(data['presentacion']['tomas'])}}
target=Path(a.salida); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print('AUDITORIA_REALISMO='+json.dumps({'ok':report['ok'],'diagnosticos':len(report['diagnosticos'])}))
