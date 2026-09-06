"""XIXOVA Atelier v4 — conserva la arquitectura de sala_fotografica v2.
Blender 4.5 LTS / Cycles CUDA. Primera entrega: dos fotografias y escena editable.
"""
import argparse
import hashlib
import json
import math
import random
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import atelier_base as B
import atelier_recursos as R

VERSION = '4.0.2-atelier'
EXTERNAL = set()
NEW = set()
WARM = (1.0, .82, .64)


def args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base', type=Path)
    p.add_argument('--sofa', type=Path, default=Path.home()/'RenderCasa/recursos_atelier/sofa.blend')
    p.add_argument('--planta', type=Path, help='Opcional: glTF/glb local en lugar de descargar Poly Haven')
    p.add_argument('--hdri', type=Path, help='Opcional: HDR/EXR local en lugar de descargar Poly Haven')
    p.add_argument('--modo', choices=['previa','foto','escena'], default='previa')
    p.add_argument('--toma', choices=['ambas','sala','comedor'], default='comedor')
    p.add_argument('--samples', type=int)
    p.add_argument('--giro-sofa', type=float, default=0, help='Giro adicional en grados; 180 si el respaldo queda delante')
    p.add_argument('--giro-exterior', type=float, default=160)
    p.add_argument('--exposicion', type=float, default=.3)
    p.add_argument('--luz-exterior', type=float, default=.30)
    p.add_argument('--luz-interior', type=float, default=1.0)
    p.add_argument('--cpu', action='store_true')
    p.add_argument('--salida', type=Path, default=ROOT/'resultados')
    a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if a.base is None:
        search = Path.home()/'RenderCasa/sala_fotografica_v2/sala_fotografica/salidas'
        found = list(search.glob('*/sala.blend'))
        if not found:
            p.error('No encuentro sala.blend de la version diurna. Usa --base /ruta/sala.blend')
        a.base = max(found,key=lambda f:f.stat().st_mtime)
    for name in ('base','sofa','planta','hdri','salida'):
        if getattr(a,name) is not None:
            setattr(a,name,getattr(a,name).expanduser().resolve())
    if not a.base.is_file(): p.error('No existe la escena base: '+str(a.base))
    a.ancho = 1280 if a.modo == 'previa' else 1920
    a.samples = a.samples if a.samples is not None else (128 if a.modo == 'previa' else 384)
    if not 1 <= a.samples <= 2048: p.error('Samples entre 1 y 2048')
    if not 0 <= a.luz_exterior <= 5 or not 0 <= a.luz_interior <= 5:
        p.error('Factores de luz entre 0 y 5')
    return a


def remove(obj):
    bpy.data.objects.remove(obj, do_unlink=True)


