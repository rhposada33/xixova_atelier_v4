"""Renderiza la ficha visual neutral y golden hour de un activo."""
import argparse, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

p=argparse.ArgumentParser(); p.add_argument('--salida',required=True); p.add_argument('--muestras',type=int,default=32)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]); out=Path(a.salida); out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE_NEXT'; scene.render.resolution_x=640; scene.render.resolution_y=640; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.view_settings.look='AgX - Medium High Contrast'
meshes=[o for o in scene.objects if o.type=='MESH' and not o.hide_render]
points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
lo=Vector((min(p.x for p in points),min(p.y for p in points),min(p.z for p in points))); hi=Vector((max(p.x for p in points),max(p.y for p in points),max(p.z for p in points)))
center=(lo+hi)/2; size=max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z); distance=size*1.75
world=scene.world or bpy.data.worlds.new('XIXOVA_WORLD'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.055,0.07,0.10,1); world.node_tree.nodes['Background'].inputs['Strength'].default_value=.3
camera_data=bpy.data.cameras.new('XIXOVA_PREVIEW_CAMERA'); camera=bpy.data.objects.new('XIXOVA_PREVIEW_CAMERA',camera_data); scene.collection.objects.link(camera); scene.camera=camera; camera.data.lens=55
def point(obj,target): obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
key_data=bpy.data.lights.new('XIXOVA_KEY','AREA'); key_data.energy=900; key_data.shape='DISK'; key_data.size=size*1.8
key=bpy.data.objects.new('XIXOVA_KEY',key_data); scene.collection.objects.link(key)
fill_data=bpy.data.lights.new('XIXOVA_FILL','AREA'); fill_data.energy=450; fill_data.size=size*2
fill=bpy.data.objects.new('XIXOVA_FILL',fill_data); scene.collection.objects.link(fill)
key.location=center+Vector((-size,size,size*1.8)); fill.location=center+Vector((size,-size,size)); point(key,center); point(fill,center)
angles=[('frontal',0),('tres_cuartos',45),('lateral',90),('posterior',180),('detalle_1',25),('detalle_2',-35)]
for name,degrees in angles:
    angle=math.radians(degrees); d=distance*(.72 if name.startswith('detalle') else 1)
    camera.location=center+Vector((math.sin(angle)*d,-math.cos(angle)*d,size*.55)); point(camera,center)
    scene.render.filepath=str(out/f'neutral_{name}.png'); bpy.ops.render.render(write_still=True)
key_data.color=(1.0,.42,.16); key_data.energy=1250; world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.045,.12,1)
camera.location=center+Vector((distance*.65,-distance*.75,size*.62)); point(camera,center)
scene.render.filepath=str(out/'golden_hour.png'); bpy.ops.render.render(write_still=True)
print('BIBLIOTECA_PREVIAS_OK',len(angles)+1)
