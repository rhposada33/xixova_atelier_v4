"""Rasterized object-identification pass for visible occupancy (not bounding boxes)."""
import argparse,json,sys
from pathlib import Path
import bpy

p=argparse.ArgumentParser();p.add_argument('--datos',required=True);p.add_argument('--salida',required=True);p.add_argument('--frames',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);data=json.loads(Path(a.datos).read_text());out=Path(a.salida);out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=320;scene.render.resolution_y=180;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Raw';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
if hasattr(scene.view_settings,'use_white_balance'):scene.view_settings.use_white_balance=False
scene.use_nodes=False;scene.render.film_transparent=False;scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='32'
s=scene.display.shading;s.light='FLAT';s.color_type='OBJECT';s.show_shadows=False;s.show_cavity=False;s.show_specular_highlight=False;s.show_object_outline=False;s.background_type='WORLD';s.background_color=(0,0,0)
scene.display.render_aa='OFF'
ids=sorted({o.get('xixova_id',o.name) for o in scene.objects if o.type=='MESH'});lookup={v:i+1 for i,v in enumerate(ids)}
if len(ids)>=32768:raise RuntimeError('Too many IDs for visibility pass')
for obj in scene.objects:
 if obj.type=='MESH':
  v=lookup[obj.get('xixova_id',obj.name)];obj.color=((v%32)/31,((v//32)%32)/31,(v//1024)/31,1)
for frame in map(int,a.frames.split(',')):
 scene.frame_set(frame);marker=max((m for m in scene.timeline_markers if m.frame<=frame),key=lambda m:m.frame);scene.camera=marker.camera
 shot=next(x for x in data['presentacion']['tomas'] if x['id']==scene.camera.get('xixova_id'))
 cuts=json.loads(scene.get('xixova_cortes','{}')).get(shot['id'],[])
 for obj in scene.objects:
  if obj.get('xixova_capa')=='ARQUITECTURA':
   identifier=obj.get('xixova_id','');obj.hide_render=any(identifier==w or identifier.startswith(w+':') for w in cuts)
 bpy.context.view_layer.update();path=out/f'id_{frame:04d}.exr';scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
 image=bpy.data.images.load(str(path),check_existing=False);pixels=list(image.pixels);counts={};total=len(pixels)//4
 for n in range(0,len(pixels),4):
  r,g,b=[round(max(0,min(1,x))*31) for x in pixels[n:n+3]];value=r+g*32+b*1024
  if 1<=value<=len(ids):key=ids[value-1];counts[key]=counts.get(key,0)+1
 bpy.data.images.remove(image)
 focus=shot.get('foco');wall_ids={w['id'] for w in data['arquitectura']['paredes']}
 wall_pixels=sum(v for k,v in counts.items() if any(k==w or k.startswith(w+':') for w in wall_ids))
 report={'schema':1,'metodo':'pase_id_workbench_opaco','toma':shot['id'],'frame':frame,'ocupacion_visible':counts.get(focus,0)/total if focus else None,'pared_pantalla':wall_pixels/total,'pixeles_identificados':sum(counts.values()),'pixeles':total,'limitacion':'El pase trata vidrio y cortinas como opacos.'}
 (out/f'frame_{frame:04d}.json').write_text(json.dumps(report))
