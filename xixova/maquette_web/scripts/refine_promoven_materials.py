"""Run in a dedicated Blender session to import and refine xixova-building-visual-v2.glb.
Material/UV-only presentation refinement; preserve every object's matrix and mesh positions.
"""
import bpy, hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
# This script runs in a dedicated background Blender instance.
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/building/xixova-building-visual-v2.glb'))
def signature():
    return {o.name: {'matrix': [list(r) for r in o.matrix_world], 'positions': hashlib.sha256(str([tuple(v.co) for v in o.data.vertices]).encode()).hexdigest()} for o in bpy.context.scene.objects if o.type=='MESH'}
before=signature()
colors={'ivory':(.72,.69,.61,1),'slab':(.64,.61,.54,1),'bronze':(.20,.13,.075,1),'window':(.075,.13,.15,1),'glass':(.30,.43,.46,.36),'graphite':(.085,.10,.10,1),'leaf':(.055,.12,.045,1),'leaf_light':(.13,.22,.08,1),'ground':(.46,.47,.39,1)}
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if not shader: continue
    key=mat.name.removeprefix('XIXOVA_')
    if key in colors: shader.inputs['Base Color'].default_value=colors[key]
    if key in ('ivory','slab'): shader.inputs['Roughness'].default_value=.72
    if key=='bronze': shader.inputs['Metallic'].default_value=.65; shader.inputs['Roughness'].default_value=.32
    if key=='window': shader.inputs['Metallic'].default_value=.48; shader.inputs['Roughness'].default_value=.22
    if key=='glass': shader.inputs['Roughness'].default_value=.16
# Reuse the repository's licensed concrete normal map, maintaining geometry and IDs.
normal_path=ROOT/'assets/promoven/brushed_concrete_nor_gl_1k.jpg'
if normal_path.exists():
    image=bpy.data.images.load(str(normal_path),check_existing=True); image.colorspace_settings.name='Non-Color'; image.pack()
    for mat in bpy.data.materials:
        if mat.name not in ('XIXOVA_ivory','XIXOVA_slab'): continue
        shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
        normal=mat.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value=.18
        mat.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],shader.inputs['Normal'])
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH' or obj.name.startswith('UNIT_'):continue
        if not any(m and m.name in ('XIXOVA_ivory','XIXOVA_slab') for m in obj.data.materials):continue
        uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='FacadeMetricUV')
        for poly in obj.data.polygons:
            axis=max(range(3),key=lambda i:abs(poly.normal[i])); axes=[i for i in range(3) if i!=axis]
            for index in poly.loop_indices:
                co=obj.data.vertices[obj.data.loops[index].vertex_index].co
                uv.data[index].uv=(co[axes[0]]/3,co[axes[1]]/3)
assert before==signature(), 'Protected object transform or mesh coordinates changed'
master=ROOT/'assets/promoven/promoven-premium-materials.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(master))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/building/promoven-premium.glb'),export_format='GLB',export_extras=True)
report={'source':'public/building/xixova-building-visual-v2.glb','output':'public/building/promoven-premium.glb','unit_count':len([n for n in before if n.startswith('UNIT_')]),'geometry_and_transforms_preserved':before==signature(),'material_changes':list(colors),'normal_texture':'assets/promoven/brushed_concrete_nor_gl_1k.jpg','protected_objects':before}
(ROOT/'assets/promoven/premium-materials-manifest.json').write_text(json.dumps(report,indent=2))
print('Saved refined master and GLB; protected objects:',len(before),'UNIT count:',report['unit_count'])
