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

def kelvin(value):
    """Conversión aproximada Kelvin -> RGB lineal utilizable por luces Blender."""
    t=max(10,min(400,value/100))
    r=255 if t<=66 else 329.698727446*((t-60)**-.1332047592)
    g=99.4708025861*math.log(t)-161.1195681661 if t<=66 else 288.1221695283*((t-60)**-.0755148492)
    b=255 if t>=66 else (0 if t<=19 else 138.5177312231*math.log(t-10)-305.044792731)
    return tuple(max(0,min(1,x/255)) for x in (r,g,b))

def material(name, spec):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nodes,links=m.node_tree.nodes,m.node_tree.links; bs=nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*spec['color'],1)
    bs.inputs['Roughness'].default_value=spec['rugosidad']; bs.inputs['Metallic'].default_value=spec.get('metalico',0)
    maps=spec.get('mapas',{}); normal_socket=None
    if maps:
        coords=nodes.new('ShaderNodeTexCoord'); mapping=nodes.new('ShaderNodeMapping'); scale=1/spec.get('escala_m',1)
        mapping.inputs['Scale'].default_value=(scale,scale,scale); links.new(coords.outputs['Object'],mapping.inputs['Vector'])
        textures={}
        for role,path in maps.items():
            image=bpy.data.images.load(path,check_existing=True)
            if role!='color': image.colorspace_settings.name='Non-Color'
            tex=nodes.new('ShaderNodeTexImage'); tex.image=image; tex.label=role; links.new(mapping.outputs['Vector'],tex.inputs['Vector']); textures[role]=tex
        if 'color' in textures: links.new(textures['color'].outputs['Color'],bs.inputs['Base Color'])
        if 'roughness' in textures: links.new(textures['roughness'].outputs['Color'],bs.inputs['Roughness'])
        if 'normal' in textures:
            normal=nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=spec.get('normal_fuerza',.35)
            links.new(textures['normal'].outputs['Color'],normal.inputs['Color']); normal_socket=normal.outputs['Normal']
        if 'height' in textures:
            bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.25; bump.inputs['Distance'].default_value=spec.get('height_fuerza_m',.001)
            links.new(textures['height'].outputs['Color'],bump.inputs['Height'])
            if normal_socket: links.new(normal_socket,bump.inputs['Normal'])
            normal_socket=bump.outputs['Normal']
    if spec.get('microdetalle',0)>0:
        noise=nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=120; noise.inputs['Detail'].default_value=3
        bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=spec['microdetalle']*.18; bump.inputs['Distance'].default_value=.0007
        links.new(noise.outputs['Fac'],bump.inputs['Height'])
        if normal_socket: links.new(normal_socket,bump.inputs['Normal'])
        normal_socket=bump.outputs['Normal']
    if normal_socket: links.new(normal_socket,bs.inputs['Normal'])
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
    uv=mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        vertex=mesh.vertices[loop.vertex_index].co; uv.data[loop.index].uv=(vertex.x,vertex.y)
    # Blender tessellates concave n-gons for render.
    return o

def aim(o,target): o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def segment_distance(point,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; length=dx*dx+dy*dy
    t=0 if not length else max(0,min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length))
    return math.hypot(point[0]-(a[0]+t*dx),point[1]-(a[1]+t*dy))

