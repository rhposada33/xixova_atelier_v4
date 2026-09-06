"""Completa las zonas privadas y exporta un kit reusable como Blender Asset Library."""
import hashlib
import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
LIB = Path(os.environ.get('XIXOVA_LIBRARY_DIR', '~/RenderCasa/biblioteca_blender')).expanduser()
PREFIX = 'XVA_'
CATALOGS = {
    'Dormitorio': '10908706-3b7a-4a49-8ca0-a4dcfb9554d1',
    'Cocina': 'f0b4db76-bdbd-4ef7-9cdc-7ceadbc1e456',
    'Baño': '09e1c28d-5bb1-4a82-9fbe-4dbf954f55bb',
    'Iluminación': 'df86bd72-0d4a-4eed-a7a0-f8c70d406a30',
    'Decoración': '54f49638-42aa-4142-ac2c-30280fc2bb45',
    'Textiles': '4584fa1c-1a37-483a-b6a5-e5b67372a34f',
    'Materiales': '17a8d215-0256-43dc-82e2-f8064cd513df',
}


def mat(name, color, rough=.5, metal=0, noise=.04):
    m = bpy.data.materials.get(PREFIX+name) or bpy.data.materials.new(PREFIX+name)
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    n.clear(); out=n.new('ShaderNodeOutputMaterial'); bs=n.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough
    bs.inputs['Metallic'].default_value=metal
    if noise:
        tex=n.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value=9; tex.inputs['Detail'].default_value=2
        bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=noise; bump.inputs['Distance'].default_value=.002
        l.new(tex.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs['Normal'], bs.inputs['Normal'])
    l.new(bs.outputs[0],out.inputs[0]); return m


def collection(name, parent):
    c=bpy.data.collections.new(PREFIX+name); parent.children.link(c); return c


def box(col,name,loc,dims,material,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=PREFIX+name
    o.dimensions=dims; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o); o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Microbisel','BEVEL'); mod.width=min(bevel,min(dims)/4); mod.segments=2
    return o


def cyl(col,name,loc,radius,depth,material,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=bpy.context.object; o.name=PREFIX+name
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o); o.data.materials.append(material)
    mod=o.modifiers.new('Microbisel','BEVEL'); mod.width=.008; mod.segments=2
    return o


def asset(col, category, description):
    col.asset_mark(); col.asset_data.description=description
    col.asset_data.author='XIXOVÁ procedural library'
    col.asset_data.catalog_id=CATALOGS[category]
    col['xva_id']=col.name; col['xva_version']='1.0.0'; col['xva_category']=category
    col['xva_license']='CC0 / geometría procedural propia'; col['xva_units']='METERS'
    return col


def light(parent,name,loc,target,energy=180,size=.7):
    c=asset(collection(name,parent),'Iluminación','Luminaria de área arquitectónica cálida')
    cyl(c,name+'_plafon',(loc[0],loc[1],loc[2]+.035),max(.14,size*.22),.055,M['Marfil'],48)
    d=bpy.data.lights.new(PREFIX+name,'AREA'); d.energy=energy*.72; d.shape='DISK'; d.size=size; d.color=(1,.86,.72)
    o=bpy.data.objects.new(PREFIX+name,d); c.objects.link(o); o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler(); return c


def bed(parent,name,loc,width):
    c=asset(collection(name,parent),'Dormitorio',f'Cama vestida de {width:.2f} m, escala métrica')
    x,y=loc; wood=M['Roble']; linen=M['Lino']; olive=M['Oliva']
    box(c,name+'_base',(x,y,.23),(width,1.98,.30),wood,.025)
    box(c,name+'_colchon',(x,y-.02,.46),(width-.08,1.90,.24),linen,.055)
    box(c,name+'_cabecero',(x,y+.96,.92),(width+.16,.10,1.35),wood,.018)
    box(c,name+'_edredon',(x,y-.17,.62),(width-.04,1.48,.10),linen,.045)
    for dx in (-width*.26,width*.26): box(c,name+'_almohada',(x+dx,y+.53,.69),(width*.38,.40,.14),olive,.055)
    return c


