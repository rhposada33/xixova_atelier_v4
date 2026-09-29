"""Pruebas de captura dentro de Blender sobre una escena sincronizable.

blender --background --factory-startup escena.blend --python-exit-code 1 \
  --python xixova/tests/comprobar_sync_blender.py
"""
import json
from pathlib import Path
import sys
import bpy
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import blender_sync as sync

initial = sync.capturar()
assert initial['base']['protegido'] == initial['actual']['protegido']
scene = bpy.context.scene
arch = next(o for o in scene.objects if o.get('xixova_capa') == 'ARQUITECTURA' and o.type == 'MESH')
old = arch.location.copy()
arch.location.x += .05
assert sync.capturar()['actual']['protegido'] != initial['actual']['protegido']
arch.location = old
vertex = arch.data.vertices[0]
old = vertex.co.copy()
vertex.co.x += .01
arch.data.update()
assert sync.capturar()['actual']['protegido'] != initial['actual']['protegido']
arch.data.vertices[0].co = old
arch.data.update()
root = next(o for o in scene.objects if o.get('xixova_sync_role') == 'elemento')
scale = root.scale.copy()
root.scale.x *= 1.1
try:
    sync.capturar()
    raise AssertionError('Se aceptó escala no uniforme')
except ValueError:
    pass
root.scale = scale
camera = next(o for o in scene.objects if o.get('xixova_sync_role') == 'camara')
scene.frame_set(1)
location = camera.location.copy()
camera.location.x += .1
try:
    sync.capturar()
    raise AssertionError('Se aceptó cámara sin clave')
except ValueError as error:
    assert 'sin insertar clave' in str(error), str(error)
    assert abs(camera.location.x-location.x-.1) < 1e-5, 'La captura descartó la edición'
scene.frame_set(1)
assert sync.capturar()['actual']['protegido'] == initial['actual']['protegido']
print('SYNC_BLENDER_OK: arquitectura, mallas, escala y cámaras sin clave protegidas; captura restaura la edición.')
