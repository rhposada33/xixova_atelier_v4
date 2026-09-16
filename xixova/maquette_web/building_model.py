"""Original architectural interpretation, executed through Blender MCP.
All dimensions are provisional metres. Geometry is grouped by material for web.
"""
import bpy, math, json, os
from mathutils import Vector

OUT = os.environ.get('XIXOVA_BUILDING_OUT','/home/rafa/RenderCasa/xixova_atelier_v4/xixova/maquette_web/public/building')
BLEND_OUT = os.environ.get('XIXOVA_BUILDING_BLEND_OUT','/home/rafa/RenderCasa/xixova_atelier_v4/resultados/garden_house_building')
MODEL_STEM = os.environ.get('XIXOVA_BUILDING_STEM','xixova-building')
SCENE_NAME = os.environ.get('XIXOVA_BUILDING_SCENE','XIXOVA_BUILDING')
os.makedirs(OUT, exist_ok=True)
os.makedirs(BLEND_OUT, exist_ok=True)
# Preserve previous working scenes while releasing stable web object names.
for previous_scene in bpy.data.scenes:
    if previous_scene.name.startswith(SCENE_NAME):
        for previous_object in previous_scene.objects:
            if not previous_object.name.startswith('ARCHIVE_'):
                previous_object.name = 'ARCHIVE_' + previous_object.name
scene = bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = scene
root = bpy.data.objects.new('BUILDING', None)
scene.collection.objects.link(root)
groups = {}
for name in ['PODIUM','ENTRANCE','FACADE_SHARED','ROOFTOP','LANDSCAPE'] + [f'FLOOR_{i:02d}' for i in range(1,19)]:
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    o.parent = root
    groups[name] = o
materials = {}
def material(name, color, rough=.7, metallic=0, emission=0):
    m = bpy.data.materials.new('XIXOVA_'+name)
    m.diffuse_color = (*color,1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color,1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    if emission:
        p.inputs['Emission Color'].default_value = (*color,1)
        p.inputs['Emission Strength'].default_value = emission
    materials[name] = m
    return m
material('ivory',(.88,.82,.72))
material('slab',(.89,.85,.74))
material('graphite',(.12,.135,.14),.57)
material('bronze',(.085,.064,.045),.42,.32)
material('glass',(.25,.35,.38),.16,.28)
material('window',(.10,.15,.17),.2,.4)
material('joint',(.48,.47,.43))
material('light',(1,.65,.25),.3,0,2.5)
material('wood',(.38,.23,.12))
material('leaf',(.035,.095,.021))
material('leaf_light',(.085,.16,.035))
material('trunk',(.31,.25,.17))
material('ground',(.58,.59,.54))
material('proxy',(.40,.62,.49))
material('curtain',(.56,.45,.30),.9)
material('interior_glow',(1,.72,.39),.65,0,.35)
parts = {}
def mesh(name, verts, faces, mat, group='FACADE_SHARED', separate=False):
    if not separate:
        key = (group,mat)
        v,f = parts.setdefault(key,([],[]))
        offset = len(v)
        v.extend(verts)
        f.extend([tuple(i+offset for i in face) for face in faces])
        return
    data=bpy.data.meshes.new(name)
    data.from_pydata(verts,[],faces)
    data.materials.append(materials[mat])
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.parent=groups[group]
    return obj
def box(name,xyz,size,mat,group='FACADE_SHARED',separate=False):
    x,y,z=xyz; a,b,c=[q/2 for q in size]
    vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,group,separate)
def cylinder(a,b,r,mat,group='LANDSCAPE',sides=8):
    a,b=Vector(a),Vector(b); axis=(b-a).normalized(); u=axis.cross(Vector((0,1,0))).normalized(); v=axis.cross(u)
    verts=[tuple(p+r*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides))) for p in [a,b] for i in range(sides)]
    faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    mesh('cylinder',verts,faces,mat,group)

