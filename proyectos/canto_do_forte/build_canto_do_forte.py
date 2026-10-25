"""Canto do Forte — reproducible Blender master, metres/Z-up, glTF/Y-up.
Run in Blender's scripting workspace or through the Blender MCP. Only replaces
its own named scene. Generated architectural concept, not a real development.
"""
import bpy
import math
import random
from mathutils import Vector

ROOT = '/home/rafa/RenderCasa/xixova_atelier_v4'
random.seed(4516)
NAME = 'CANTO_DO_FORTE'
old = bpy.data.scenes.get(NAME)
if old:
    for obj in list(old.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new(NAME)
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene['concept'] = 'Canto do Forte | 16 floors | 64 residences | illustrative inventory'

atlas = bpy.data.images.load(ROOT + '/proyectos/canto_do_forte/textures/material-atlas.png', check_existing=True)
atlas.pack()
mats = {}
batches = {}
quadrants = {'stone': (0, .5), 'ivory': (0, .5), 'wood': (.5, .5), 'paving': (0, 0), 'marble': (.5, 0)}

def material(key, color, rough=.5, metal=0, texture=None, alpha=1, emit=0):
    m = bpy.data.materials.new('CDF_' + key)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*color, alpha)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Alpha'].default_value = alpha
    if emit:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emit
    if texture:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = atlas
        m.node_tree.links.new(t.outputs['Color'], p.inputs['Base Color'])
    if alpha < 1:
        try:
            m.surface_render_method = 'DITHERED'
        except TypeError:
            pass
    m.diffuse_color = (*color, alpha)
    mats[key] = m
    batches[key] = [[], [], [], []]
    return m

material('stone', (.86,.8,.68), .72, texture='stone')
material('ivory', (.94,.90,.81), .52, texture='stone')
material('wood_inlay', (.19,.085,.03), .78)
material('wood', (.64,.37,.17), .46, texture='wood', emit=.07)
material('paving', (.52,.51,.46), .86, texture='paving')
material('marble', (.72,.68,.61), .3, texture='marble')
material('bronze', (.20,.13,.069), .28, .78)
material('dark', (.028,.037,.038), .43, .35)
material('window', (.35,.53,.61), .18, .23, alpha=.25)
material('balustrade', (.57,.69,.68), .10, .36, alpha=.31)
material('room', (.55,.38,.22), .75)
material('curtain', (.81,.74,.61), .94)
material('linen', (.78,.73,.6), .89)
material('cushion', (.24,.31,.24), .88)
material('soil', (.057,.042,.025), 1)
material('trunk', (.24,.16,.08), .97)
material('foliage', (.075,.19,.055), .78)
material('foliage_light', (.20,.32,.07), .78)
material('foliage_deep', (.027,.105,.046), .8)
material('led', (1,.36,.07), .35, emit=3.2)
material('room_glow', (1,.7,.38), .5, emit=.25)
material('water', (.045,.29,.32), .12, .42)
material('road', (.12,.14,.15), .95)
material('marking', (.72,.67,.52), .9)
material('proxy', (.1,.7,.4), 1, alpha=0)
material('palm_frond', (1,1,1), .76)
material('plant_cluster', (1,1,1), .85)
plant_image=bpy.data.images.load(ROOT+'/proyectos/canto_do_forte/textures/tropical-planting.png',check_existing=True);plant_image.pack()
m=mats['plant_cluster'];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=plant_image
m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha'])
try:m.surface_render_method='DITHERED'
except TypeError:pass

material('car_paint', (.34,.31,.25), .20, .7)
material('tire', (.012,.015,.018), .91)
material('chrome', (.5,.54,.58), .19, .9)
material('car_glass', (.018,.032,.038), .09, .6)
material('tail_light', (.6,.015,.006), .28, emit=1.5)
frond_image=bpy.data.images.load(ROOT+'/proyectos/canto_do_forte/textures/palm-frond.png',check_existing=True)
frond_image.pack()
m=mats['palm_frond'];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=frond_image
m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha'])
try:m.surface_render_method='DITHERED'
except TypeError:pass