def prepare_base():
    arch = [c for c in bpy.data.collections if c.name.startswith('01 • Arquitectura aproximada')]
    if len(arch) != 1:
        raise RuntimeError('Base incompatible: se necesita sala.blend de sala_fotografica v2 con su coleccion arquitectonica original.')
    keep = set(arch[0].all_objects)
    for o in list(bpy.data.objects):
        if o not in keep or o.name.startswith(('Cortina','Piso social','Piso estar')):
            remove(o)
    B.COLLECTION = None
    B.M = {m.name:m for m in bpy.data.materials}
    required = {'Roble':'Roble fotografiado','Cal':'Pared mineral fotografiada',
                'Lino':'Tela lino marfil fotografiada','Oliva':'Tela oliva fotografiada',
                'Piedra':'Piedra fotografiada','Alfombra':'Tela alfombra fotografiada'}
    for alias,name in required.items():
        material = bpy.data.materials.get(name)
        if material is None:
            raise RuntimeError('La escena base no contiene el material fotografico requerido: '+name)
        B.M[alias] = material
    for name,col,rough,metal in [
        ('Atelier tinta',(.018,.033,.030),.65,0),('Atelier papel',(.66,.62,.53),.85,0),
        ('Atelier terracota',(.27,.075,.034),.58,0),('Atelier oliva',(.12,.16,.075),.8,0),
        ('Atelier metal',(.24,.17,.08),.32,.78),('Atelier grafito',(.012,.015,.014),.36,.2),
        ('Atelier ceramica',(.66,.63,.54),.28,0)]:
        B.mat(name,col,rough,metal)
    B.mat('Atelier difusor',(.9,.82,.68),.55,emission=.7)
    # El microrelieve de pared queda sutil; la luz rasante revela el material.
    wall = B.M['Cal']
    for n in wall.node_tree.nodes:
        if n.type == 'BUMP':
            n.inputs['Distance'].default_value=.00022
            n.inputs['Strength'].default_value=.18
        elif n.type == 'NORMAL_MAP': n.inputs['Strength'].default_value=.16
        elif n.type == 'MAP_RANGE':
            n.inputs['To Min'].default_value=.74
            n.inputs['To Max'].default_value=.88
    # Lino con transmision difusa moderada, sin brillo de plastico.
    curtain = B.M['Lino'].copy();curtain.name='Atelier lino cortina'
    n,l=curtain.node_tree.nodes,curtain.node_tree.links
    out=next(x for x in n if x.type=='OUTPUT_MATERIAL')
    source=out.inputs['Surface'].links[0].from_socket
    tr=n.new('ShaderNodeBsdfTranslucent');tr.inputs[0].default_value=(.62,.57,.47,1)
    mix=n.new('ShaderNodeMixShader');mix.inputs[0].default_value=.18
    l.new(source,mix.inputs[1]);l.new(tr.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],out.inputs['Surface'])
    B.M['Cortina']=curtain
    return keep.intersection(set(bpy.data.objects))


def geometry_points(objects):
    """Vertices evaluados: evita cajas infladas por piezas con rotaciones locales."""
    dg=bpy.context.evaluated_depsgraph_get()
    points=[]
    for obj in objects:
        if obj.type!='MESH': continue
        ev=obj.evaluated_get(dg)
        mesh=ev.to_mesh()
        try:
            points.extend(ev.matrix_world@v.co for v in mesh.vertices)
        finally:
            ev.to_mesh_clear()
    if not points: raise RuntimeError('Modelo externo sin geometria visible')
    return points


def point_bounds(points):
    return Vector([min(p[k] for p in points) for k in range(3)]),Vector([max(p[k] for p in points) for k in range(3)])


def bounds(objects):
    return point_bounds(geometry_points(objects))