# Two ivory wings, deep balcony bays and a recessed graphite spine.
box('core',(0,1,32.4),(3.0,13,58.8),'graphite')
box('spine_front',(0,-6.35,32.4),(2.9,.55,58.8),'graphite')
box('spine_back',(0,8.35,32.4),(2.9,.55,58.8),'graphite')
for side in [-1,1]:
    x=side*5.9
    box('wing',(x,1,31.8),(8.8,11.8,57.6),'ivory')
    for floor in range(1,19):
        z=4+(floor-1)*3.12
        # Balcony fronts on both elevations, shared facade geometry.
        for front in [-1,1]:
            y=1+front*7.05
            box('slab',(x,y,z),(9.15,3.25,.21),'slab')
            box('glazing',(x,1+front*6.02,z+1.45),(7.5,.10,2.5),'window')
            # Recessed curtains and warm occupied bays remain shallow exterior detail.
            for bay in [-2.4,0,2.4]:
                if (floor+int(bay*5))%4==0:
                    box('curtain',(x+bay,1+front*6.10,z+1.42),(1.45,.07,2.36),'interior_glow' if floor%3==0 else 'curtain')
            box('balcony_soffit',(x,y,z+3.0),(8.85,3.12,.09),'wood')
            for post in [-3.65,-1.2,1.2,3.65]:
                box('mullion',(x+post,1+front*6.10,z+1.45),(.075,.10,2.65),'bronze')
            box('balcony_glass',(x,1+front*8.55,z+.78),(8.8,.075,1.12),'glass')
            box('handrail',(x,1+front*8.57,z+1.38),(9.0,.08,.07),'bronze')
            box('warm_linear',(x,1+front*8.45,z+2.88),(8.5,.14,.065),'light')
            if floor%2==0:
                box('balcony_planter',(x-3.1,1+front*7.65,z+.38),(.9,.6,.55),'ivory')
                box('balcony_plant',(x-3.1,1+front*7.65,z+.82),(.82,.52,.42),'leaf')
            # Slim rails retain transparent-looking balcony articulation at distance.
            for rail in [-2.8,0,2.8]:
                box('glass_joint',(x+rail,1+front*8.60,z+.81),(.028,.06,1.12),'bronze')
            # Pronounced bronze frames every third balcony.
            if floor%3==1:
                box('frame_top',(x,1+front*8.68,z+2.95),(9.3,.32,.24),'bronze')
                for edge in [-4.52,4.52]:
                    box('frame_edge',(x+edge,1+front*8.68,z+1.55),(.20,.32,3.1),'bronze')
        # Quiet side elevation with horizontal ribbon windows.
        for sy in [-3.2,.6,4.4]:
            box('side_window',(side*10.32,sy,z+1.65),(.055,2.35,.72),'window')
            for wy in [-.75,.75]:
                box('side_mullion',(side*10.36,sy+wy,z+1.65),(.05,.05,.75),'slab')
        box('side_panel_joint',(side*10.32,1,z+2.85),(.03,11.8,.022),'joint')
        for sy in [-4.8,-1.8,1.2,4.2]:
            box('panel_joint',(side*10.33,sy,z+1.4),(.025,.016,2.85),'joint')
    top=60.7+(1.6 if side==1 else 0)
    box('upper_setback',(x,1,top),(7.8,10.4,3.0),'ivory','ROOFTOP')
    box('crown',(x,1,top+1.65),(10.3,14,.72),'bronze','ROOFTOP')
    box('crown_upper_lip',(x,1,top+2.04),(10.55,14.25,.10),'graphite','ROOFTOP')
    box('crown_reveal',(x,1,top+1.36),(9.0,12.2,.12),'light','ROOFTOP')
box('technical',(0,1,61.5),(3.1,9.6,5.0),'graphite','ROOFTOP')
box('podium',(0,1,1.65),(24,19,3.3),'wood','PODIUM')
box('podium_roof',(0,1,3.5),(25,20,.4),'slab','PODIUM')
box('lobby_glass',(0,-8.6,1.6),(18,.1,2.8),'window','ENTRANCE')
box('canopy',(0,-11,3.2),(13,6,.30),'bronze','ENTRANCE')
box('canopy_light',(0,-13.7,3.07),(12.8,.1,.05),'light','ENTRANCE')
box('podium_light',(0,-8.81,3.17),(23,.09,.08),'light','ENTRANCE')
for x in [-9,-6,-3,0,3,6,9]:
    box('lobby_post',(x,-8.8,1.55),(.14,.14,3.1),'bronze','ENTRANCE')
for x in [i*.28-11.5 for i in range(83)]:
    box('timber_fins',(x,-8.65,2.2),(.065,.2,1.8),'wood','ENTRANCE')
box('site',(0,0,-.3),(40,34,.5),'ground','PODIUM')
for x in [-15,15]:
    box('boundary',(x,0,.65),(.25,29,1.3),'ivory','ENTRANCE')
box('boundary_front',(-10,-15,.6),(10,.25,1.2),'ivory','ENTRANCE')
box('boundary_front',(10,-15,.6),(10,.25,1.2),'ivory','ENTRANCE')
for x in [-8,8]:
    for i in range(20):
        box('fence',(x+i*.22-2,-15,1.6),(.04,.06,1.6),'bronze','ENTRANCE')

# Palm trunks and curved pinnate fronds use shared merged geometry.
def palm(x,y,h,seed):
    cylinder((x,y,0),(x+.4,y,h),.19,'trunk')
    for k in range(10):
        angle=k*math.tau/10+seed
        points=[]
        for j in range(7):
            t=j/6
            points.append((x+.4+math.cos(angle)*t*3.6,y+math.sin(angle)*t*3.6,h+math.sin(t*math.pi)*1.1-t*.9))
        for j in range(6):
            cylinder(points[j],points[j+1],.035,'leaf')
        for j in range(1,13):
            t=j/14; cx=x+.4+math.cos(angle)*t*3.6; cy=y+math.sin(angle)*t*3.6; cz=h+math.sin(t*math.pi)*1.1-t*.9
            for sign in [-1,1]:
                length=.8*math.sin(t*math.pi)+.12
                dx=math.cos(angle+sign*1.1)*length; dy=math.sin(angle+sign*1.1)*length
                mesh('palm_leaf',[(cx,cy,cz),(cx+dx,cy+dy,cz-.38),(cx+math.cos(angle)*.3,cy+math.sin(angle)*.3,cz-.03)],[(0,1,2)],'leaf_light' if j%3==0 else 'leaf','LANDSCAPE')