material('window_image', (1,1,1), .62, .02, emit=.55)
room_image = bpy.data.images.load(ROOT+'/xixova/maquette_web/assets/promoven/window-atlas-optimized.jpg',check_existing=True)
room_image.pack()
m=mats['window_image'];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=room_image
m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color'])
for suffix,power in [('_dim',.12),('_medium',.28)]:
    key='window_image'+suffix
    m=material(key,(1,1,1),.62,.02,emit=power)
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=room_image
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color'])


# Subtle scanned normal detail complements the generated stone atlas.
normal_image=bpy.data.images.load(ROOT+'/xixova/maquette_web/assets/promoven/brushed_concrete_nor_gl_1k.jpg',check_existing=True)
normal_image.colorspace_settings.name='Non-Color';normal_image.pack()
for key in ['ivory','stone']:
    m=mats[key];p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=normal_image
    n=m.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.16
    m.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);m.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
# Every material is batched; glass is split by elevation to keep alpha sorting stable.
def face(key, verts, smooth=False, uv=None):
    b = batches[key]
    idx = len(b[0]); b[0].extend(verts); b[1].append(tuple(range(idx, idx+len(verts)))); b[3].append(smooth)
    if uv is None:
        normal = (Vector(verts[1])-Vector(verts[0])).cross(Vector(verts[2])-Vector(verts[0]))
        axis = list(map(abs, normal)).index(max(map(abs, normal)))
        axes = [a for a in range(3) if a != axis]
        q = quadrants.get(key, (0,0))
        # Each polygon remains inside its atlas quadrant; architectural grain scales with length.
        uv = [(q[0]+.014+(v[axes[0]]*.031 % .46), q[1]+.014+(v[axes[1]]*.031 % .46)) for v in verts]
    b[2].append(uv)

