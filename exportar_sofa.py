"""Blender: selecciona SOLO el sofá completo y ejecuta este texto desde Scripting.
Exporta una copia de la selección y sus hijos; no modifica el archivo de proyecto.
"""
from pathlib import Path
import bpy

selected = set(bpy.context.selected_objects)
for obj in list(selected):
    selected.update(obj.children_recursive)
if not any(o.type == 'MESH' or o.instance_collection for o in selected):
    raise RuntimeError('Selecciona el sofa completo antes de ejecutar.')
# Empaca las imágenes para que la copia no dependa del caché de BlenderKit.
bpy.ops.file.pack_all()
folder = Path.home() / 'RenderCasa' / 'recursos_atelier'
folder.mkdir(parents=True, exist_ok=True)
path = folder / 'sofa.blend'
if path.exists():
    import datetime
    path = folder / ('sofa_'+datetime.datetime.now().strftime('%Y%m%d_%H%M%S')+'.blend')
bpy.data.libraries.write(str(path), selected, path_remap='ABSOLUTE', fake_user=True, compress=True)
print('SOFA EXPORTADO:', path)
# El texto queda visible en el editor de Blender después de ejecutar.
report = bpy.data.texts.new('SOFA_EXPORTADO.txt')
report.write('Sofa exportado a:\n'+str(path)+'\nUsa esta ruta en --sofa si no se llama sofa.blend.\n')
if bpy.context.area and bpy.context.area.type == 'TEXT_EDITOR':
    bpy.context.space_data.text = report
