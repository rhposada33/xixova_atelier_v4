"""Mide exposición, nitidez aproximada y composición en pilotos renderizados."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

p=argparse.ArgumentParser(); p.add_argument('--datos',required=True); p.add_argument('--imagenes',required=True); p.add_argument('--salida',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); data=json.loads(Path(a.datos).read_text()); scene=bpy.context.scene; folder=Path(a.imagenes)
frames=[]; offset=0
for shot in data['presentacion']['tomas']:
    frames += [(shot,offset+1),(shot,offset+(shot['fotogramas']+1)//2),(shot,offset+shot['fotogramas'])]; offset+=shot['fotogramas']
rows=[]; warnings=[]
for shot,frame in frames:
    path=folder/f'frame_{frame:04d}.png'
    if not path.is_file(): warnings.append({'codigo':'PILOTO_AUSENTE','fotograma':frame}); continue
    image=bpy.data.images.load(str(path),check_existing=False); pixels=list(image.pixels); total=max(1,len(pixels)//4)
    luminance=[]
    stride=max(1,total//120000)
    for index in range(0,total,stride):
        r,g,b=pixels[index*4:index*4+3]; luminance.append(.2126*r+.7152*g+.0722*b)
    clipped=sum(x>.985 for x in luminance)/len(luminance); crushed=sum(x<.012 for x in luminance)/len(luminance); mean=sum(luminance)/len(luminance)
    sharp=sum(abs(luminance[i]-luminance[i-1]) for i in range(1,len(luminance)))/(len(luminance)-1)
    marker=max((m for m in scene.timeline_markers if m.frame<=frame),key=lambda m:m.frame); camera=marker.camera; scene.frame_set(frame)
    occupancy=None; focus_id=shot.get('foco')
    roots=[o for o in bpy.data.collections['INTERIORISMO'].objects if o.get('xixova_sync_role')=='elemento' and o.get('xixova_id')==focus_id]
    if roots:
        coords=[]
        for child in roots[0].children_recursive:
            if child.type=='MESH': coords += [world_to_camera_view(scene,camera,child.matrix_world@Vector(c)) for c in child.bound_box]
        if coords: occupancy=max(0,min(1,max(c.x for c in coords))-max(0,min(c.x for c in coords)))*max(0,min(1,max(c.y for c in coords))-max(0,min(c.y for c in coords)))
    mask_path=folder.parent/'visibilidad'/f'frame_{frame:04d}.json'
    if mask_path.is_file():
        visibility=json.loads(mask_path.read_text());occupancy=visibility.get('ocupacion_visible')
        if visibility.get('pared_pantalla',0)>.65: warnings.append({'codigo':'EXCESO_PARED','toma':shot['id'],'fotograma':frame,'ratio':visibility['pared_pantalla']})
    else:
        occupancy=None
        warnings.append({'codigo':'VISIBILIDAD_NO_MEDIDA','toma':shot['id'],'fotograma':frame})
    rows.append({'toma':shot['id'],'fotograma':frame,'luminancia_media':round(mean,4),'altas_recortadas':round(clipped,4),
                 'sombras_empastadas':round(crushed,4),'nitidez_aprox':round(sharp,5),'ocupacion_foco':round(occupancy,4) if occupancy is not None else None})
    if clipped>.08: warnings.append({'codigo':'ALTAS_RECORTADAS','toma':shot['id'],'fotograma':frame,'ratio':round(clipped,3)})
    if crushed>.12: warnings.append({'codigo':'SOMBRAS_EMPASTADAS','toma':shot['id'],'fotograma':frame,'ratio':round(crushed,3)})
    if mean>.78: warnings.append({'codigo':'EXPOSICION_ALTA','toma':shot['id'],'fotograma':frame,'luminancia':round(mean,3)})
    if sharp<.012: warnings.append({'codigo':'DETALLE_BAJO','toma':shot['id'],'fotograma':frame,'nitidez':round(sharp,4)})
    if occupancy is not None:
        asset_id=next((x['activo'] for x in data['interiorismo']['elementos'] if x['id']==focus_id),None)
        asset=next((x for x in data['catalogo']['activos'] if x['id']==asset_id),{})
        # Raster coverage excludes background inside the bounding rectangle.
        # Never reuse thresholds calibrated for bounding-box coverage.
        limits=asset.get('ocupacion_visible',{'minima':.08,'maxima':.6})
        if occupancy<limits['minima'] or occupancy>limits['maxima']:
            warnings.append({'codigo':'OCUPACION_ENCUADRE','toma':shot['id'],'fotograma':frame,'valor':round(occupancy,3),'esperado':limits})
    bpy.data.images.remove(image)
report={'schema':2,'ok':not warnings,'integridad_tecnica':not any(x['codigo']=='PILOTO_AUSENTE' for x in warnings),'auditoria_fotografica':not warnings,'aprobacion_visual':'pendiente','controles':rows,'avisos':warnings}
target=Path(a.salida); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
print('FOTOGRAFIA='+json.dumps({'ok':report['ok'],'fotogramas':len(rows),'avisos':len(warnings)},ensure_ascii=False))