def box(key, center, dims, angle=0):
    x,y,z = center; a,b,c = (v/2 for v in dims); co,si = math.cos(angle),math.sin(angle)
    vs = [(x+u*co-v*si,y+u*si+v*co,z+w) for u,v,w in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]]
    for ids in [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:
        face(key,[vs[i] for i in ids])

def rod(key, a, b, radius, r2=None, sides=8):
    a,b=Vector(a),Vector(b); d=(b-a).normalized(); n=d.cross(Vector((0,0,1)))
    if n.length < .01: n=d.cross(Vector((0,1,0)))
    n.normalize(); v=d.cross(n).normalized(); r2=radius if r2 is None else r2
    ring1=[a+radius*(math.cos(t*math.tau/sides)*n+math.sin(t*math.tau/sides)*v) for t in range(sides)]
    ring2=[b+r2*(math.cos(t*math.tau/sides)*n+math.sin(t*math.tau/sides)*v) for t in range(sides)]
    for i in range(sides):
        j=(i+1)%sides; face(key,[ring1[i],ring1[j],ring2[j],ring2[i]],True)
    face(key,list(reversed(ring1)));face(key,ring2)

def outline(w=31,d=24,r=5,steps=18,wave=True):
    pts=[]
    for cx,cy,start in [(w/2-r,-d/2+r,-90),(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180)]:
        for j in range(steps+1):
            t=math.radians(start+90*j/steps);pts.append((cx+r*math.cos(t),cy+r*math.sin(t)))
    # Subdivide straight stretches for a flowing central recess on the principal facade.
    out=[]
    for i,p in enumerate(pts):
        q=pts[(i+1)%len(pts)];n=max(1,int(math.dist(p,q)/.65))
        for j in range(n):
            x=p[0]+(q[0]-p[0])*j/n;y=p[1]+(q[1]-p[1])*j/n
            if wave and y < -d/2+.02: y += 4.8*math.exp(-(x/3.3)**2)
            out.append((x,y))
    return out

def slab(key, pts, z, thickness):
    n=len(pts)
    # Convex fan follows the mildly concave perimeter without crossing the footprint.
    for i in range(n):
        j=(i+1)%n;a,b=pts[i],pts[j]
        face(key,[(0,0,z),(b[0],b[1],z),(a[0],a[1],z)])
        face(key,[(0,0,z+thickness),(a[0],a[1],z+thickness),(b[0],b[1],z+thickness)])
        face(key,[(a[0],a[1],z),(b[0],b[1],z),(b[0],b[1],z+thickness),(a[0],a[1],z+thickness)],True)

def ribbon(key, pts, z, height):
    for i,a in enumerate(pts):
        b=pts[(i+1)%len(pts)]
        face(key,[(a[0],a[1],z),(b[0],b[1],z),(b[0],b[1],z+height),(a[0],a[1],z+height)],True)

def window_quad(verts,variant=0):
    u=(variant%2)*.5+.018;v=(variant//2)*.5+.018
    face('window_image_dim' if variant==2 else 'window_image_medium' if variant==1 else 'window_image',verts,uv=[(u,v),(u+.464,v),(u+.464,v+.464),(u,v+.464)])

def rail(pts,z):
    ribbon('balustrade',pts,z,1.05)
    ribbon('bronze',pts,z+1.045,.025)
    ribbon('ivory',pts,z,.075)
    for i in range(0,len(pts),4):
        x,y=pts[i];rod('bronze',(x,y,z),(x,y,z+1.06),.018,sides=5)

def leaf(a,b,width,key):
    a,b=Vector(a),Vector(b);d=b-a;n=d.cross(Vector((0,0,1)))
    if n.length < .01:n=Vector((1,0,0))
    n.normalize();m=a+d*.48;ridge=m+Vector((0,0,width*.2))
    face(key,[a,m+n*width,ridge],True);face(key,[a,ridge,m-n*width],True)
    face(key,[m+n*width,b,ridge],True);face(key,[ridge,b,m-n*width],True)

def plant_clump(x,y,z,w=2,h=1):
    angle=random.random()*math.tau
    for j in range(3):
        a=angle+j*math.pi/3;dx=math.cos(a)*w/2;dy=math.sin(a)*w/2
        face('plant_cluster',[(x-dx,y-dy,z),(x+dx,y+dy,z),(x+dx*.88,y+dy*.88,z+h),(x-dx*.88,y-dy*.88,z+h)],uv=[(0,0),(1,0),(1,1),(0,1)])

def shrub(x,y,z,s=.8):
    s*=1.30
    for j in range(19):
        t=j*2.39996;h=random.uniform(.35,.9)*s;r=random.uniform(.35,.7)*s
        leaf((x,y,z),(x+math.cos(t)*r,y+math.sin(t)*r,z+h),.15*s,['foliage','foliage_light','foliage_deep'][j%3])

def palm(x,y,z,h=4.5,spread=2.4):
    bend=random.uniform(-.3,.3)
    for j in range(8):
        a=(x+bend*(j/8)**2,y,z+h*j/8);b=(x+bend*((j+1)/8)**2,y,z+h*(j+1)/8)
        rod('trunk',a,b,.17*(1-.28*j/8),sides=7)
    for j in range(17):
        t=j*math.tau/17+random.random()*.2;dx,dy=math.cos(t),math.sin(t);length=spread*random.uniform(.8,1.12)
        def frond(u):return Vector((x+bend+dx*length*u,y+dy*length*u,z+h+length*((1.9 if j>11 else 1.6)*u-(2.25 if j<12 else 1.65)*u*u)))
        # Seven bent strips per real, alpha-textured frond: a dense silhouette
        # with far fewer triangles than separately modelled microscopic leaflets.
        width=length*.22
        for k in range(7):
            u0=k/7;u1=(k+1)/7;c0=frond(u0);c1=frond(u1)
            side=Vector((-dy*width,dx*width,-width*.13))
            ridge=Vector((0,0,width*.22))
            face('palm_frond',[c0-side,c1-side,c1+ridge,c0+ridge],True,[(u0,0),(u1,0),(u1,.5),(u0,.5)])
            face('palm_frond',[c0+ridge,c1+ridge,c1+side,c0+side],True,[(u0,.5),(u1,.5),(u1,1),(u0,1)])

def planter(x,y,z,l=2.3,w=.75):
    box('stone',(x,y,z+.24),(l,w,.48));box('soil',(x,y,z+.49),(l-.12,w-.12,.035))
    plant_clump(x,y,z+.45,max(l,w)*1.12,random.uniform(.9,1.45))
    for j in range(max(2,int(l/.42))):shrub(x-l*.42+j*l*.84/max(1,int(l/.42)-1),y,z+.5,.72)

def seat(x,y,z,a=0):
    box('wood',(x,y,z+.30),(1.55,.72,.18),a)
    box('linen',(x,y,z+.45),(1.45,.68,.22),a)
    dx,dy=-math.sin(a)*.27,math.cos(a)*.27
    box('linen',(x+dx,y+dy,z+.75),(1.5,.16,.65),a)
    box('cushion',(x+dx*.7,y+dy*.7,z+.78),(.44,.25,.35),a)
    for u in [-.6,.6]:
        for v in [-.25,.25]:rod('bronze',(x+u*math.cos(a)-v*math.sin(a),y+u*math.sin(a)+v*math.cos(a),z),(x+u*math.cos(a)-v*math.sin(a)+.06,y+u*math.sin(a)+v*math.cos(a),z+.3),.027,sides=5)

# Site: a broad raised coastal garden, arrival plaza and thin road band.
slab('paving',outline(61,47,5,wave=False),-.42,.45)
box('road',(0,-29,-.31),(120,10,.16))
for x in range(-52,55,7):box('marking',(x,-29,-.221),(3,.10,.012))
for x in range(-29,30,2):
    box('bronze',(x,-20,.04),(.022,7,.016))
for y in [-23,-21,-19,-17]:box('bronze',(0,y,.04),(59,.018,.016))
for x in [-24,24]:
    slab('stone',[(a+x,b-6) for a,b in outline(7,19,3,wave=False)],.07,.38)
    slab('soil',[(a+x,b-6) for a,b in outline(6.6,18.6,2.8,wave=False)],.46,.025)
    for y in [-13,-6,2]:palm(x,y,.49,random.uniform(5.2,7),3.3)
    for j in range(22):shrub(x+random.uniform(-2.4,2.4),random.uniform(-14,1),.5,random.uniform(.7,1.4))
# Two reflecting pools with low stone coping.
for x in [-12.5,12.5]:
    pts=[(a+x,b-18.3) for a,b in outline(13,3.8,1.6,wave=False)]
    slab('marble',pts,.06,.20)
    slab('water',[(a+x,b-18.3) for a,b in outline(12.5,3.3,1.4,wave=False)],.265,.018)
    for px in [x-3,x,x+3]:
        rod('bronze',(px,-18.3,.28),(px,-18.3,.42),.06)
        rod('water',(px,-18.3,.42),(px,-18.3,1.12),.024,sides=6)
# Arrival stairs and ceremonial podium.
for j in range(4):box('marble',(0,-15.6+j*.45,.09+j*.12),(14,.65,.18+j*.24))
slab('marble',outline(39,29,4,wave=False),.32,.38)
box('room',(0,2.6,3.6),(30,13.8,5.8))
# Lobby glazing and real internal furniture.
for x in [-16,-12,-8,-4,0,4,8,12,16]:
    window_quad([(x-1.93,-9.65,.72),(x+1.93,-9.65,.72),(x+1.93,-9.65,6.25),(x-1.93,-9.65,6.25)],3 if x%8 else 2)
    box('window',(x,-12.2,3.5),(3.87,.035,5.7))
    for side in [-1,1]:box('bronze',(x+side*1.96,-12.24,3.5),(.055,.10,5.9))
    box('bronze',(x,-12.24,3.5),(4,.10,.065))
    seat(x,-10.5,.72)
for y in range(-10,12,3):
    for x in [-18.1,18.1]:
        box('window',(x,y,3.5),(.045,2.94,5.7));box('bronze',(x,y+1.48,3.5),(.12,.06,5.9))
# Sculptural marble signage wall left, bronze portal right.
box('marble',(-12.1,-12.45,3.55),(6.7,.65,5.75))
for x in [5.0+j*.27 for j in range(24)]:box('wood',(x,-12.5,3.45),(.11,.35,5.5))
for x in [-4,4]:box('bronze',(x,-12.6,3.7),(.18,.25,6.1));box('led',(x+.12,-12.76,3.7),(.035,.035,6.1))
slab('ivory',outline(41,31,4.3,wave=False),6.4,.50)
slab('wood',outline(40.6,30.6,4.1,wave=False),6.36,.055)
ribbon('led',outline(41.06,31.06,4.33,wave=False),6.43,.12)
rail(outline(39.5,29.5,3.8,wave=False),6.91)
for x in [-17,-12,-6,0,6,12,17]:
    planter(x,-13,6.92,3,.85)
    if x in [-17,-6,12,17]:palm(x,-12.5,7.4,2.9,1.7)
for y in [-8,-2,5,11]:
    for x in [-18,18]:planter(x,y,6.92,1.1,2.5);palm(x,y,7.4,2.5,1.6)
# Residential stack. Four apartments per level; real balcony depth and room recesses.
for floor in range(1,17):
    z=7.4+(floor-1)*3.3
    pts=outline(35+(0.8 if floor>14 else 0),25.4,6.0)
    slab('wood',[(x*.993,y*.993) for x,y in pts],z-.14,.065)
    slab('ivory',[(x*.997,y*.997) for x,y in pts],z-.10,.06)
    slab('ivory',pts,z-.04,.60)
    slab('ivory',[(x*.996,y*.996) for x,y in pts],z+.56,.065)
    ribbon('led',[(x*1.003,y*1.003) for x,y in pts],z-.13,.15)
    rail([(x*.984,y*.984) for x,y in pts],z+.63)
    box('room',(0,.8,z+1.6),(24.7,15.3,2.8))
    # Stone flank bands, large sliding windows, visible curtains.
    for back in [-1,1]:
        y=-8.2 if back<0 else 8.65
        for bay in range(10):
            x=-11.15+bay*2.48
            if back<0 and abs(x)<2.5:continue
            verts=[(x-1.18,y,z+.68),(x+1.18,y,z+.68),(x+1.18,y,z+3.08),(x-1.18,y,z+3.08)]
            if back>0:verts.reverse()
            window_quad(verts,[2,3,1,3][(floor+bay)%4])
            # Drapery folds: a few strips on the edge, leaving glass open.
            for j in range(2):box('curtain',(x-.96+j*.08,y+back*.04,z+1.74),(.035,.06,2.6))
            box('window',(x,y+back*.16,z+1.65),(2.42,.035,2.75))
            box('bronze',(x-1.22,y+back*.19,z+1.65),(.045,.09,2.84))
            box('bronze',(x,y+back*.19,z+.28),(2.48,.11,.065))
        for x in [-8,8]:seat(x,back*10.15,z+.63,math.pi if back<0 else 0)
        for x in [-5.5,5.5]:rod('wood',(x,back*10.35,z+.63),(x,back*10.35,z+.72),.32,sides=16)
    for side in [-1,1]:
        x=side*12.48
        for bay in range(7):
            y=-7.35+bay*2.45
            verts=[(x,y-1.18,z+.68),(x,y+1.18,z+.68),(x,y+1.18,z+3.08),(x,y-1.18,z+3.08)]
            if side<0:verts.reverse()
            window_quad(verts,[3,1,2,3][(floor+bay)%4])
            box('window',(x+side*.12,y,z+1.65),(.035,2.40,2.75))
            box('bronze',(x+side*.15,y-1.2,z+1.65),(.10,.045,2.85))
        planter(side*13.7,5.8,z+.63,.8,2.7)
    for x in [-11.3,11.3]:
        planter(x,-11.9,z+.63,2.8,.85)
        if floor%3!=0:palm(x,-11.8,z+.90,random.uniform(1.6,2.15),random.uniform(1.35,1.8))
        shrub(x+1.0,-11.5,z+.90,1.0)
        shrub(x-1.0,-11.5,z+.90,1.0)
        # Hanging sprays over the curving white ribbon.
        for j in range(9):
            xx=x+random.uniform(-.7,.7)
            for k in range(5):leaf((xx,-12.1,z+.65-k*.20),(xx+random.uniform(-.3,.3),-12.3,z+.63-k*.20),.15,'foliage')
    for xx in [-14,-6,6,14]:planter(xx,-11.5,z+.63,1.85,.85)
    planter(-4.1,10.8,z+.63,3,.7)
    for x in [-10,-5,5,10]:
        for y in [-10,10]:rod('led',(x,y,z-.17),(x,y,z-.13),.13,sides=8)
    # Fine timber slats retain direction and depth underneath the cantilevers.
    for j in range(-37,38):
        xx=j*.36
        if abs(xx)>3.6:
            box('wood_inlay',(xx,-10.4,z-.16),(.035,2.0,.035))
    # Invisible selectable volumes follow the four apartment quadrants.
    for final in range(1,5):
        code=str(floor*100+final)
        # Clip the actual curved slab footprint into four selectable apartments.
        poly=list(pts)
        for axis,sign in [(0,-1 if final in [1,3] else 1),(1,1 if final<3 else -1)]:
            clipped=[]
            for idx,a in enumerate(poly):
                b=poly[(idx+1)%len(poly)];ina=a[axis]*sign>=.03;inb=b[axis]*sign>=.03
                if ina:clipped.append(a)
                if ina!=inb:
                    t=(.03*sign-a[axis])/(b[axis]-a[axis])
                    clipped.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
            poly=clipped
        n=len(poly);vs=[(x,y,zz) for zz in [z+.65,z+3.15] for x,y in poly]
        fs=[tuple(reversed(range(n))),tuple(range(n,n*2))]
        fs.extend((j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n))
        mesh=bpy.data.meshes.new('UNIT_'+code);mesh.from_pydata(vs,[],fs);mesh.update()
        o=bpy.data.objects.new('UNIT_'+code+'_PROXY',mesh);scene.collection.objects.link(o)
        o.data.materials.append(mats['proxy']);o.hide_render=True;o['unitCode']=code;o['floor']=floor
# Vertical fluted limestone ribs, kept slender so the balconies remain dominant.
for x,y,w in [(0,-7.6,2.6),(13.1,1.8,1.2),(-13.1,1.8,1.2)]:
    box('stone',(x,y,34.0),(w,.95,53.3))
    for j in range(int(w/.13)):
        box('ivory',(x-w/2+.08+j*.13,y-.41,34.0),(.035,.08,53.3))
    box('led',(x+w/2-.04,y-.53,34.0),(.075,.045,53.2))
# Crown: planted sky terrace, sky pool, rounded floating pergola and timber blades.
roof=60.2
slab('ivory',outline(35.8,25.8,5.4),roof,.38)
slab('wood',outline(35.4,25.4,5.2),roof-.06,.055)
ribbon('led',outline(35.88,25.88,5.44),roof+.03,.12)
rail(outline(35.2,25.2,5.1),roof+.38)
box('stone',(0,2,62.05),(19,13,3.2))
for x in range(-8,9,2):
    box('window',(x,-4.6,62.05),(1.94,.03,2.9));box('bronze',(x+.98,-4.63,62.05),(.045,.08,3))
for x in [-12,-7,6,12]:
    planter(x,-9.7,roof+.38,2.6,1.1);palm(x,-9.5,roof+.88,3.2,2)
for x in [-12.5,12.5]:
    for y in [-3,5]:planter(x,y,roof+.38,1.1,3);palm(x,y,roof+.9,2.7,1.9)
for x in [-6,-3,0,3]:seat(x,-7.1,roof+.4)
box('marble',(0,7.2,roof+.65),(12,5,.5));box('water',(0,7.2,roof+.92),(11.5,4.5,.06))
canopy=outline(29.5,20,6,wave=False)
slab('ivory',canopy,64.0,.55)
slab('wood',[(x*.984,y*.977) for x,y in canopy],63.91,.08)
ribbon('led',[(x*1.004,y*1.004) for x,y in canopy],64.03,.13)
for x in [-10,10]:
    for y in [-5,5]:rod('bronze',(x,y,roof+.38),(x,y,63.92),.1,sides=8)
for x in range(-11,12):box('wood',(x,0,64.6),(.18,13.0,.55))
# Street garden details, benches and bollard lanterns.
for x in [-20,20]:
    for y in [-18,-9,5,15]:
        rod('bronze',(x,y,.1),(x,y,1),.085,sides=8)
        rod('led',(x,y,.8),(x,y,.96),.10,sides=8)
for x in [-7,7]:seat(x,-22,.04)
for x in [-27,27]:
    for y in [9,16]:palm(x,y,.04,6.5,3.4)
# Continuous gardens and layered entry planting.
for x in range(-18,19,2):
    if abs(x)>5:
        planter(x,-14.1,6.92,2.0,1.1)
        shrub(x,-14,7.45,1.25)
for x,y,h in [(-20,-18,10),(19,-17,9.2),(-16,-15,7.5),(15,-15,8),(-28,-20,9.4),(28,-19,10)]:
    palm(x,y,.12,h,3.7)
    for k in range(12):
        t=k*2.399
        shrub(x+math.cos(t)*1.1,y+math.sin(t)*1.1,.12,1.0)
for x in range(-16,17,3):
    if abs(x)>5:
        for y in [-15.1,-16.1]:shrub(x,y,.15,.8)
# Pergola blades below the floating edge, glowing recessed slots.
for x in range(-11,12):
    box('wood',(x,0,63.78),(.22,13.5,.28))
    box('led',(x+.16,0,63.73),(.025,13.0,.02))
for x in range(-16,17,2):
    if abs(x)>2:
        planter(x,-10.2,roof+.38,1.85,1.3)
        shrub(x,-10.1,roof+1.0,1.3)
for x in range(-28,29,2):
    if abs(x)>8:
        for y in [-20.3,16.5]:shrub(x,y,.05,1.3)
# Coastal urban context extends outside the plot, eliminating an isolated floating island.
box('paving',(0,6,-.62),(250,110,.20))
box('road',(0,-29,-.46),(250,10,.20))
for x in range(-100,101,12):
    if abs(x)>29:
        palm(x,-20,-.50,random.uniform(7,10),4.0)
        for k in range(6):shrub(x+random.uniform(-2,2),-20+random.uniform(-1,1),-.5,1.5)
# Zebra crossing and seaside walking strip.
for i in range(9):box('marking',(33+i*.8,-29,-.35),(.45,7,.02))
for xx in [-19,19]:
    island=[(x+xx,y-16.7) for x,y in outline(8,4.7,2.1,wave=False)]
    slab('stone',island,.10,.32)
    slab('soil',[(x+xx,y-16.7) for x,y in outline(7.6,4.3,1.9,wave=False)],.43,.04)
    for j in range(20):shrub(xx+random.uniform(-3,3),-16.7+random.uniform(-1.5,1.5),.48,random.uniform(.8,1.5))
for x in [-24,-20,-16,16,20,24]:
    plant_clump(x,-18.8,.45,3.0,1.65)
    plant_clump(x,-15.7,.45,2.8,1.45)
# Original, unbranded arrival cars, with actual curved bodywork and wheels.
def car(x,y):
    sections=[(-2.5,.65,.52),(-2.15,.90,.75),(-1.4,.95,.84),(-.8,.96,.86),(.8,.96,.84),(1.8,.90,.72),(2.4,.65,.58)]
    for i in range(len(sections)-1):
        a,wa,za=sections[i];b,wb,zb=sections[i+1]
        for sign in [-1,1]:
            face('car_paint',[(x+a,y+sign*wa,.38),(x+b,y+sign*wb,.38),(x+b,y+sign*wb,zb),(x+a,y+sign*wa,za)],True)
        face('car_paint',[(x+a,y-wa,za),(x+b,y-wb,zb),(x+b,y+wb,zb),(x+a,y+wa,za)],True)
    # Sloping glass cabin and solid roof.
    for sign in [-1,1]:
        face('car_glass',[(x-1.3,y+sign*.84,.82),(x-.65,y+sign*.74,1.42),(x+.65,y+sign*.74,1.42),(x+1.45,y+sign*.84,.82)])
        rod('chrome',(x,y+sign*.80,.84),(x,y+sign*.74,1.42),.025,sides=5)
        rod('chrome',(x-1.3,y+sign*.84,.82),(x+1.45,y+sign*.84,.82),.025,sides=5)
    face('car_glass',[(x+.65,y-.74,1.42),(x+1.45,y-.84,.82),(x+1.45,y+.84,.82),(x+.65,y+.74,1.42)])
    face('car_glass',[(x-1.3,y-.84,.82),(x-.65,y-.74,1.42),(x-.65,y+.74,1.42),(x-1.3,y+.84,.82)])
    box('car_paint',(x,y,1.43),(1.35,1.5,.08))
    for xx in [-1.6,1.6]:
        for sign in [-1,1]:
            rod('tire',(x+xx,y+sign*.78,.35),(x+xx,y+sign*1.0,.35),.35,sides=18)
            rod('chrome',(x+xx,y+sign*1.005,.35),(x+xx,y+sign*1.02,.35),.24,sides=12)
    for yy in [-.50,.50]:
        box('led',(x+2.34,y+yy,.58),(.045,.28,.12))
        box('tail_light',(x-2.47,y+yy,.55),(.035,.22,.10))
car(-13,-28)
car(12,-31)
# Assemble all material batches.
for key,(verts,faces,uvs,smooth) in batches.items():
    if not verts:continue
    mesh=bpy.data.meshes.new('CDF_'+key);mesh.from_pydata(verts,[],faces);mesh.materials.append(mats[key]);mesh.update()
    layer=mesh.uv_layers.new(name='AtlasUV')
    for poly,uv,sm in zip(mesh.polygons,uvs,smooth):
        poly.use_smooth=sm
        for li,t in zip(poly.loop_indices,uv):layer.data[li].uv=t
    obj=bpy.data.objects.new('CDF_'+key,mesh);scene.collection.objects.link(obj)
# Signage is actual geometry, readable from the entry drive.
for body,z,size in [('CANTO',4.05,.69),('DO FORTE',3.25,.46),('R E S I D E N C E S',2.65,.18)]:
    curve=bpy.data.curves.new('CDF_sign','FONT');curve.body=body;curve.align_x='CENTER';curve.size=size;curve.extrude=.008
    obj=bpy.data.objects.new('CDF_sign_'+body,curve);scene.collection.objects.link(obj);obj.location=(-12.1,-12.79,z);obj.rotation_euler=(math.pi/2,0,0);obj.data.materials.append(mats['led'])
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
# A taller ceremonial lobby and broader plan give the podium real hierarchy.
# Preserve the sixteen floor identities and proxy-to-unit correspondences.
for obj in scene.objects:
    if obj.type=='MESH':
        inv=obj.matrix_world.inverted()
        for v in obj.data.vertices:
            co=obj.matrix_world @ v.co
            co.x*=1.22
            if co.z>0:co.z=co.z*1.42 if co.z<=7 else 9.94+(co.z-7)*.94
            v.co=inv @ co
        obj.data.update()
# Non-exported studio setup, saved for reproducible preview renders.
world=bpy.data.worlds.new('CDF_coastal_world');world.use_nodes=True;scene.world=world
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.36,.49,.65,1)
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.5
bpy.ops.object.light_add(type='SUN',location=(-45,-45,70));sun=bpy.context.object;sun.name='CDF_SUN';sun.rotation_euler=(.5,-.6,-.5);sun.data.energy=3;sun.data.angle=.12
bpy.ops.object.camera_add(location=(72,-125,36));camera=bpy.context.object;camera.name='CDF_CAMERA';direction=Vector((0,0,31))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.lens=48;scene.camera=camera
try:scene.render.engine='CYCLES'
except TypeError:pass
scene.cycles.samples=32
scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
# Set viewport to the new building without touching the preserved original scene.
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=110
        area.spaces.active.region_3d.view_location=(0,0,30)
# Export only architectural meshes, including transparent proxy volumes.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH':o.hide_render=False;o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/xixova/maquette_web/public/building/canto-do-forte.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
for o in scene.objects:
    if o.name.startswith('UNIT_'):o.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/proyectos/canto_do_forte/canto-do-forte.blend')
print({'scene':scene.name,'meshes':sum(o.type=='MESH' for o in scene.objects),'proxies':sum(o.name.startswith('UNIT_') for o in scene.objects),'vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH')})
