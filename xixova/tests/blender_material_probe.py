"""Run with Blender --background --python; validates material isolation and UV scale."""
import sys,tempfile,json
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from blender_build import box,material,collection
bpy.ops.wm.read_factory_settings(use_empty=True)
c=collection('TEST');m=material('wood',{'color':[.3,.2,.1],'rugosidad':.4})
o=box(c,'metric',(0,0,0),(2,3,4),m,bevel=0)
for face in o.data.polygons:
    loops=list(face.loop_indices)
    for first,second in zip(loops,loops[1:]+loops[:1]):
        a=o.data.vertices[o.data.loops[first].vertex_index].co;b=o.data.vertices[o.data.loops[second].vertex_index].co
        ua=o.data.uv_layers.active.data[first].uv;ub=o.data.uv_layers.active.data[second].uv
        assert abs((a-b).length-(ua-ub).length)<1e-5
copy=o.copy();c.objects.link(copy)
copy.material_slots[0].link='OBJECT';copy.material_slots[0].material=m.copy()
copy.material_slots[0].material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.9
assert abs(o.material_slots[0].material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value-.4)<1e-5
print('MATERIAL_PROBE_OK: metric UV on six faces; material variation isolated')
