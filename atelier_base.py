"""Geometría arquitectónica y utilidades internas de sala_fotografica.py.
No es un programa independiente. Distribución conceptual, no un plano ejecutivo.
"""

import argparse


import csv


import hashlib


import json


import math


import os


import platform


import random


import shutil


import struct


import subprocess


import sys


import threading


import time


from pathlib import Path


import bpy


from mathutils import Vector


VERSION = '1.0.0'


FPS, FRAMES, HEIGHT = 24, 480, 2.70


ROOT = Path(__file__).resolve().parent


M = {}


WALLS = []


COLLECTION = None


def collection(name):
    global COLLECTION
    COLLECTION = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(COLLECTION)


def finish(obj, name, mat=None, smooth=False):
    obj.name = name
    if COLLECTION:
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        COLLECTION.objects.link(obj)
    if mat:
        obj.data.materials.append(M[mat] if isinstance(mat, str) else mat)
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def mesh(name, verts, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    (COLLECTION or bpy.context.scene.collection).objects.link(obj)
    if mat:
        data.materials.append(M[mat] if isinstance(mat, str) else mat)
    if smooth:
        for p in data.polygons:
            p.use_smooth = True
    return obj


def box(name, loc, size, mat, bevel=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = finish(bpy.context.object, name, mat)
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Aristas suaves', 'BEVEL')
        mod.width = min(bevel, min(size) * 0.45)
        mod.segments = 3
        mod = o.modifiers.new('Normales ponderadas', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return o


def cyl(name, loc, radius, depth, mat, r2=None, vertices=48):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if r2 is None else r2, depth=depth, location=loc)
    o = finish(bpy.context.object, name, mat)
    for p in o.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    mod = o.modifiers.new('Bisel fino', 'BEVEL')
    mod.width, mod.segments = min(0.009, depth * 0.1), 2
    o.modifiers.new('Normales', 'WEIGHTED_NORMAL')
    return o


def tube(name, points, radius, mat, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions, data.resolution_u = '3D', 2
    data.bevel_depth, data.bevel_resolution = radius, 2
    spl = data.splines.new('POLY')
    spl.points.add(len(points) - 1)
    for p, co in zip(spl.points, points):
        p.co = (*co, 1)
    spl.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, data)
    (COLLECTION or bpy.context.scene.collection).objects.link(o)
    data.materials.append(M[mat])
    return o


def rod(name, a, b, radius, mat):
    o = cyl(name, (Vector(a) + Vector(b)) / 2, radius, (Vector(b) - Vector(a)).length, mat, vertices=20)
    o.rotation_euler = (Vector(b) - Vector(a)).to_track_quat('Z', 'Y').to_euler()
    return o


def lathe(name, loc, profile, mat, n=48):
    # El perfil recorre exterior, borde e interior: vajilla realmente hueca.
    verts = [(r * math.cos(j * math.tau/n), r * math.sin(j * math.tau/n), z)
             for r, z in profile for j in range(n)]
    faces = []
    for k in range(len(profile)-1):
        for j in range(n):
            a, b = k*n+j, k*n+(j+1)%n
            faces.append((a, b, b+n, a+n))
    o = mesh(name, verts, faces, mat)
    o.location = loc
    return o


def aimed(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def light(name, loc, target, power, color=(1,0.78,0.55), size=1, shape='DISK', size_y=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color
    d.shape=shape;d.size=size
    if size_y is not None: d.size_y=size_y
    o=bpy.data.objects.new(name,d)
    (COLLECTION or bpy.context.scene.collection).objects.link(o)
    o.location=loc;aimed(o,target)
    return o


def mat(name, color, rough=0.5, metal=0, kind=None, emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True
    n,l=m.node_tree.nodes,m.node_tree.links
    p=n.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if kind=='glass':
        p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.45
    if kind=='fabric':
        p.inputs['Sheen Weight'].default_value=0.30
        p.inputs['Sheen Roughness'].default_value=0.7
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    if kind in ('wood','stone','plaster','fabric','rug','leaf'):
        tc=n.new('ShaderNodeTexCoord')
        mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY'
        mapping.inputs[1].default_value={'wood':(3,65,7),'stone':(3,3,3),
            'plaster':(2,2,2),'fabric':(150,150,150),'rug':(110,110,110),'leaf':(3,3,3)}[kind]
        l.new(tc.outputs['Object'],mapping.inputs[0])
        noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1
        noise.inputs['Detail'].default_value=3 if kind in ('wood','stone') else 2
        noise.inputs['Roughness'].default_value=0.7
        l.new(mapping.outputs['Vector'],noise.inputs['Vector'])
        ramp=n.new('ShaderNodeValToRGB')
        factor=0.55 if kind=='wood' else (0.82 if kind in ('fabric','plaster','rug') else 0.70)
        ramp.color_ramp.elements[0].position=0.15
        ramp.color_ramp.elements[0].color=(*(v*factor for v in color),1)
        ramp.color_ramp.elements[1].position=0.85
        ramp.color_ramp.elements[1].color=(*color,1)
        l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],p.inputs['Base Color'])
        fine=n.new('ShaderNodeTexNoise');fine.inputs['Scale'].default_value=90 if kind=='wood' else 160
        fine.inputs['Detail'].default_value=2
        l.new(tc.outputs['Object'],fine.inputs['Vector'])
        bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=0.24
        bump.inputs['Distance'].default_value=0.0008 if kind in ('stone','wood') else 0.0012
        l.new(fine.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
        if kind in ('fabric','rug'):
            wave=n.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='X'
            wave.inputs['Scale'].default_value=220
            l.new(tc.outputs['Object'],wave.inputs['Vector'])
            weave=n.new('ShaderNodeBump');weave.inputs['Distance'].default_value=0.0005
            weave.inputs['Strength'].default_value=0.12
            l.new(wave.outputs['Color'],weave.inputs['Height']);l.new(bump.outputs['Normal'],weave.inputs['Normal'])
            l.new(weave.outputs['Normal'],p.inputs['Normal'])
    M[name]=m
    return m


def materials():
    mat('Cal',(.67,.61,.51),.82,kind='plaster')
    mat('Techo',(.79,.76,.68),.9)
    mat('Roble',(.34,.22,.115),.40,kind='wood')
    mat('Nogal',(.135,.073,.035),.38,kind='wood')
    mat('Travertino',(.59,.49,.36),.42,kind='stone')
    mat('Porcelanato',(.68,.65,.57),.42,kind='stone')
    mat('Lino',(.64,.56,.43),.88,kind='fabric')
    mat('Marfil',(.82,.77,.65),.85,kind='fabric')
    mat('Oliva',(.15,.20,.105),.88,kind='fabric')
    mat('Arcilla',(.35,.13,.073),.86,kind='fabric')
    mat('Alfombra',(.51,.43,.31),.95,kind='rug')
    mat('Laton',(.54,.33,.13),.26,.75)
    mat('Grafito',(.025,.029,.026),.3,.6)
    mat('Acero',(.51,.55,.57),.22,.95)
    mat('Vidrio',(.96,.99,1),.035,kind='glass')
    mat('Terracota',(.35,.105,.045),.38,kind='stone')
    mat('Ceramica',(.71,.65,.52),.25,kind='stone')
    mat('Hojas',(.065,.14,.045),.52,kind='leaf')
    mat('Tierra',(.06,.032,.016),.96)
    mat('Paginas',(.70,.65,.53),.8)
    mat('ArteBlanco',(.73,.70,.64),.9,kind='plaster')
    mat('ArteNegro',(.025,.038,.028),.8)
    mat('LED',(1,.63,.28),.4,emission=4)
    mat('PantallaTV',(.018,.024,.02),.22)
    mat('Exterior',(.33,.39,.38),.92)
    mat('ExteriorClaro',(.58,.55,.47),.94)


def wall(name, a, b, bottom=0, top=HEIGHT, thick=.12, matname='Cal'):
    dx,dy=b[0]-a[0],b[1]-a[1]
    length=math.hypot(dx,dy)
    o=box(name,((a[0]+b[0])/2,(a[1]+b[1])/2,(bottom+top)/2),
          (length,thick,top-bottom),matname,.006)
    o.rotation_euler.z=math.atan2(dy,dx)
    WALLS.append((a,b,bottom,top,thick))
    return o


def floor_tiles(name, x0,x1,y0,y1,material='Porcelanato',step=.9,z=-.025):
    if material=='Roble':
        x=x0;row=0
        while x<x1-.001:
            w=min(.17,x1-x);y=y0
            first=min(.42 if row%2 else .94,y1-y)
            while y<y1-.001:
                h=min(first if y==y0 else .94,y1-y)
                box(name,(x+w/2,y+h/2,z),(w-.002,h-.002,.05),material,.002)
                y+=h
            row+=1;x+=w
        return
    x=x0
    while x<x1-.001:
        w=min(step,x1-x);y=y0
        while y<y1-.001:
            h=min(step,y1-y)
            box(name,(x+w/2,y+h/2,z),(w-.003,h-.003,.05),material,.002)
            y+=step
        x+=step


def window_y(name,x0,x1,y,z0,z1,opened=False):
    # Marco, dintel y hojas; apertura central en correderas de la terraza.
    for x in (x0,x1): box(name+' jamba',(x,y,(z0+z1)/2),(.045,.075,z1-z0),'Grafito',.004)
    for z in (z0,z1): box(name+' carril',((x0+x1)/2,y,z),(x1-x0,.075,.035),'Grafito',.004)
    count=4 if opened else 3
    width=(x1-x0)/count
    for i in range(count):
        if opened and i in (1,2):continue
        x=x0+width*(i+.5)
        box(name+' vidrio',(x,y,(z0+z1)/2),(width-.055,.01,z1-z0-.06),'Vidrio',0)
        box(name+' montante',(x0+(i+1)*width,y,(z0+z1)/2),(.028,.065,z1-z0),'Grafito',.002)


def curtain(name,x0,x1,y,z_top=2.58,z_bottom=.04):
    # Una superficie ondulada y fina, no un bloque con textura.
    nx,ny=48,20;verts=[];faces=[]
    for j in range(ny+1):
        t=j/ny
        for i in range(nx+1):
            u=i/nx
            x=x0+(x1-x0)*u
            yy=y+.043*math.sin(u*math.tau*7)+.015*math.sin(t*3+u*13)
            z=z_top+(z_bottom-z_top)*t+.008*math.sin(u*23)*t
            verts.append((x,yy,z))
    for j in range(ny):
        for i in range(nx):
            k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
    o=mesh(name,verts,faces,'Marfil')
    s=o.modifiers.new('Espesor tela','SOLIDIFY');s.thickness=.001
    return o


def shell():
    collection('01 • Arquitectura aproximada')
    floor_tiles('Piso social',0,4.4,1.7,6)
    floor_tiles('Piso estar',4.4,7.5,3.7,6)
    floor_tiles('Piso circulacion',7.5,8.95,3.5,6)
    floor_tiles('Piso suite principal',4.4,7.5,1.08,3.7,material='Roble',step=.45)
    floor_tiles('Piso bano principal',7.5,8.95,1.08,3.5)
    floor_tiles('Piso suite secundaria',8.95,11.5,1.08,6)
    floor_tiles('Piso balcon',0,7.5,0,1.7,material='Travertino',step=.75,z=-.04)
    # Techo completo a 2.70 m, con alero del balcon.
    box('Techo social',(2.2,3.85,2.76),(4.4,4.3,.12),'Techo',0)
    box('Techo estar',(5.95,4.85,2.76),(3.1,2.3,.12),'Techo',0)
    box('Techo principal',(5.95,2.39,2.76),(3.1,2.62,.12),'Techo',0)
    box('Techo ala derecha',(9.50,3.54,2.76),(4.0,4.92,.12),'Techo',0)
    box('Alero balcon oeste',(2.2,.85,2.76),(4.4,1.7,.12),'Techo',0)
    box('Alero balcon este',(5.95,.54,2.76),(3.1,1.08,.12),'Techo',0)
    wall('Fondo',(0,6),(11.5,6))
    wall('Lateral cocina',(0,1.7),(0,6))
    wall('Lateral suite',(11.5,1.08),(11.5,6))
    wall('Suite principal lateral',(4.4,1.7),(4.4,3.7))
    wall('TV / suite',(4.4,3.7),(6.64,3.7))
    wall('Dintel puerta suite',(6.64,3.7),(7.5,3.7),bottom=2.20)
    wall('Division bano',(7.5,1.08),(7.5,2.62))
    wall('Dintel bano',(7.5,2.62),(7.5,3.5),bottom=2.20)
    wall('Bano frente',(7.5,3.5),(8.95,3.5))
    wall('Division segunda suite',(8.95,1.08),(8.95,3.72))
    wall('Dintel segunda suite',(8.95,3.72),(8.95,4.6),bottom=2.2)
    wall('Division lavabo',(7.5,4.6),(7.5,6))
    wall('Lavabo frontal',(7.5,4.6),(7.85,4.6))
    wall('Dintel lavabo',(7.85,4.6),(8.65,4.6),bottom=2.2)
    wall('Lavabo extremo',(8.65,4.6),(8.95,4.6))
    wall('Lavabo lateral',(8.95,4.6),(8.95,6))
    wall('Bano suite secundaria',(8.95,4.6),(10.48,4.6))
    wall('Dintel bano secundario',(10.48,4.6),(11.36,4.6),bottom=2.2)
    wall('Antepecho suite',(4.4,1.08),(7.5,1.08),top=.80)
    wall('Dintel ventana suite',(4.4,1.08),(7.5,1.08),bottom=2.45)
    window_y('Ventana suite',4.48,7.42,1.08,.82,2.44)
    wall('Antepecho suite 2',(8.95,1.08),(11.5,1.08),top=.8)
    wall('Dintel ventana 2',(8.95,1.08),(11.5,1.08),bottom=2.45)
    window_y('Ventana suite 2',9.03,11.42,1.08,.82,2.44)
    wall('Paso terraza dintel',(1.8,1.7),(4.4,1.7),bottom=2.42)
    window_y('Corredera terraza',1.84,4.36,1.7,.025,2.4,opened=True)
    curtain('Cortina comedor',1.85,2.13,1.90)
    curtain('Cortina suite izquierda',4.48,4.88,1.25)
    curtain('Cortina suite derecha',6.97,7.42,1.25)
    # Baranda abierta al exterior; altura 1.10 m adoptada solo para el demo.
    for x in (.08,1.55,3.05,4.55,6.05,7.48):
        box('Poste baranda',(x,-.035,.56),(.033,.05,1.10),'Grafito',.003)
    box('Pasamanos',(3.75,-.035,1.13),(7.5,.07,.045),'Grafito',.006)
    box('Vidrio baranda',(3.75,-.035,.58),(7.4,.012,1.02),'Vidrio',0)
    wall('Lateral parrilla',(0,0),(0,1.7))
    wall('Terraza tecnico',(7.5,0),(7.5,1.08))
    # Zocalos discretos.
    box('Zocalo fondo',(3.75,5.918,.055),(7.5,.025,.11),'Roble',.003)
    box('Zocalo sala',(5.5,3.772,.055),(2.2,.025,.11),'Roble',.003)


def vase(name,loc,height=.28,radius=.10,matname='Ceramica'):
    h,r=height,radius
    return lathe(name,loc,[(0,0),(r*.7,0),(r,.12*h),(r*.94,.55*h),
        (r*.56,.86*h),(r*.53,h),(r*.43,h),(r*.46,.86*h),
        (r*.80,.53*h),(r*.85,.13*h),(0,.04*h)],matname)


def bowl(name,loc,r=.12,matname='Ceramica'):
    return lathe(name,loc,[(0,0),(.5*r,0),(.85*r,.22*r),(r,.55*r),
        (.95*r,.59*r),(.79*r,.28*r),(.45*r,.06*r),(0,.06*r)],matname)


def plant(name,loc,height=.9,radius=.19):
    x,y,z=loc
    vase(name+' maceta',(x,y,z),height*.28,radius,'Terracota')
    cyl(name+' tierra',(x,y,z+height*.22),radius*.80,.012,'Tierra',vertices=24)
    base=Vector((x,y,z+height*.23))
    for j in range(14):
        ang=j*2.39996
        reach=height*(.21+.05*(j%3));hh=height*(.42+.032*j)
        end=base+Vector((reach*math.cos(ang),reach*math.sin(ang),hh))
        tube(name+' tallo',[base,base.lerp(end,.55)+Vector((0,0,.09)),end],.0035,'Hojas')
        side=Vector((-math.sin(ang),math.cos(ang),0))
        forward=Vector((math.cos(ang),math.sin(ang),.1))
        verts=[]
        for k in range(9):
            t=k/8
            center=end+forward*(t*height*.22)+Vector((0,0,height*.06*math.sin(t*math.pi)))
            w=height*.075*math.sin(t*math.pi)**.8
            verts.extend([tuple(center-side*w),tuple(center+Vector((0,0,.007))),tuple(center+side*w)])
        faces=[]
        for k in range(8):
            a=k*3;faces.extend([(a,a+3,a+4,a+1),(a+1,a+4,a+5,a+2)])
        mesh(name+' hoja',verts,faces,'Hojas')


def book(name,loc,w=.24,d=.18,h=.035,color='Oliva',angle=0):
    parts=[]
    parts.append(box(name+' paginas',loc,(w-.008,d-.008,h-.006),'Paginas',.003))
    for dz in (-h/2,h/2):parts.append(box(name+' cubierta',(loc[0],loc[1],loc[2]+dz),(w,d,.003),color,.001))
    for o in parts:o.rotation_euler.z=angle


def pendant(name,x,y,z=2.1,r=.20):
    rod(name+' cable',(x,y,z+.06),(x,y,2.69),.003,'Grafito')
    lathe(name+' cupula',(x,y,z),[(r,0),(r*.95,.10),(r*.65,.18),(0,.21),
        (0,.205),(r*.60,.174),(r*.92,.096),(r*.97,.006)],'Ceramica')
    cyl(name+' difusor',(x,y,z+.015),r*.87,.006,'LED')
    light(name+' luz',(x,y,z-.014),(x,y,0),22,size=r*1.5)


def atomic_json(path,value):
    temp=path.with_suffix('.tmp')
    temp.write_text(json.dumps(value,indent=2,ensure_ascii=False),encoding='utf-8')
    temp.replace(path)


def png_valid(path,width,height):
    try:
        with path.open('rb') as f:
            head=f.read(24)
            if len(head)!=24 or head[:8]!=b'\x89PNG\r\n\x1a\n':return False
            if struct.unpack('>II',head[16:24])!=(width,height):return False
            f.seek(-12,2)
            return f.read()==b'\x00\x00\x00\x00IEND\xaeB`\x82'
    except (OSError,ValueError):return False


def choose_device(cpu=False):
    scene=bpy.context.scene;scene.render.engine='CYCLES'
    if cpu:
        scene.cycles.device='CPU'
        return ['CPU (solicitado explicitamente)']
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='CUDA';prefs.refresh_devices()
    names=[]
    for d in prefs.devices:
        d.use=d.type=='CUDA'
        if d.use:names.append(d.name)
    if not names:
        raise RuntimeError('No hay GPU CUDA disponible. Revisa nvidia-smi y Preferences > System > CUDA.')
    scene.cycles.device='GPU'
    return names


class Monitor:
    """Muestrea memoria total de la GPU (incluye otros programas), no solo Blender."""
    def __init__(self,out):
        self.out=out;self.stop=threading.Event();self.thread=None
        self.peaks={};self.count=0

    def run(self):
        with (self.out/'gpu.csv').open('a',newline='',encoding='utf-8') as f:
            w=csv.writer(f)
            if f.tell()==0:w.writerow(['epoch','gpu','memoria_total_usada_MiB','utilizacion_pct','temperatura_C'])
            while not self.stop.is_set():
                try:
                    r=subprocess.run(['nvidia-smi','--query-gpu=index,memory.used,utilization.gpu,temperature.gpu',
                        '--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=5)
                    for line in r.stdout.splitlines():
                        row=[v.strip() for v in line.split(',')]
                        if len(row)==4:
                            w.writerow([round(time.time(),2)]+row);f.flush();self.count+=1
                            try:
                                mem,temp=float(row[1]),float(row[3])
                                peak=self.peaks.setdefault(row[0],{'memoria_MiB':0,'temperatura_C':0})
                                peak['memoria_MiB']=max(peak['memoria_MiB'],mem)
                                peak['temperatura_C']=max(peak['temperatura_C'],temp)
                            except ValueError:pass
                except (OSError,subprocess.TimeoutExpired):pass
                self.stop.wait(2)

    def start(self):
        if shutil.which('nvidia-smi'):
            self.thread=threading.Thread(target=self.run,daemon=True);self.thread.start()

    def close(self):
        self.stop.set()
        if self.thread:self.thread.join(timeout=6)


ASSUMPTIONS = {
    'referencia':'Planta comercial adjunta por el usuario, XIXOVA 987, rotulada 68 m2 / 2 suites.',
    'exactitud':'Interpretacion conceptual aproximada. No es modelo oficial ni medicion de superficie certificada.',
    'altura_interior_m':HEIGHT,
    'espesor_tabique_m':.12,
    'altura_puerta_m':2.20,
    'terraza':'Carpinterias y baranda propuestas para el demo; no representan especificacion de entrega.',
    'cocina':'Se adopta conexion abierta con comedor y lavanderia oculta tras carpinteria.',
    'decoracion':'Propuesta original: roble, nogal, travertino, lino, oliva y terracota.',
    'exterior':'Siluetas urbanas ficticias. No se afirma piso, orientacion solar ni vista real.',
    'alcance':'Sala, cocina/comedor, terraza y suite principal detallados para las cuatro camaras; otras areas simplificadas.',
    'audio':'Video sin musica ni voz.',
    'recursos':'Modelos y materiales procedurales propios; no descarga archivos externos.',
}


def acquire_lock(out):
    lock=out/'render.lock'
    if lock.exists():
        try:pid=int(lock.read_text().strip())
        except ValueError:raise RuntimeError('Lock invalido: revisa '+str(lock))
        try:os.kill(pid,0)
        except ProcessLookupError:lock.unlink()
        except PermissionError:raise RuntimeError('La carpeta esta en uso por otro proceso.')
        else:raise RuntimeError('Ya hay un render activo en esta carpeta. PID '+str(pid))
    with lock.open('x') as f:f.write(str(os.getpid()))
    return lock


