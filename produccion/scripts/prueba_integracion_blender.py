"""Prueba de humo ejecutable sobre una escena temporal, nunca sobre producción."""
import sys
from pathlib import Path
import bpy

target=Path(sys.argv[sys.argv.index('--salida')+1]).resolve()
if target.exists(): raise RuntimeError('La prueba no sobrescribe archivos')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(location=(0,0,0)); cube=bpy.context.object; cube.name='TEST_CUBE'
scene=bpy.context.scene; scene.frame_start=1; scene.frame_end=3; scene.render.fps=24
scene.render.resolution_x=64; scene.render.resolution_y=64; scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(target))
assert len(scene.objects)==1 and scene.frame_end==3
print('INTEGRATION_SCENE_OK',target)