for x,y,h,s in [(-13,-10,8,1),(13,-8,10,2),(-14,7,7,3),(14,9,8,4),(-9,-13,5,5),(10,-13,6,6)]:palm(x,y,h,s)
for i in range(46):
    x=math.sin(i*2.39)*14; y=math.cos(i*2.39)*13
    if abs(x)<6 and y<-9:continue
    for j in range(3):
        a=i+j*2.1
        cylinder((x,y,0),(x+math.cos(a)*.65,y+math.sin(a)*.65,1.0+(i%3)*.3),.5,'leaf_light' if i%3==0 else 'leaf',sides=7)

# Broad tropical canopy clusters frame the entrance without hiding residential units.
def canopy(cx,cy,cz,r,seed):
    rings=9; sides=14
    verts=[]
    for ring in range(rings+1):
        phi=math.pi*ring/rings
        for k in range(sides):
            a=k*math.tau/sides
            wobble=1+.07*math.sin(k*4.1+ring*2.7+seed)
            verts.append((cx+math.sin(phi)*math.cos(a)*r*wobble,cy+math.sin(phi)*math.sin(a)*r*wobble,cz+math.cos(phi)*r*.74*wobble))
    faces=[]
    for ring in range(rings):
        for k in range(sides):
            faces.append((ring*sides+k,ring*sides+(k+1)%sides,(ring+1)*sides+(k+1)%sides,(ring+1)*sides+k))
    mesh('tropical_canopy',verts,faces,'leaf_light' if seed%4==0 else 'leaf','LANDSCAPE')
for i,(x,y,h) in enumerate([(-15,-7,5),(15,-5,6),(-15,3,6),(15,4,5),(-12,12,6),(12,12,7),(-13,-13,3),(13,-13,3)]):
    cylinder((x,y,0),(x,y,h),.15,'trunk')
    for j in range(7):
        a=j*2.4
        canopy(x+math.cos(a)*1.2,y+math.sin(a)*1.2,h+math.sin(j)*.9,1.6+(j%3)*.3,i*7+j)
for i in range(32):
    x=-14+i*.9
    if abs(x)<5:continue
    canopy(x,-13.6,.6,.7,i)

for floor in range(1,19):
    for index,(x,y) in enumerate([(-5.9,5.1),(5.9,5.1),(-5.9,-3.1),(5.9,-3.1)],1):
        code=str(floor*100+index); z=4+(floor-1)*3.12+1.45
        # Envelope reaches just beyond the balcony railing, avoiding buried highlights.
        obj=box('UNIT_'+code+'_PROXY',(x,y,z),(9.15,9.15,2.8),'proxy',f'FLOOR_{floor:02d}',True)
        reserved={'401','704','902','1201','1504','1702'}
        sold={'101','104','202','203','301','304','502','603','801','1004','1302','1603'}
        obj['xixova_unit_code']=code; obj['xixova_unit_status']='reserved' if code in reserved else 'sold' if code in sold else 'available'
        obj['xixova_floor']=floor; obj['xixova_proxy']=True; obj['focusCenter']=[x,y,z]
        obj.hide_render=True; obj.display_type='WIRE'
for (group,mat),(verts,faces) in parts.items():mesh(group+'_'+mat,verts,faces,mat,group,True)
scene.world=bpy.data.worlds.new('Neutral day')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.72,.82,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
root['reconstruction']='Interpretación provisional; 18 plantas residenciales, 4 unidades por planta. No es BIM ni reconstrucción exacta.'
root['visualModes']='neutral_day,warm_dusk'
# Provisional depth makes the closed lateral elevation readable in the opening view.
root.scale.y=1.18
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND_OUT,MODEL_STEM+'.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,MODEL_STEM+'.glb'),export_format='GLB',use_active_scene=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
stats={'triangles':sum(len(p.vertices)-2 for o in scene.objects if o.type=='MESH' for p in o.data.polygons),'meshObjects':sum(o.type=='MESH' for o in scene.objects),'materials':len(materials),'unitProxies':72,'residentialFloors':18,'glbBytes':os.path.getsize(os.path.join(OUT,MODEL_STEM+'.glb')),'hierarchy':{n:[o.name for o in groups[n].children] for n in groups}}
stats_name='asset-statistics.json' if MODEL_STEM=='xixova-building' else MODEL_STEM+'-asset-statistics.json'
with open(os.path.join(OUT,stats_name),'w') as f:json.dump(stats,f,indent=2)
print(json.dumps(stats))
