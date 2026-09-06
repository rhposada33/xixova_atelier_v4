"""Genera miniaturas internas para los activos de la biblioteca central."""
import sys
import time
from pathlib import Path

import bpy

if '--biblioteca' in sys.argv:
    library = Path(sys.argv[sys.argv.index('--biblioteca') + 1])
elif '--' in sys.argv and len(sys.argv) > sys.argv.index('--') + 1:
    library = Path(sys.argv[sys.argv.index('--') + 1])
else:
    library = Path('/home/rafa/RenderCasa/biblioteca_blender/xixova_interiores_v1.blend')
if Path(bpy.data.filepath) != library:
    bpy.ops.wm.open_mainfile(filepath=str(library), load_ui=False, use_scripts=False)
assets = [*filter(lambda x: x.asset_data, bpy.data.collections), *filter(lambda x: x.asset_data, bpy.data.materials)]
for datablock in assets:
    datablock.asset_generate_preview()
deadline = time.time() + 180
while bpy.app.is_job_running('RENDER_PREVIEW') and time.time() < deadline:
    time.sleep(.1)
bpy.ops.wm.save_as_mainfile(filepath=str(library))
missing = [x.name for x in assets if not x.preview or tuple(x.preview.image_size) == (0, 0)]
print(f'PREVIEWS={len(assets)-len(missing)}/{len(assets)}; faltantes={missing}')
if missing:
    raise RuntimeError('No se generaron todas las miniaturas')