def segments_cross(a,b,c,d):
    def side(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    return side(a,b,c)*side(a,b,d)<0 and side(c,d,a)*side(c,d,b)<0

def build(data,out,architecture_only=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a=data['arquitectura']; interior=data['interiorismo']; scene=bpy.context.scene
    arch=collection('ARQUITECTURA'); decor=collection('INTERIORISMO'); presentation=collection('PRESENTACION'); enrichment=collection('ENRIQUECIMIENTO')
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
        # Molduras regenerables, cortadas en puertas y apenas separadas de la pared.
        trim_cursor=0
        doors=sorted((op for op in w['aberturas'] if op['tipo']=='puerta'),key=lambda op:op['distancia'])
        def trim_part(start,end,suffix):
            if end-start<=.01:return
            center=(start+end)/2
            obj=box(enrichment,w['id']+':rodapie:'+suffix,(w['a'][0]+dx*center/length,w['a'][1]+dy*center/length,.045),(end-start,w['espesor']+.026,.09),neutral,angle,.004)
            obj['xixova_regenerable']=True
        for door in doors:
            trim_part(trim_cursor,door['distancia'],door['id']+'a'); trim_cursor=door['distancia']+door['ancho']
            for edge,label in ((door['distancia'],'izq'),(door['distancia']+door['ancho'],'der')):
                center=edge
                obj=box(enrichment,door['id']+':jamba:'+label,(w['a'][0]+dx*center/length,w['a'][1]+dy*center/length,door['alto']/2),(.055,w['espesor']+.035,door['alto']),neutral,angle,.003); obj['xixova_regenerable']=True
        trim_part(trim_cursor,length,'final')
    for p in a['instalaciones']:
        o=bpy.data.objects.new(p['id'],None); arch.objects.link(o); o.location=p['posicion']; o['xixova_capa']='ARQUITECTURA'; o['xixova_id']=p['id']; o['tipo']=p['tipo']
    # Exterior regenerable: evita ventanas hacia un vacío sin escala ni horizonte.
    all_points=[point for room in a['espacios'] for point in room['contorno']]; xs=[p[0] for p in all_points]; ys=[p[1] for p in all_points]
    exterior=box(enrichment,'exterior:suelo',((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,-.16),(max(xs)-min(xs)+24,max(ys)-min(ys)+24,.08),neutral,bevel=0)
    exterior['xixova_regenerable']=True
    if not architecture_only:
        assets={x['id']:x for x in data['catalogo']['activos']}
        for item in data['resueltos']:
            asset=assets[item['activo']]
            level=item.get('nivel_detalle','standard'); detail=asset.get('niveles',{}).get(level)
            asset_path=detail['ruta'] if detail else asset['archivo']; asset_collection=detail.get('coleccion',asset['coleccion']) if detail else asset['coleccion']
            with bpy.data.libraries.load(asset_path,link=False) as (src,dst):
                if asset_collection not in src.collections: raise RuntimeError('Colección ausente: '+asset_collection)
                dst.collections=[asset_collection]
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
    wn=world.node_tree.nodes; wl=world.node_tree.links; bg=wn.get('Background'); bg.inputs[0].default_value=(*p['entorno']['color'],1); bg.inputs[1].default_value=p['entorno']['intensidad']
    if p['entorno'].get('archivo'):
        env=wn.new('ShaderNodeTexEnvironment'); env.image=bpy.data.images.load(p['entorno']['archivo'],check_existing=True)
        coord=wn.new('ShaderNodeTexCoord'); mapping=wn.new('ShaderNodeMapping'); mapping.inputs['Rotation'].default_value[2]=math.radians(p['entorno'].get('rotacion_grados',0))
        wl.new(coord.outputs['Generated'],mapping.inputs['Vector']); wl.new(mapping.outputs['Vector'],env.inputs['Vector']); wl.new(env.outputs['Color'],bg.inputs['Color'])
    if p.get('sol'):
        spec=p['sol']; ld=bpy.data.lights.new('Sol golden hour','SUN'); ld.energy=spec['energia']; ld.angle=math.radians(spec.get('angulo_grados',2.5)); ld.color=kelvin(spec['temperatura_k'])
        o=bpy.data.objects.new('Sol golden hour',ld); presentation.objects.link(o)
        az,el=map(math.radians,(spec['azimut_grados'],spec['elevacion_grados'])); o.location=(10*math.cos(el)*math.cos(az),10*math.cos(el)*math.sin(az),10*math.sin(el)); aim(o,(0,0,0)); o['xixova_capa']='PRESENTACION'; o['xixova_id']='sol_golden_hour'
    for light in p['luces']:
        kind=light.get('tipo','AREA'); ld=bpy.data.lights.new(light['id'],kind); ld.energy=light['potencia']; ld.color=kelvin(light['temperatura_k']) if light.get('temperatura_k') else light['color']
        if kind=='AREA': ld.shape=light.get('forma','DISK'); ld.size=light['tamano']; ld.size_y=light.get('tamano_y',light['tamano'])
        o=bpy.data.objects.new(light['id'],ld); presentation.objects.link(o); o.location=light['posicion']; aim(o,light['objetivo']); o['xixova_capa']='PRESENTACION'; o['xixova_id']=light['id']; o['xixova_sync_role']='luz'
        # Difusor visible asociado a la fuente fotométrica.
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=max(.035,min(.12,light['tamano']*.06)),location=light['posicion'])
        diffuser=move(bpy.context.object,enrichment,light['id']+':difusor'); diffuser['xixova_fuente_luz']=light['id']; diffuser['xixova_regenerable']=True
        em=material(light['id']+'/emision',{'color':[1,.82,.62],'rugosidad':.35}); bs=em.node_tree.nodes.get('Principled BSDF'); bs.inputs['Emission Color'].default_value=(*ld.color,1); bs.inputs['Emission Strength'].default_value=2.5; diffuser.data.materials.append(em)
    offset=0; shot_ranges=[]
    for shot in p['tomas']:
        cam=bpy.data.cameras.new(shot['id']); cam.lens=shot['lente']; cam.sensor_width=shot.get('sensor_mm',36); o=bpy.data.objects.new(shot['id'],cam); presentation.objects.link(o); o['xixova_capa']='PRESENTACION'
        o['xixova_id']=shot['id']; o['xixova_sync_role']='camara'
        # Bake exactly the positions validated by core, one key per frame.
        for frame in data['fotogramas']:
            if frame['toma']!=shot['id']:continue
            o.location=frame['posicion']; aim(o,frame['objetivo']); f=offset+frame['numero']
            o.keyframe_insert('location',frame=f); o.keyframe_insert('rotation_euler',frame=f)
        if shot.get('apertura_f'):
            cam.dof.use_dof=True; cam.dof.aperture_fstop=shot['apertura_f']
            focus=next((x for x in decor.objects if x.get('xixova_id')==shot.get('foco') and x.get('xixova_sync_role')=='elemento'),None)
            if focus is None:
                focus=bpy.data.objects.new('FOCO_'+shot['id'],None); presentation.objects.link(focus); keys=[x['objetivo'] for x in shot['puntos']]; focus.location=tuple(sum(x[j] for x in keys)/len(keys) for j in range(3))
            cam.dof.focus_object=focus
        marker=scene.timeline_markers.new(shot['id'],frame=offset+1); marker.camera=o
        if offset==0: scene.camera=o
        # Corte arquitectónico fotográfico: oculta sólo durante esta toma los muros
        # que contienen la cámara o bloquean la línea al protagonista.
        hidden=[]
        for wall in a['paredes']:
            if any(segment_distance(point['posicion'],wall['a'],wall['b'])<.28 or segments_cross(point['posicion'],point['objetivo'],wall['a'],wall['b']) for point in shot['puntos']): hidden.append(wall['id'])
        shot_ranges.append((shot['id'],offset+1,offset+shot['fotogramas'],hidden))
        offset+=shot['fotogramas']
    scene['xixova_cortes']=json.dumps({shot_id:walls for shot_id,start,end,walls in shot_ranges},sort_keys=True)
    for obj in arch.all_objects:
        identifier=obj.get('xixova_id',''); relevant=[shot_id for shot_id,start,end,walls in shot_ranges if any(identifier==wall or identifier.startswith(wall+':') for wall in walls)]
        if relevant: obj['xixova_corte_tomas']=','.join(relevant)
    scene.frame_start=1; scene.frame_end=offset; scene.render.fps=data['proyecto']['produccion']['fps']
    scene.render.engine='CYCLES'; scene.cycles.use_denoising=True; scene.cycles.use_adaptive_sampling=True
    prefs=bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='CUDA'; prefs.get_devices()
        for device in prefs.devices: device.use=device.type=='CUDA'
        scene.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
    except Exception: scene.cycles.device='CPU'
    scene.view_settings.view_transform='AgX'; scene.view_settings.exposure=p['exposicion']; color=p.get('color',{})
    look=color.get('look')
    if look: scene.view_settings.look=('AgX - '+look) if look!='None' else 'None'
    if hasattr(scene.view_settings,'use_white_balance') and color.get('balance_blancos_k'):
        scene.view_settings.use_white_balance=True; scene.view_settings.white_balance_temperature=color['balance_blancos_k']; scene.view_settings.white_balance_tint=color.get('tinte',0)
    if hasattr(scene.render,'use_motion_blur'): scene.render.use_motion_blur=True
    if hasattr(scene.render,'motion_blur_shutter'): scene.render.motion_blur_shutter=.5
    post=p.get('postproduccion',{})
    if post.get('bloom',0)>0:
        scene.use_nodes=True; nodes=scene.node_tree.nodes; links=scene.node_tree.links; nodes.clear()
        layers=nodes.new('CompositorNodeRLayers'); glare=nodes.new('CompositorNodeGlare'); glare.glare_type='FOG_GLOW'; glare.quality='HIGH'; glare.threshold=1.1; glare.size=6; glare.mix=-1+post['bloom']
        composite=nodes.new('CompositorNodeComposite'); links.new(layers.outputs['Image'],glare.inputs['Image']); links.new(glare.outputs['Image'],composite.inputs['Image'])
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