def import_asset(path,name,center,maximum,angle=0,align_long=False):
    before=set(bpy.data.objects)
    if path.suffix.lower()=='.blend':
        with bpy.data.libraries.load(str(path),link=False) as (src,dst):
            dst.objects=list(src.objects)
        loaded=[o for o in dst.objects if o is not None]
        members={member for o in loaded if o.instance_collection for member in o.instance_collection.all_objects}
        for o in loaded:
            if o.type in ('LIGHT','CAMERA'): remove(o)
            elif o not in members: B.COLLECTION.objects.link(o)
    elif path.suffix.lower() in ('.glb','.gltf'):
        bpy.ops.import_scene.gltf(filepath=str(path))
    else: raise RuntimeError('Formato no admitido: '+str(path))
    added=set(bpy.data.objects)-before
    # BlenderKit puede entregar instancias de colecciones. Materializarlas una vez.
    instances=[o for o in added if o.instance_type=='COLLECTION' and o.instance_collection]
    if instances:
        bpy.ops.object.select_all(action='DESELECT')
        for o in instances: o.select_set(True)
        bpy.context.view_layer.objects.active=instances[0]
        bpy.ops.object.duplicates_make_real(use_base_parent=True,use_hierarchy=True)
        added=set(bpy.data.objects)-before
    # Solo objetos presentes en escena; el archivo puede contener dependencias no vinculadas.
    added={o for o in added if o.name in bpy.context.scene.objects}
    for o in list(added):
        if o.type in ('LIGHT','CAMERA'):
            added.remove(o);remove(o)
    for o in added:
        for c in list(o.users_collection): c.objects.unlink(o)
        B.COLLECTION.objects.link(o)
        o.hide_render=False;o.hide_set(False)
        o.name=name+' / '+o.name
    bpy.context.view_layer.update()
    meshes=[o for o in added if o.type=='MESH']
    original_points=geometry_points(meshes)
    lo,hi=point_bounds(original_points);dims=hi-lo
    if min(dims)<.001: raise RuntimeError('Dimensiones no validas de '+name)
    rotation=math.radians(angle)+(math.pi/2 if align_long and dims.y>dims.x else 0)
    rot=Matrix.Rotation(rotation,4,'Z')
    corners=[rot@p for p in original_points]
    low=Vector([min(p[k] for p in corners) for k in range(3)])
    high=Vector([max(p[k] for p in corners) for k in range(3)])
    extent=high-low
    scale=min(maximum[k]/extent[k] for k in range(3))
    offset=Vector((center[0],center[1],center[2]))-Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))*scale
    transform=Matrix.Translation(offset)@Matrix.Scale(scale,4)@rot
    # Transformar solo las raices conserva materiales, jerarquia y escala uniforme.
    for o in added:
        if o.parent not in added: o.matrix_world=transform@o.matrix_world
    bpy.context.view_layer.update()
    EXTERNAL.update(meshes)
    lo,hi=bounds(meshes)
    print(name+': original='+str([round(v,3) for v in dims])+' m; ajustado='+str([round(v,3) for v in hi-lo])+' m; escala='+str(round(scale,5)),flush=True)
    return meshes,{'dimensiones_originales_m':list(dims),'escala_uniforme':scale,'limites_m':list(maximum),'dimensiones_m':list(hi-lo),'minimo':list(lo),'maximo':list(hi),'giro_grados':math.degrees(rotation)}


def uv_meter(obj):
    # Proyeccion por cara en metros para madera/piedra/pintura. No toca UV importados.
    if obj.type!='MESH' or obj in EXTERNAL: return
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='Metros')
    for p in obj.data.polygons:
        axis=max(range(3),key=lambda k:abs(p.normal[k]))
        axes=(1,2) if axis==0 else ((0,2) if axis==1 else (0,1))
        for i in p.loop_indices:
            v=obj.data.vertices[obj.data.loops[i].vertex_index].co
            uv.data[i].uv=(v[axes[0]]+obj.location[axes[0]],v[axes[1]]+obj.location[axes[1]])