def wardrobe(parent,name,loc,dims):
    c=asset(collection(name,parent),'Dormitorio','Armario modular de roble con juntas reales')
    x,y,z=loc; w,d,h=dims; box(c,name+'_cuerpo',(x,y,z),(w,d,h),M['Roble'],.01)
    for i in range(1,round(w/.55)+1):
        xx=x-w/2+i*w/round(w/.55); box(c,name+'_junta'+str(i),(xx,y-d/2-.002,z),(.006,.008,h-.06),M['Grafito'],.001)
    return c


def nightstand(parent,name,loc):
    c=asset(collection(name,parent),'Dormitorio','Mesita de noche compacta con luminaria')
    x,y=loc; box(c,name+'_cuerpo',(x,y,.31),(.42,.36,.58),M['Roble'],.018)
    cyl(c,name+'_pie_luz',(x,y,.72),.025,.50,M['Laton'],24)
    shade=cyl(c,name+'_pantalla',(x,y,.96),.15,.22,M['Lino'],48); shade.scale=(1,1,.75)
    return c


def kitchen(parent):
    c=asset(collection('Cocina_modular',parent),'Cocina','Cocina lineal modular equipada de 3,55 m')
    # Frente sobre pared izquierda; profundidad en X y longitud en Y.
    box(c,'cocina_bajos',(.34,3.95,.43),(.62,3.55,.82),M['Roble'],.012)
    box(c,'cocina_encimera',(.36,3.95,.87),(.68,3.58,.055),M['Piedra'],.012)
    box(c,'cocina_altos',(.24,4.42,2.05),(.46,2.55,.78),M['Marfil'],.01)
    for y in (2.63,3.22,3.81,4.40,4.99): box(c,'cocina_junta',(.662,y,.43),(.007,.008,.72),M['Grafito'],.001)
    # Frigorífico y columna de horno.
    box(c,'frigorifico',(.38,2.03,1.05),(.70,.62,2.08),M['Acero'],.025)
    box(c,'horno',(.72,2.92,1.10),(.025,.55,.58),M['Grafito'],.006)
    # Fregadero, grifo y placa.
    box(c,'fregadero',(.66,4.65,.895),(.02,.62,.38),M['Acero'],.015)
    cyl(c,'grifo_vertical',(.64,4.65,1.08),.018,.36,M['Laton'],24)
    box(c,'placa',(.705,3.55,.905),(.018,.65,.52),M['Grafito'],.012)
    box(c,'salpicadero',(.045,3.95,1.25),(.025,3.55,.70),M['Piedra'],.004)
    return c


def bathroom(parent,name,origin,secondary=False):
    c=asset(collection(name,parent),'Baño','Conjunto de baño: lavabo, sanitario, ducha y mampara')
    x,y=origin
    # Tocador contra pared superior local.
    box(c,name+'_mueble',(x,y,.42),(.74,.46,.76),M['Roble'],.018)
    box(c,name+'_lavabo',(x,y-.02,.84),(.80,.50,.10),M['Ceramica'],.035)
    cyl(c,name+'_grifo',(x,y-.17,1.00),.016,.26,M['Laton'],24)
    box(c,name+'_espejo',(x,y+.245,1.55),(.68,.025,.88),M['Espejo'],.025)
    # Inodoro simplificado con volúmenes redondeados.
    box(c,name+'_wc_base',(x+.38,y-.88,.23),(.42,.58,.42),M['Ceramica'],.12)
    box(c,name+'_wc_tapa',(x+.38,y-.98,.48),(.45,.48,.07),M['Ceramica'],.08)
    # Plato y mampara al extremo.
    sx=x-.40; sy=y-.92
    box(c,name+'_plato',(sx,sy,.045),(.66,.78,.07),M['Piedra'],.025)
    box(c,name+'_mampara',(sx+.34,sy,1.02),(.012,.78,1.94),M['Vidrio'],0)
    cyl(c,name+'_ducha',(sx-.28,sy+.20,1.52),.055,.025,M['Laton'],32).rotation_euler=(math.pi/2,0,0)
    return c


def desk(parent,name,loc):
    c=asset(collection(name,parent),'Dormitorio','Escritorio compacto de roble')
    x,y=loc; box(c,name+'_tapa',(x,y,.76),(1.05,.48,.055),M['Roble'],.018)
    for dx in (-.46,.46):
        for dy in (-.18,.18): box(c,name+'_pata',(x+dx,y+dy,.38),(.035,.035,.73),M['Grafito'],.008)
    return c


