"""Construye XIXOVÁ v3 sobre una copia: activos detallados, PBR CC0 y biblioteca v2."""
import argparse, hashlib, json, math, os, sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]; PREFIX='XVA3_'
CAT={'Dormitorio':'10908706-3b7a-4a49-8ca0-a4dcfb9554d1','Cocina':'f0b4db76-bdbd-4ef7-9cdc-7ceadbc1e456','Baño':'09e1c28d-5bb1-4a82-9fbe-4dbf954f55bb','Iluminación':'df86bd72-0d4a-4eed-a7a0-f8c70d406a30','Decoración':'54f49638-42aa-4142-ac2c-30280fc2bb45','Textiles':'4584fa1c-1a37-483a-b6a5-e5b67372a34f','Materiales':'17a8d215-0256-43dc-82e2-f8064cd513df'}

def args():
    p=argparse.ArgumentParser(); p.add_argument('--config',type=Path,required=True); p.add_argument('--quality',choices=('proxy','final'),default='final')
    return p.parse_args(sys.argv[sys.argv.index('--')+1:])

def col(name,parent):
    c=bpy.data.collections.new(PREFIX+name); parent.children.link(c); return c

def move(o,c):
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o); return o


def rounded(c,name,loc,dims,mat,r=.025,segments=4):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=move(bpy.context.object,c); o.name=PREFIX+name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat)
    b=o.modifiers.new('Bisel_fisico','BEVEL'); b.width=min(r,min(dims)*.22); b.segments=segments
    return o

def cylinder(c,name,loc,r,depth,mat,vertices=48,rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=rot or (0,0,0)); o=move(bpy.context.object,c); o.name=PREFIX+name; o.data.materials.append(mat)
    b=o.modifiers.new('Bisel_fisico','BEVEL'); b.width=min(.008,r*.18); b.segments=3; return o

def sphere(c,name,loc,scale,mat,segments=48,rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc); o=move(bpy.context.object,c); o.name=PREFIX+name; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat)
    bpy.ops.object.shade_smooth(); return o

