"""Ensamblador determinista. Se ejecuta exclusivamente dentro de Blender."""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector


def collection(name):
    c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); return c

def move(o, c, id):
    for previous in list(o.users_collection): previous.objects.unlink(o)
    c.objects.link(o); o['xixova_id']=id; o['xixova_capa']=c.name
    return o

def material(name, spec):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*spec['color'],1)
    bs.inputs['Roughness'].default_value=spec['rugosidad']; bs.inputs['Metallic'].default_value=spec.get('metalico',0)
    return m

def box(c,id,pos,dims,mat,angle=0,bevel=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=move(bpy.context.object,c,id); o.name=id
    o.dimensions=dims; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.rotation_euler.z=angle
    if mat: o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Bisel físico','BEVEL'); mod.width=min(bevel,min(dims)/4); mod.segments=3
        o.modifiers.new('Normales','WEIGHTED_NORMAL')
    return o

def slab(c,id,points,z,thickness,mat):
    n=len(points); vertices=[(x,y,h) for h in (z-thickness,z) for x,y in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    mesh=bpy.data.meshes.new(id); mesh.from_pydata(vertices,[],faces); mesh.update()
    o=bpy.data.objects.new(id,mesh); c.objects.link(o); o['xixova_id']=id; o['xixova_capa']=c.name; o.data.materials.append(mat)
    # Blender tessellates concave n-gons for render.
    return o

def aim(o,target): o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def build(data,out,architecture_only=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a=data['arquitectura']; interior=data['interiorismo']; scene=bpy.context.scene
    arch=collection('ARQUITECTURA'); decor=collection('INTERIORISMO'); presentation=collection('PRESENTACION')
    neutral=material('Neutro',{'color':[.72,.72,.69],'rugosidad':.65})
    mats={k:material(interior['id']+'/'+k,v) for k,v in interior['materiales'].items()}
    for key, mat in mats.items(): mat['xixova_material_id']=key
    def finish(id): return neutral if architecture_only else mats.get(interior['acabados'].get(id),neutral)
    for r in a['espacios']:
        slab(arch,r['id']+':piso',r['contorno'],0,.12,finish(r['id']+':piso'))
        if r.get('cubierto', True):
            slab(arch,r['id']+':techo',r['contorno'],r['altura']+.12,.12,finish(r['id']+':techo'))
    for p in a['pilares']: slab(arch,p['id'],p['contorno'],p['altura'],p['altura'],finish(p['id']))
    for w in a['paredes']:
        dx,dy=w['b'][0]-w['a'][0],w['b'][1]-w['a'][1]; length=math.hypot(dx,dy); angle=math.atan2(dy,dx)
        def segment(start,end,bottom,top,suffix,mat=None,thickness=None):
            if end-start<1e-6 or top-bottom<1e-6:return
            center=(start+end)/2
            return box(arch,w['id']+suffix,(w['a'][0]+dx*center/length,w['a'][1]+dy*center/length,(bottom+top)/2),(end-start,thickness or w['espesor'],top-bottom),mat or finish(w['id']),angle)
        cursor=0
        for op in sorted(w['aberturas'],key=lambda v:v['distancia']):
            start=op['distancia']; end=start+op['ancho']; bottom=op['antepecho']; top=bottom+op['alto']
            segment(cursor,start,0,w['altura'],f':{cursor}'); segment(start,end,0,bottom,':'+op['id']+':antepecho'); segment(start,end,top,w['altura'],':'+op['id']+':dintel')
            if op['tipo']=='ventana':
                glass=material(op['id']+'/vidrio',{'color':[.95,.98,1],'rugosidad':.05})
                shader=glass.node_tree.nodes.get('Principled BSDF'); shader.inputs['Transmission Weight'].default_value=1; shader.inputs['IOR'].default_value=1.45
                segment(start,end,bottom,top,':'+op['id']+':vidrio',glass,.008)
                for x,y,z,t,label in [(start,start+.035,bottom,top,'izq'),(end-.035,end,bottom,top,'der'),(start,end,bottom,bottom+.035,'inf'),(start,end,top-.035,top,'sup')]: segment(x,y,z,t,':'+op['id']+label,neutral,.06)
            cursor=end
        segment(cursor,length,0,w['altura'],':final')
    for p in a['instalaciones']:
        o=bpy.data.objects.new(p['id'],None); arch.objects.link(o); o.location=p['posicion']; o['xixova_capa']='ARQUITECTURA'; o['xixova_id']=p['id']; o['tipo']=p['tipo']
    if not architecture_only:
        assets={x['id']:x for x in data['catalogo']['activos']}
        for item in data['resueltos']:
            asset=assets[item['activo']]
            with bpy.data.libraries.load(asset['archivo'],link=False) as (src,dst):
                if asset['coleccion'] not in src.collections: raise RuntimeError('Colección ausente: '+asset['coleccion'])
                dst.collections=[asset['coleccion']]
            imported=dst.collections[0]; decor.children.link(imported)
            parent=bpy.data.objects.new(item['id'],None); decor.objects.link(parent); parent['xixova_id']=item['id']; parent['xixova_capa']='INTERIORISMO'
            objects=list(imported.all_objects)
            for o in objects:
                o['xixova_id']=item['id']; o['xixova_capa']='INTERIORISMO'
                if o.parent not in objects: o.parent=parent
                if item.get('material') and o.type=='MESH':
                    o.data=o.data.copy(); o.data.materials.clear(); o.data.materials.append(mats[item['material']])
            parent.location=item['posicion']; parent.rotation_euler.z=math.radians(item['rotacion']); parent.scale=(item.get('escala',1),)*3
            parent['xixova_sync_role']='elemento'
    p=data['presentacion']; world=bpy.data.worlds.new('Entorno'); scene.world=world; world.use_nodes=True
    bg=world.node_tree.nodes.get('Background'); bg.inputs[0].default_value=(*p['entorno']['color'],1); bg.inputs[1].default_value=p['entorno']['intensidad']
    for light in p['luces']:
        ld=bpy.data.lights.new(light['id'],'AREA'); ld.energy=light['potencia']; ld.shape='DISK'; ld.size=light['tamano']; ld.color=light['color']
        o=bpy.data.objects.new(light['id'],ld); presentation.objects.link(o); o.location=light['posicion']; aim(o,light['objetivo']); o['xixova_capa']='PRESENTACION'; o['xixova_id']=light['id']; o['xixova_sync_role']='luz'
    offset=0
    for shot in p['tomas']:
        cam=bpy.data.cameras.new(shot['id']); cam.lens=shot['lente']; o=bpy.data.objects.new(shot['id'],cam); presentation.objects.link(o); o['xixova_capa']='PRESENTACION'
        o['xixova_id']=shot['id']; o['xixova_sync_role']='camara'
        # Bake exactly the positions validated by core, one key per frame.
        for frame in data['fotogramas']:
            if frame['toma']!=shot['id']:continue
            o.location=frame['posicion']; aim(o,frame['objetivo']); f=offset+frame['numero']
            o.keyframe_insert('location',frame=f); o.keyframe_insert('rotation_euler',frame=f)
        marker=scene.timeline_markers.new(shot['id'],frame=offset+1); marker.camera=o
        if offset==0: scene.camera=o
        offset+=shot['fotogramas']
    scene.frame_start=1; scene.frame_end=offset; scene.render.fps=data['proyecto']['produccion']['fps']
    scene.render.engine='CYCLES'; scene.cycles.use_denoising=True; scene.cycles.use_adaptive_sampling=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='CUDA'; prefs.get_devices()
        for device in prefs.devices: device.use=device.type=='CUDA'
        scene.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
    except Exception: scene.cycles.device='CPU'
    scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=p['exposicion']
    scene['xixova_arquitectura_hash']=data['arquitectura_hash']; scene['xixova_variante']=interior['id']
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
    # Fingerprint only architecture geometry/transforms, independent of materials.
    geometry=[]
    for o in sorted(arch.all_objects,key=lambda o:o['xixova_id']):
        geometry.append([o['xixova_id'],list(o.location),list(o.rotation_euler),list(o.scale), [list(v.co) for v in o.data.vertices] if o.type=='MESH' else []])
    report={'arquitectura_hash':data['arquitectura_hash'],'geometria_hash':hashlib.sha256(json.dumps(geometry,sort_keys=True).encode()).hexdigest(),'objetos_arquitectura':len(arch.all_objects),'objetos_interiorismo':len(decor.all_objects),'fotogramas':offset,'dispositivo':scene.cycles.device}
    if not architecture_only:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from blender_sync import bind
        scene.frame_set(scene.frame_start)
        bind(data)
    out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out)); out.with_suffix('.informe.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--datos',required=True); parser.add_argument('--salida',required=True); parser.add_argument('--arquitectura',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]); build(json.loads(Path(args.datos).read_text()),Path(args.salida),args.arquitectura)