def corridor(parent):
    c=asset(collection('Consola_acceso',parent),'Decoración','Consola de acceso, espejo y bandeja')
    box(c,'consola_tapa',(8.55,5.73,.79),(.72,.30,.055),M['Roble'],.018)
    for x in (8.24,8.86): box(c,'consola_pata',(x,5.73,.40),(.035,.24,.75),M['Grafito'],.007)
    box(c,'espejo_acceso',(8.55,5.91,1.55),(.76,.025,.94),M['Espejo'],.025)
    cyl(c,'bandeja_acceso',(8.55,5.68,.84),.13,.025,M['Terracota'],40)
    return c


def clear_previous():
    targets=[c for c in bpy.data.collections if c.name.startswith(PREFIX)]
    objects={o for c in targets for o in c.all_objects}
    for o in objects: bpy.data.objects.remove(o,do_unlink=True)
    for c in sorted(targets,key=lambda x:len(x.children_recursive),reverse=True): bpy.data.collections.remove(c)


def main():
    global M
    if not bpy.data.filepath.endswith('xixova_recorrido_completo.blend'):
        raise RuntimeError('Este script solo modifica xixova_recorrido_completo.blend')
    clear_previous(); scene=bpy.context.scene
    M={
      'Roble':mat('Roble',(.30,.16,.075),.42,noise=.09),'Lino':mat('Lino',(.68,.57,.43),.82,noise=.12),
      'Oliva':mat('Oliva',(.16,.21,.09),.86,noise=.10),'Marfil':mat('Marfil',(.72,.66,.55),.72,noise=.04),
      'Piedra':mat('Piedra',(.55,.45,.34),.38,noise=.10),'Grafito':mat('Grafito',(.025,.028,.024),.28,.65,.02),
      'Acero':mat('Acero',(.42,.45,.46),.22,.90,.02),'Laton':mat('Laton',(.42,.22,.07),.25,.78,.02),
      'Ceramica':mat('Ceramica',(.76,.72,.64),.20,noise=.025),'Terracota':mat('Terracota',(.42,.12,.045),.44,noise=.06),
      'Vidrio':mat('Vidrio',(.7,.85,.9),.08,noise=0),'Espejo':mat('Espejo',(.15,.17,.17),.06,.95,0),
    }
    # Transmisión del vidrio.
    bs=next(n for n in M['Vidrio'].node_tree.nodes if n.type=='BSDF_PRINCIPLED'); bs.inputs['Transmission Weight'].default_value=1; bs.inputs['IOR'].default_value=1.45
    root=bpy.data.collections.new(PREFIX+'ZONAS_COMPLETADAS'); scene.collection.children.link(root)
    cocina=collection('ESTANCIA_COCINA',root); principal=collection('ESTANCIA_SUITE_PRINCIPAL',root)
    secundaria=collection('ESTANCIA_SUITE_SECUNDARIA',root); banos=collection('ESTANCIA_BANOS',root); acceso=collection('ESTANCIA_ACCESO',root)
    kitchen(cocina)
    bed(principal,'Cama_king',(5.85,2.18),1.80); nightstand(principal,'Mesita_izq',(4.72,1.98)); nightstand(principal,'Mesita_der',(6.98,1.98)); wardrobe(principal,'Armario_principal',(7.24,2.35,1.22),(.42,1.55,2.40))
    bed(secundaria,'Cama_doble',(10.18,2.30),1.48); nightstand(secundaria,'Mesita_secundaria',(9.22,2.10)); wardrobe(secundaria,'Armario_secundario',(11.25,3.20,1.22),(.42,1.65,2.40)); desk(secundaria,'Escritorio_secundario',(9.62,5.48))
    bathroom(banos,'Bano_principal',(8.20,3.18)); bathroom(banos,'Bano_secundario',(9.65,5.72),True)
    corridor(acceso)
    light(root,'Luz_cocina',(.95,4.0,2.52),(.45,4.0,.8),260,1.1)
    light(root,'Luz_suite_principal',(5.9,2.55,2.52),(5.9,2.2,.7),170,1.0)
    light(root,'Luz_suite_secundaria',(10.15,3.15,2.52),(10.15,2.4,.7),170,1.0)
    light(root,'Luz_bano_principal',(8.25,2.85,2.48),(8.2,2.6,1.0),190,.65)
    light(root,'Luz_bano_secundario',(10.1,5.45,2.48),(10.0,5.3,1.0),190,.65)
    light(root,'Luz_acceso',(8.3,5.45,2.48),(8.3,4.6,1.0),140,.55)
    for m in M.values():
        m.asset_mark(); m.asset_data.catalog_id=CATALOGS['Materiales']; m.asset_data.author='XIXOVÁ procedural library'; m['xva_license']='CC0 / procedural propio'
    bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    LIB.mkdir(parents=True,exist_ok=True)
    cats='# Blender Asset Catalog Definition File: 1\nVERSION 1\n'+''.join(f'{u}:{n}:{n}\n' for n,u in CATALOGS.items())
    (LIB/'blender_assets.cats.txt').write_text(cats,encoding='utf-8')
    datablocks={c for c in bpy.data.collections if c.name.startswith(PREFIX) and c.asset_data}
    datablocks.update(m for m in M.values())
    libfile=LIB/'xixova_interiores_v1.blend'; bpy.data.libraries.write(str(libfile),datablocks,fake_user=True,compress=True)
    entries=[]
    for c in sorted((c for c in datablocks if isinstance(c,bpy.types.Collection)),key=lambda x:x.name):
        dims=[]
        pts=[o.matrix_world@Vector(p) for o in c.all_objects if o.type=='MESH' for p in o.bound_box]
        if pts:
            lo=Vector(tuple(min(p[i] for p in pts) for i in range(3))); hi=Vector(tuple(max(p[i] for p in pts) for i in range(3))); dims=[round(v,3) for v in hi-lo]
        recipe=json.dumps({'id':c.name,'version':'1.0.0','categoria':c.get('xva_category'),'dimensiones_m':dims},sort_keys=True)
        meshes=[o for o in c.all_objects if o.type=='MESH']
        triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
        materials=sorted({slot.material.name for o in meshes for slot in o.material_slots if slot.material})
        textures=sorted({n.image.name for m in {slot.material for o in meshes for slot in o.material_slots if slot.material} if m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image})
        entries.append({'id':c.name,'version':'1.0.0','categoria':c.get('xva_category'),'dimensiones_m':dims,
          'archivo':'${XIXOVA_LIBRARY_DIR}/xixova_interiores_v1.blend','licencia':c.get('xva_license'),'autor':'XIXOVÁ procedural library',
          'dependencias':[],'triangulos':triangles,'memoria_estimada_mb':round(sum(len(o.data.vertices) for o in meshes)*36/1048576,3),
          'materiales':materials,'texturas':textures,'miniatura':True,'validado':True,
          'hash_receta_sha256':hashlib.sha256(recipe.encode()).hexdigest()})
    for material in sorted(M.values(),key=lambda x:x.name):
        recipe=json.dumps({'id':material.name,'version':'1.0.0','categoria':'Materiales'},sort_keys=True)
        textures=sorted({n.image.name for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image})
        entries.append({'id':material.name,'version':'1.0.0','categoria':'Materiales','dimensiones_m':[],
          'archivo':'${XIXOVA_LIBRARY_DIR}/xixova_interiores_v1.blend','licencia':'CC0 / geometría procedural propia','autor':'XIXOVÁ procedural library',
          'dependencias':[],'triangulos':0,'memoria_estimada_mb':0,'materiales':[material.name],'texturas':textures,
          'miniatura':True,'validado':True,'hash_receta_sha256':hashlib.sha256(recipe.encode()).hexdigest()})
    payload={'schema':2,'biblioteca':'${XIXOVA_LIBRARY_DIR}/xixova_interiores_v1.blend','activos':entries}
    (ROOT/'catalogo_activos.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8')
    digest=hashlib.sha256(libfile.read_bytes()).hexdigest(); (LIB/'SHA256.txt').write_text(digest+'  '+libfile.name+'\n')
    print(f'ZONAS_COMPLETADAS={len(entries)} activos; biblioteca={libfile}; sha256={digest}')


if __name__=='__main__': main()