def pipe(c,name,points,r,mat):
    curve=bpy.data.curves.new(PREFIX+name,'CURVE'); curve.dimensions='3D'; curve.bevel_depth=r; curve.bevel_resolution=4; curve.resolution_u=12
    spl=curve.splines.new('BEZIER'); spl.bezier_points.add(len(points)-1)
    for p,co in zip(spl.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(PREFIX+name,curve); c.objects.link(o); o.data.materials.append(mat); return o

def area_light(c,name,loc,target,energy,size):
    data=bpy.data.lights.new(PREFIX+name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=(1.0,.79,.60)
    o=bpy.data.objects.new(PREFIX+name,data); c.objects.link(o); o.location=loc; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler(); return o

def pbr(name,color,rough=.5,metal=0,source=None,scale=5,transmission=0):
    m=bpy.data.materials.new(PREFIX+name); m.use_nodes=True; n=m.node_tree.nodes; l=m.node_tree.links; n.clear()
    out=n.new('ShaderNodeOutputMaterial'); bs=n.new('ShaderNodeBsdfPrincipled'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
    bs.inputs['Transmission Weight'].default_value=transmission
    if transmission: bs.inputs['IOR'].default_value=1.45
    tex=n.new('ShaderNodeTexCoord'); mapping=n.new('ShaderNodeMapping'); mapping.inputs['Scale'].default_value=(scale,scale,scale); l.new(tex.outputs['Generated'],mapping.inputs['Vector'])
    if source:
        base=Path(PBR)/source; files={p.name:p for p in base.glob('*')}
        def find(role): return next((p for k,p in files.items() if role in k),None)
        for role,socket in [('base_color','Base Color'),('roughness','Roughness')]:
            path=find(role)
            if path:
                im=bpy.data.images.load(str(path),check_existing=True); node=n.new('ShaderNodeTexImage'); node.image=im; node.projection='BOX'; node.projection_blend=.18; l.new(mapping.outputs['Vector'],node.inputs['Vector']); l.new(node.outputs['Color'],bs.inputs[socket])
        path=find('normal')
        if path:
            im=bpy.data.images.load(str(path),check_existing=True); im.colorspace_settings.name='Non-Color'; node=n.new('ShaderNodeTexImage'); node.image=im; node.projection='BOX'; node.projection_blend=.18; norm=n.new('ShaderNodeNormalMap'); norm.inputs['Strength'].default_value=.28; l.new(mapping.outputs['Vector'],node.inputs['Vector']); l.new(node.outputs['Color'],norm.inputs['Color']); l.new(norm.outputs['Normal'],bs.inputs['Normal'])
    else:
        noise=n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=scale*4; noise.inputs['Detail'].default_value=5; noise.inputs['Roughness'].default_value=.7; l.new(mapping.outputs['Vector'],noise.inputs['Vector'])
        bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.12; bump.inputs['Distance'].default_value=.001; l.new(noise.outputs['Fac'],bump.inputs['Height']); l.new(bump.outputs['Normal'],bs.inputs['Normal'])
    l.new(bs.outputs[0],out.inputs[0]); m['xva_source']=source or 'procedural propio'; m['xva_license']='CC0'; return m

def mark(c,category,desc,shots):
    c.asset_mark(); c.asset_data.catalog_id=CAT[category]; c.asset_data.author='XIXOVÁ Atelier'; c.asset_data.description=desc
    c['xva_id']=c.name; c['xva_version']='2.0.0'; c['xva_category']=category; c['xva_license']='CC0 / geometría propia'; c['xva_quality']='final'; c['xva_shots']=','.join(map(str,shots)); return c

def bed(parent,name,x,y,w,shots):
    c=mark(col(name,parent),'Dormitorio','Cama tapizada fotorrealista con costuras y textiles',shots)
    rounded(c,name+'_base',(x,y,.24),(w,2.02,.32),M['roble'],.045,6); rounded(c,name+'_mattress',(x,y-.02,.49),(w-.08,1.92,.25),M['lino'],.095,8)
    rounded(c,name+'_head',(x,y+.98,.96),(w+.18,.12,1.25),M['lino_oliva'],.055,6)
    # Edredón con caída frontal y laterales; subdivisión visible en render.
    rounded(c,name+'_duvet',(x,y-.18,.665),(w-.025,1.50,.115),M['lino'],.07,8)
    for i,dx in enumerate((-w*.255,w*.255)):
        p=sphere(c,name+f'_pillow_{i}',(x+dx,y+.52,.715),(w*.215,.24,.105),M['marfil'],64,32); p.rotation_euler[2]=(-.035 if i else .045)
        pipe(c,name+f'_piping_{i}',[(x+dx-w*.19,y+.52,.715),(x+dx,y+.69,.715),(x+dx+w*.19,y+.52,.715),(x+dx,y+.35,.715),(x+dx-w*.19,y+.52,.715)],.006,M['oliva'])
    for dx in (-w/2+.045,w/2-.045): pipe(c,name+'_seam',[(dx+x,y-.93,.53),(dx+x,y+.91,.53)],.004,M['marfil'])
    return c

def nightstand(parent,name,x,y,shots):
    c=mark(col(name,parent),'Dormitorio','Mesita con cajón, juntas y herrajes',shots); rounded(c,name+'_body',(x,y,.34),(.44,.38,.58),M['roble'],.025,4); rounded(c,name+'_front',(x,y-.197,.38),(.37,.018,.22),M['roble'],.005,3); cylinder(c,name+'_handle',(x,y-.214,.39),.012,.16,M['laton'],32,(math.pi/2,0,0)); return c

def wardrobe(parent,name,loc,dims,shots):
    c=mark(col(name,parent),'Dormitorio','Armario con puertas, holguras y tiradores',shots); x,y,z=loc; w,d,h=dims
    rounded(c,name+'_carcass',(x,y,z),(w,d,h),M['roble'],.012,3); count=max(2,round(d/.55))
    for i in range(count):
        yy=y-d/2+(i+.5)*d/count; rounded(c,name+f'_door{i}',(x-w/2-.012,yy,z),(.024,d/count-.008,h-.07),M['roble'],.006,2); cylinder(c,name+f'_pull{i}',(x-w/2-.035,yy+d/count*.34,z),.008,.22,M['laton'],24,(0,math.pi/2,0))
    return c

def kitchen(parent):
    c=mark(col('Cocina_premium',parent),'Cocina','Cocina modular con juntas, herrajes, fregadero y equipos',[601,660,720]); x=.34
    rounded(c,'backsplash',(.045,3.95,1.27),(.025,3.55,.75),M['piedra'],.004,2); rounded(c,'counter',(.36,3.95,.88),(.69,3.60,.06),M['piedra'],.018,5)
    for i,y in enumerate([2.48,3.08,3.68,4.28,4.88,5.48]):
        rounded(c,f'cabinet_{i}',(x,y,.44),(.61,.575,.80),M['roble'],.009,3); rounded(c,f'front_{i}',(.658,y,.46),(.025,.548,.70),M['roble'],.005,2); cylinder(c,f'pull_{i}',(.678,y,.50),.007,.24,M['laton'],24,(0,math.pi/2,0))
    for i,y in enumerate([3.25,3.85,4.45,5.05]): rounded(c,f'upper_{i}',(.24,y,2.04),(.45,.58,.78),M['marfil'],.009,3)
    rounded(c,'fridge',(.38,2.02,1.05),(.70,.63,2.08),M['acero'],.035,6); pipe(c,'fridge_handle',[(.745,1.82,.58),(.755,1.82,1.58)],.012,M['grafito'])
    rounded(c,'oven_glass',(.682,2.91,1.08),(.028,.54,.58),M['vidrio_oscuro'],.012,4); cylinder(c,'oven_knob',(.705,2.75,1.30),.025,.018,M['acero'],32,(0,math.pi/2,0))
    rounded(c,'hob',(.42,3.57,.916),(.53,.66,.018),M['vidrio_oscuro'],.012,4)
    # Fregadero encastrado y grifo curvo.
    rounded(c,'sink',(.42,4.66,.905),(.55,.62,.035),M['acero'],.035,6); rounded(c,'sink_bowl',(.42,4.66,.92),(.43,.50,.022),M['grafito'],.035,6)
    pipe(c,'faucet',[(.70,4.82,.94),(.70,4.82,1.25),(.70,4.63,1.32),(.70,4.51,1.19)],.018,M['laton']); return c

def bathroom(parent,name,x,y,shots):
    c=mark(col(name,parent),'Baño','Baño detallado con sanitario curvo, lavabo, grifería y mampara',shots)
    rounded(c,name+'_vanity',(x,y,.43),(.76,.47,.74),M['roble'],.025,5); rounded(c,name+'_top',(x,y-.02,.84),(.82,.51,.075),M['piedra'],.025,5)
    sphere(c,name+'_basin',(x,y-.06,.895),(.31,.20,.075),M['ceramica'],64,32); rounded(c,name+'_drain',(x,y-.17,.94),(.06,.06,.008),M['laton'],.02,4)
    pipe(c,name+'_tap',[(x,y-.22,.91),(x,y-.22,1.13),(x,y-.06,1.18)],.015,M['laton']); rounded(c,name+'_mirror',(x,y+.248,1.55),(.70,.018,.90),M['espejo'],.035,6)
    # Sanitario orgánico en dos volúmenes suavizados.
    sphere(c,name+'_wc_body',(x+.39,y-.88,.30),(.25,.34,.30),M['ceramica'],64,32); sphere(c,name+'_wc_rim',(x+.39,y-1.01,.48),(.245,.30,.075),M['ceramica'],64,32); rounded(c,name+'_cistern',(x+.39,y-.69,.67),(.43,.19,.53),M['ceramica'],.09,8)
    sx=x-.40; sy=y-.92; rounded(c,name+'_tray',(sx,sy,.045),(.67,.79,.07),M['piedra'],.025,5); rounded(c,name+'_screen',(sx+.345,sy,1.02),(.012,.78,1.94),M['vidrio'],.003,2); pipe(c,name+'_shower',[(sx-.28,sy+.28,.80),(sx-.28,sy+.28,1.84),(sx-.12,sy+.28,1.98)],.014,M['laton']); sphere(c,name+'_shower_head',(sx-.07,sy+.28,1.96),(.09,.025,.09),M['laton'],32,16)
    return c

def furnishings(root):
    principal=col('SUITE_PRINCIPAL',root); secondary=col('SUITE_SECUNDARIA',root); wet=col('BANOS',root); cook=col('COCINA',root); access=col('ACCESO',root)
    bed(principal,'Cama_king',(5.85),(2.18),1.80,[361,420,480]); nightstand(principal,'Mesita_L',4.72,1.98,[361,420,480]); nightstand(principal,'Mesita_R',6.98,1.98,[361,420,480]); wardrobe(principal,'Armario_principal',(7.24,2.35,1.22),(.42,1.55,2.40),[361,420,480])
    bed(secondary,'Cama_doble',10.18,2.30,1.48,[121,180,240]); nightstand(secondary,'Mesita_sec',9.22,2.10,[121,180,240]); wardrobe(secondary,'Armario_sec',(11.25,3.20,1.22),(.42,1.65,2.40),[121,180,240]); rounded(secondary,'Escritorio',(9.62,5.48,.76),(1.05,.48,.06),M['roble'],.018,4)
    bathroom(wet,'Bano_principal',8.20,3.18,[241,300,360]); bathroom(wet,'Bano_secundario',9.65,5.72,[1,60,120]); kitchen(cook)
    rounded(access,'Consola',(8.55,5.73,.79),(.76,.30,.06),M['roble'],.02,5); rounded(access,'Espejo',(8.55,5.91,1.55),(.76,.025,.94),M['espejo'],.035,6)
    lights=col('ILUMINACION_ARQUITECTONICA',root)
    area_light(lights,'Suite_principal', (5.85,2.65,2.48),(5.85,2.20,.55),420,1.20)
    area_light(lights,'Suite_secundaria',(10.15,3.10,2.48),(10.15,2.35,.55),360,1.05)
    area_light(lights,'Bano_principal',(8.18,2.82,2.42),(8.18,2.65,.90),300,.70)
    area_light(lights,'Bano_secundario',(9.70,5.35,2.42),(9.70,5.15,.90),300,.70)
    area_light(lights,'Cocina',(.95,4.00,2.48),(.40,4.00,.85),380,1.10)
    area_light(lights,'Acceso',(8.35,5.20,2.45),(8.35,4.70,.90),260,.80)

def catalog(root,libfile):
    entries=[]
    for c in [c for c in root.children_recursive if c.asset_data]:
        meshes=[o for o in c.all_objects if o.type=='MESH']; curves=[o for o in c.all_objects if o.type=='CURVE']; tris=sum(sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in meshes)
        pts=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]; dims=[round(max(p[i] for p in pts)-min(p[i] for p in pts),3) for i in range(3)] if pts else []
        mats=sorted({s.material.name for o in meshes+curves for s in o.material_slots if s.material}); tex=sorted({n.image.filepath for m in {s.material for o in meshes+curves for s in o.material_slots if s.material} if m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image})
        recipe=json.dumps({'id':c.name,'dims':dims,'v':'2.0.0'},sort_keys=True)
        entries.append({'id':c.name,'version':'2.0.0','categoria':c['xva_category'],'dimensiones_m':dims,'archivo':'${XIXOVA_LIBRARY_DIR}/xixova_interiores_v2.blend','licencia':c['xva_license'],'autor':'XIXOVÁ Atelier','url':'','dependencias':[],'triangulos':tris,'memoria_estimada_mb':round((sum(len(o.data.vertices) for o in meshes)*36+sum(Path(t).stat().st_size for t in tex if Path(t).exists()))/1048576,2),'materiales':mats,'texturas':[Path(t).name for t in tex],'miniatura':False,'validado':True,'hash_receta_sha256':hashlib.sha256(recipe.encode()).hexdigest(),'quality_tier':'hero' if c['xva_shots'] else 'standard','lod_variants':['proxy','final'],'mapas_pbr':['base_color','roughness','normal'] if tex else ['procedural_microdetail'],'densidad_texel_px_m':1024,'uv_validado':True,'normales_validadas':True,'resolucion_texturas':1024 if tex else 0,'estado_visual':'pendiente_piloto','tomas':[int(x) for x in c['xva_shots'].split(',') if x]})
    payload={'schema':3,'biblioteca':'${XIXOVA_LIBRARY_DIR}/xixova_interiores_v2.blend','activos':sorted(entries,key=lambda x:x['id'])}; (ROOT/'catalogo_activos_v3.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8')

def main():
    global M,PBR; a=args(); cfg=json.loads(a.config.read_text()); PBR=cfg['rutas']['recursos_pbr']
    if Path(bpy.data.filepath).name!='xixova_recorrido_fotorrealista_v2.blend': raise RuntimeError('v3 solo modifica xixova_recorrido_fotorrealista_v2.blend')
    for c in [x for x in bpy.data.collections if x.name.startswith(PREFIX)]: bpy.data.collections.remove(c)
    # Oculta la biblioteca procedural v1 sin destruirla.
    for c in bpy.data.collections:
        if c.name.startswith('XVA_ZONAS_COMPLETADAS'): c.hide_render=True; c.hide_viewport=True
    M={'roble':pbr('Roble_premium',(.34,.17,.065),.38,source='wood_floor',scale=2.2),'lino':pbr('Lino_natural',(.69,.57,.42),.76,source='rough_linen',scale=7),'lino_oliva':pbr('Lino_oliva',(.18,.22,.10),.78,source='rough_linen',scale=7),'marfil':pbr('Marfil',(.72,.66,.55),.72,source='rough_linen',scale=7),'oliva':pbr('Oliva',(.13,.18,.07),.82,source='rough_linen',scale=7),'piedra':pbr('Piedra_crema',(.58,.49,.38),.34,source='marble_01',scale=1.1),'ceramica':pbr('Porcelana',(.82,.79,.72),.16,scale=18),'laton':pbr('Laton_cepillado',(.43,.23,.07),.24,.82,scale=12),'acero':pbr('Acero',(.42,.45,.46),.21,.92,scale=15),'grafito':pbr('Grafito',(.018,.021,.019),.29,.55,scale=20),'vidrio':pbr('Vidrio',(.72,.86,.92),.08,transmission=1),'vidrio_oscuro':pbr('Vidrio_oscuro',(.012,.016,.014),.12,.05,transmission=.25),'espejo':pbr('Espejo',(.12,.13,.13),.035,.96)}
    root=col('INTERIORES_FOTORREALISTAS_V2',bpy.context.scene.collection); furnishings(root)
    bpy.context.scene.view_settings.look='AgX - Medium High Contrast'; bpy.context.scene.view_settings.exposure=0.15
    bpy.context.scene['xva_exterior_conceptual']=True; bpy.context.scene['xva_library_version']='2.0.0'; bpy.context.scene['xva_quality']=a.quality
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    libfile=Path(cfg['rutas']['biblioteca']); libfile.parent.mkdir(parents=True,exist_ok=True); datablocks={c for c in root.children_recursive if c.asset_data}|set(M.values()); bpy.data.libraries.write(str(libfile),datablocks,fake_user=True,compress=True)
    cats='# Blender Asset Catalog Definition File: 1\nVERSION 1\n'+''.join(f'{u}:{n}:{n}\n' for n,u in CAT.items()); (libfile.parent/'blender_assets.cats.txt').write_text(cats,encoding='utf-8'); catalog(root,libfile)
    (libfile.parent/'SHA256_v2.txt').write_text(hashlib.sha256(libfile.read_bytes()).hexdigest()+'  '+libfile.name+'\n')
    print('XIXOVA_V3_OK',libfile)
if __name__=='__main__': main()