def curtain(name,x0,x1,y,phase):
    # Pano detallado estatico: pliegues amplios variables y dobladillo. No simulacion.
    nu,nv=80,56;verts=[];faces=[]
    for j in range(nv+1):
        t=j/nv
        for i in range(nu+1):
            u=i/nu
            fold=math.tau*(3.2*u+.05*math.sin(u*7+phase))
            amp=.022+.018*t
            x=x0+(x1-x0)*u+.015*t*math.sin(fold*.43+phase)
            yy=y+amp*math.sin(fold+.12*t)+.010*t*t*math.sin(u*13+phase)
            z=2.49-2.445*t+.008*t**7*math.sin(fold+.7)
            verts.append((x,yy,z))
            if j<nv and i<nu:
                a=j*(nu+1)+i;faces.append((a,a+1,a+nu+2,a+nu+1))
    o=B.mesh(name,verts,faces,'Cortina')
    uv=o.data.uv_layers.new(name='Metros')
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            vi=o.data.loops[li].vertex_index
            uv.data[li].uv=((vi%(nu+1))/nu*(x1-x0)*1.5,(vi//(nu+1))/nv*2.445)
    o['uv_manual']=True
    sub=o.modifiers.new('Suavizado textil','SUBSURF');sub.levels=1;sub.render_levels=1
    solid=o.modifiers.new('Espesor lino','SOLIDIFY');solid.thickness=.0007
    hem=[verts[nv*(nu+1)+i] for i in range(nu+1)]
    B.tube(name+' costura inferior',hem,.0014,'Lino')
    return o


def oval(name,loc,rx,ry,depth,material):
    obj=B.cyl(name,loc,1,depth,material,vertices=96)
    obj.scale.x=rx;obj.scale.y=ry
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.select_set(False)
    return obj


def chair(cx,cy,angle):
    # Silla de roble propia, con asiento curvo y respaldo envolvente, escala real.
    start=set(bpy.data.objects)
    for x in (-.19,.19):
        for y in (-.18,.18):
            B.rod('Atelier silla pata',(x*1.1,y*1.13,.02),(x,y,.46),.018,'Roble')
    oval('Atelier silla asiento',(0,0,.46),.245,.23,.045,'Lino')
    for x in (-.19,.19): B.rod('Atelier silla montante',(x,.16,.42),(x,.20,.79),.016,'Roble')
    vs=[];fs=[]
    for j,z in enumerate((.65,.84)):
        for i in range(33):
            t=-1+2*i/32
            vs.append((.255*t,.20-.085*t*t,z+.018*(1-t*t)))
    for i in range(32): fs.append((i,i+1,34+i,33+i))
    o=B.mesh('Atelier silla respaldo',vs,fs,'Roble')
    s=o.modifiers.new('Madera curvada','SOLIDIFY');s.thickness=.018
    b=o.modifiers.new('Canto redondo','BEVEL');b.width=.005;b.segments=3
    matrix=Matrix.Translation((cx,cy,0))@Matrix.Rotation(math.radians(angle),4,'Z')
    for o in set(bpy.data.objects)-start: o.matrix_world=matrix@o.matrix_world


def bookshelf():
    # Biblioteca al fondo del comedor, visible en la toma de sala como transicion.
    x0,x1=3.48,4.43;y=5.77
    B.box('Atelier libreria fondo',((x0+x1)/2,5.916,1.27),(.95,.025,2.48),'Roble',.003)
    for x in (x0,x1): B.box('Atelier libreria costado',(x,y,1.27),(.028,.31,2.48),'Roble',.004)
    for z in (.045,.62,1.12,1.63,2.14,2.50):
        B.box('Atelier libreria estante',((x0+x1)/2,y,z),(.95,.32,.025),'Roble',.003)
    for x in (3.725,4.19):
        B.box('Atelier libreria puerta',(x,5.595,.33),(.452,.025,.53),'Roble',.003)
    rng=random.Random(987)
    for level,z in enumerate((.642,1.142,1.652,2.162)):
        x=x0+.07
        for i in range(7 if level%2==0 else 4):
            w=rng.uniform(.026,.055);h=rng.uniform(.20,.32)
            m=('Atelier papel','Atelier tinta','Atelier terracota','Atelier oliva')[rng.randrange(4)]
            B.box('Atelier libro paginas',(x+w/2,5.76,z+h/2),(w-.005,.17,h-.007),'Atelier papel',.001)
            B.box('Atelier libro lomo',(x+w/2,5.672,z+h/2),(w,.006,h),m,.002)
            x+=w+.006
        B.vase('Atelier ceramica biblioteca',(4.20,5.76,z),.18,.057,'Atelier ceramica')
    # Emisor bajo dos estantes, dirigido a la pared posterior de la biblioteca.
    for z in (1.10,2.12):
        B.box('Atelier perfil LED',(3.95,5.63,z),(.78,.012,.009),'Atelier difusor',.002)
        B.light('Atelier LED biblioteca',(3.95,5.66,z-.015),(3.95,5.87,z-.32),1.2,WARM,.74,'RECTANGLE',.02)


def art():
    for k,x in enumerate((5.25,6.00)):
        B.box('Atelier marco',(x,5.916,1.73),(.63,.035,.80),'Roble',.004)
        B.box('Atelier paspartu',(x,5.892,1.73),(.594,.012,.764),'Atelier papel',.001)
        # Bajorrelieve propio con circulos y arco; no imagen generada que finja ser render.
        o=B.cyl('Atelier relieve circular',(x-.07,5.877,1.82),.17,.016,'Atelier oliva' if k else 'Atelier ceramica',vertices=96)
        o.rotation_euler.x=math.pi/2
        points=[(x-.20+.40*t,5.866,1.49+.05*math.sin(t*math.pi)) for t in [i/64 for i in range(65)]]
        for row in range(5): B.tube('Atelier relieve linea',[(a,b,c+row*.018) for a,b,c in points],.002,'Atelier terracota')


def decor():
    B.collection('Atelier / carpinteria y decoracion')
    B.floor_tiles('Atelier piso comedor',1.8,4.4,1.7,6,'Roble')
    B.floor_tiles('Atelier piso sala',4.4,7.5,3.7,6,'Roble')
    B.floor_tiles('Atelier piso cocina',0,1.8,1.7,6,'Piedra')
    # Alfombra plana con ribete, sin puntos/fibras sobredimensionadas.
    B.box('Atelier alfombra',(5.65,4.77,.013),(2.42,1.55,.022),'Alfombra',.035)
    # Consola de 28 cm de fondo: menos masa visual y mas circulacion.
    B.box('Atelier consola cuerpo',(5.54,3.94,.41),(1.82,.28,.36),'Roble',.009)
    for x in (4.94,5.54,6.14):
        B.box('Atelier consola frente',(x,4.086,.40),(.588,.018,.32),'Roble',.005)
    B.box('Atelier TV',(5.52,3.797,1.40),(1.10,.027,.63),'Atelier grafito',.008)
    oval('Atelier mesa centro',(5.54,4.53,.40),.52,.31,.038,'Piedra')
    oval('Atelier base mesa',(5.54,4.53,.195),.27,.18,.37,'Roble')
    B.book('Atelier libro mesa',(5.39,4.55,.428),.20,.14,.022,'Oliva',angle=-12)
    B.bowl('Atelier cuenco',(5.73,4.51,.422),.065,'Atelier ceramica')
    # Mesa auxiliar y lampara baja, para no tapar los cuadros.
    oval('Atelier mesa lateral',(4.43,5.40,.47),.20,.20,.035,'Roble')
    B.cyl('Atelier pedestal lateral',(4.43,5.40,.23),.065,.44,'Roble')
    B.vase('Atelier pie lampara',(4.43,5.40,.49),.19,.070,'Atelier terracota')
    B.lathe('Atelier pantalla lampara',(4.43,5.40,.71),[(.16,0),(.115,.22),(.111,.22),(.156,0)],'Cortina')
    B.light('Atelier lectura',(4.43,5.40,.74),(4.43,5.40,.48),9,WARM,.15)
    bookshelf();art()
    # Comedor equipado, no una mesa vacia sin sillas.
    B.box('Atelier mesa comedor',(2.86,3.08,.755),(.90,1.40,.035),'Roble',.09)
    for x in (2.53,3.19):
        for y in (2.54,3.62): B.rod('Atelier pata comedor',(x,y,.025),(x,y,.737),.026,'Roble')
    chair(2.86,2.13,180);chair(2.86,4.03,0)
    for y in (2.69,3.47):
        B.lathe('Atelier plato',(2.86,y,.777),[(0,0),(.09,0),(.118,.012),(.12,.021),(.114,.024),(.083,.009),(0,.009)],'Atelier ceramica')
        B.cyl('Atelier vaso',(3.15,y,.835),.030,.112,'Vidrio',vertices=48)
        B.box('Atelier servilleta',(2.56,y,.782),(.13,.19,.006),'Lino',.003)
    B.vase('Atelier florero comedor',(2.86,3.08,.78),.21,.067,'Atelier terracota')
    B.rod('Atelier cable colgante',(2.86,3.08,2.67),(2.86,3.08,2.17),.003,'Atelier grafito')
    B.lathe('Atelier colgante',(2.86,3.08,2.04),[(.27,0),(.25,.04),(.17,.16),(.07,.22),(.067,.215),(.163,.154),(.244,.035),(.265,0)],'Atelier ceramica')
    B.light('Atelier comedor',(2.86,3.08,2.07),(2.86,3.08,.76),25,WARM,.38)
    # Detalle de terraza, fuera del paso central.
    B.box('Atelier banco terraza',(1.0,.68,.43),(1.28,.42,.07),'Roble',.015)
    for x in (.51,1.49): B.box('Atelier banco soporte',(x,.68,.22),(.07,.32,.42),'Roble',.008)
    # Dos panos retirados hacia los extremos conservan la abertura central.
    curtain('Atelier cortina izquierda',1.86,2.28,1.91,.3)
    curtain('Atelier cortina derecha',3.94,4.35,1.91,1.9)
    B.rod('Atelier riel cortina',(1.83,1.91,2.515),(4.37,1.91,2.515),.010,'Atelier grafito')


def environment(scene,a,path):
    w=bpy.data.worlds.new('Atelier / fotografia urbana al atardecer');w.use_nodes=True;scene.world=w
    n,l=w.node_tree.nodes,w.node_tree.links;n.clear()
    out=n.new('ShaderNodeOutputWorld');bg=n.new('ShaderNodeBackground')
    env=n.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(path),check_existing=True)
    coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeMapping')
    mapping.inputs['Rotation'].default_value[2]=math.radians(a.giro_exterior)
    l.new(coord.outputs['Generated'],mapping.inputs['Vector'])
    l.new(mapping.outputs[0],env.inputs['Vector']);l.new(env.outputs[0],bg.inputs['Color'])
    bg.inputs['Strength'].default_value=a.luz_exterior;l.new(bg.outputs[0],out.inputs['Surface'])
    B.collection('Atelier / luz ambiental')
    # Fuente visible y localizada. El HDRI aporta el contraste frio desde terraza.
    B.box('Atelier foseado',(5.65,5.80,2.48),(2.50,.24,.04),'Cal',.005)
    B.box('Atelier tira indirecta',(5.65,5.74,2.505),(2.25,.014,.006),'Atelier difusor',.002)
    B.light('Atelier rebote techo',(5.65,5.73,2.52),(5.65,5.48,2.70),22,WARM,2.15,'RECTANGLE',.08)
    # Luz de acento sobre arte: suave y bastante menos intensa que la version nocturna.
    B.cyl('Atelier foco carcasa',(5.62,5.15,2.65),.046,.08,'Atelier grafito')
    B.light('Atelier acento arte',(5.62,5.16,2.59),(5.62,5.88,1.72),6,WARM,.12)
    # Luz funcional visible en el tramo de circulacion, sin abrir muros.
    B.cyl('Atelier plafon pasillo',(7.90,4.10,2.66),.105,.045,'Atelier ceramica')
    B.cyl('Atelier difusor pasillo',(7.90,4.10,2.633),.085,.006,'Atelier difusor')
    B.light('Atelier luz pasillo',(7.90,4.10,2.62),(7.90,4.10,.25),14,WARM,.17)
    for obj in scene.objects:
        if obj.type=='LIGHT': obj.data.energy*=a.luz_interior
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=a.exposicion
    scene.render.film_transparent=False


def cameras(scene,sofa):
    B.collection('Atelier / camaras')
    result={};report={}
    for key,pos,target,lens,shift in [
        ('sala',(2.85,4.05,1.18),(5.55,5.23,1.18),21,-.045),
        ('comedor',(4.05,5.24,1.42),(2.79,2.51,1.42),25,-.04)]:
        d=bpy.data.cameras.new('Atelier '+key);o=bpy.data.objects.new('Atelier '+key,d);B.COLLECTION.objects.link(o)
        o.location=pos;B.aimed(o,target);d.lens=lens;d.sensor_width=36
        d.shift_y=shift;d.clip_start=.03;d.clip_end=500;d.dof.use_dof=False
        bpy.context.view_layer.update();result[key]=o
        report[key]={'posicion':pos,'objetivo':target,'focal_mm':lens,'shift_y':shift}
    points=[o.matrix_world@Vector(c) for o in sofa for c in o.bound_box]
    cam=result['sala']
    for lens in (21,20,19):
        cam.data.lens=lens;bpy.context.view_layer.update()
        q=[world_to_camera_view(scene,cam,p) for p in points]
        if all(p.z>0 and .012<p.x<.988 and .012<p.y<.988 for p in q): break
    report['sala']['focal_mm']=cam.data.lens
    report['sala']['sofa_dentro_encuadre']=all(p.z>0 and 0<p.x<1 and 0<p.y<1 for p in q)
    report['nota']='Comprobacion de proyeccion; revisar oclusiones, orientacion del sofa y composicion en las previas.'
    return result,report


def main():
    a=args()
    if bpy.app.version[:2]!=(4,5): raise RuntimeError('Usa Blender 4.5 LTS para esta version.')
    # Preparar recursos antes de tocar la escena en memoria. La base nunca se sobrescribe.
    print('PREPARANDO RECURSOS: sofa local, planta fotografica y entorno HDRI',flush=True)
    resources=R.prepare(a.sofa,a.planta,a.hdri)
    stamp=time.strftime('%Y%m%d_%H%M%S')
    out=a.salida/(a.modo+'_'+stamp)
    out.mkdir(parents=True,exist_ok=False)
    lock=B.acquire_lock(out);monitor=B.Monitor(out)
    info={'version':VERSION,'estado':'preparando','base':str(a.base),'tomas':{},
          'supuestos':['Distribucion aproximada del XIXOVA heredada de v2; no es un plano ejecutivo.',
                        'Decoracion propia; el exterior es conceptual, no la vista del inmueble.',
                        'Primero validar estas dos fotografias; esta entrega no renderiza el video.'],
          'config':{k:str(v) if isinstance(v,Path) else v for k,v in vars(a).items()}}
    try:
        print('ABRIENDO BASE Y RENOVANDO DECORACION',flush=True)
        bpy.ops.wm.open_mainfile(filepath=str(a.base),load_ui=False,use_scripts=False)
        scene=bpy.context.scene
        scene.render.engine='CYCLES';info['dispositivo']=B.choose_device(a.cpu)
        prepare_base();scene.use_nodes=False;scene.render.use_sequencer=False
        old=set(bpy.data.objects)
        B.collection('Atelier / recursos de autor')
        sofa,info['sofa']=import_asset(a.sofa,'Atelier sofa',(5.75,5.405,.012),(2.18,.95,1.12),a.giro_sofa,True)
        sofa_size=info['sofa']['dimensiones_m']
        if sofa_size[0]<1.90 or sofa_size[2]<.65:
            warning=('Este sofa no cabe a escala adecuada: ancho %.2f m, altura total %.2f m. '
                     'Para la sala usa --sofa /ruta/sofa_recto.blend con un sofa recto sin chaise longue. '
                     'La toma comedor permite comprobar el exterior con el recurso anterior.') % (sofa_size[0],sofa_size[2])
            info.setdefault('avisos',[]).append(warning)
            if a.toma!='comedor':
                raise RuntimeError(warning)
            print('AVISO: '+warning,flush=True)
        info['sofa']['validado_para_sala']=sofa_size[0]>=1.90 and sofa_size[2]>=.65
        plant,info['planta']=import_asset(Path(resources['planta']['archivo']),'Atelier planta',(7.145,5.51,.015),(.54,.72,1.45))
        decor();environment(scene,a,Path(resources['hdri']['archivo']))
        for o in set(bpy.data.objects)-old:
            if not o.get('uv_manual'): uv_meter(o)
        # Conservar UV de recursos externos, reducir solo imagenes excesivas del sofa.
        asset_images=set()
        for o in EXTERNAL:
            for slot in o.material_slots:
                if slot.material and slot.material.use_nodes:
                    for n in slot.material.node_tree.nodes:
                        if n.type=='TEX_IMAGE' and n.image: asset_images.add(n.image)
        for img in asset_images:
            if img.size[0]==0 or img.size[1]==0:
                raise RuntimeError('Textura externa ausente: '+img.name+'. Empaca las texturas al exportar el sofa.')
            if max(img.size)>2048:
                f=2048/max(img.size);img.scale(max(1,round(img.size[0]*f)),max(1,round(img.size[1]*f)))
        scene.render.resolution_x=a.ancho;scene.render.resolution_y=a.ancho*9//16
        scene.render.resolution_percentage=100
        scene.cycles.samples=a.samples;scene.cycles.use_adaptive_sampling=True
        scene.cycles.adaptive_min_samples=min(32,a.samples)
        scene.cycles.adaptive_threshold=.018 if a.modo=='previa' else .006
        scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE'
        if hasattr(scene.cycles,'denoising_use_gpu'): scene.cycles.denoising_use_gpu=False
        scene.cycles.max_bounces=10;scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=4
        scene.cycles.transmission_bounces=8;scene.cycles.sample_clamp_indirect=10
        scene.render.use_persistent_data=False
        scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_depth='16'
        scene.render.image_settings.color_mode='RGB'
        cams,info['camaras']=cameras(scene,sofa)
        scene.camera=cams['comedor' if a.toma=='comedor' else 'sala'];scene.render.filepath=str(out/('02_comedor_atelier.png' if a.toma=='comedor' else '01_sala_atelier.png'))
        scene.render.fps=24;scene.frame_start=1;scene.frame_end=480;scene.frame_set(1)
        info['nota_animacion']='Rango de 20 s reservado. Camaras estaticas; no hay recorrido animado en esta version.'
        bpy.ops.file.pack_all()
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(out/'xixova_atelier.blend'))
        B.atomic_json(out/'recursos.json',resources)
        for name in ('CREDITOS.md',): (out/name).write_bytes((ROOT/name).read_bytes())
        if a.modo!='escena':
            monitor.start()
            for key,filename in [('sala','01_sala_atelier.png'),('comedor','02_comedor_atelier.png')]:
                if a.toma not in ('ambas',key): continue
                print('RENDER ATELIER: '+key,flush=True)
                scene.camera=cams[key];scene.render.filepath=str(out/filename)
                start=time.perf_counter();bpy.ops.render.render(write_still=True)
                if not B.png_valid(out/filename,a.ancho,a.ancho*9//16): raise RuntimeError('PNG incompleto: '+key)
                info['tomas'][key]={'archivo':filename,'segundos':round(time.perf_counter()-start,3)}
                B.atomic_json(out/'informe_atelier.json',info)
        info['estado']='terminado'
        print('\nRESULTADOS: '+str(out),flush=True)
    except BaseException as exc:
        info['estado']='error';info['error']=str(exc);raise
    finally:
        monitor.close();info['picos_gpu']=monitor.peaks
        info['nota_gpu']='Muestreo global cada 2 segundos; no equivale al consumo exclusivo de Blender.'
        B.atomic_json(out/'informe_atelier.json',info);lock.unlink(missing_ok=True)


if __name__=='__main__': main()
