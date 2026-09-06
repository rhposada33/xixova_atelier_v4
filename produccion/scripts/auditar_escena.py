import json
from pathlib import Path
import bpy

out = Path(__file__).resolve().parents[1] / "salidas" / "auditoria_escena.json"
scene = bpy.context.scene
missing = []
for image in bpy.data.images:
    if image.source == 'FILE' and not image.packed_file:
        path = Path(bpy.path.abspath(image.filepath))
        if not path.is_file():
            missing.append({"imagen": image.name, "ruta": str(path)})

objects = []
for obj in scene.objects:
    if obj.type == 'MESH':
        objects.append({
            "nombre": obj.name,
            "centro": [round(v, 4) for v in obj.location],
            "dimensiones": [round(v, 4) for v in obj.dimensions],
        })

sofas = [x for x in objects if 'sofa' in x['nombre'].lower()]
report = {
    "blender": bpy.app.version_string,
    "escena": scene.name,
    "objetos": len(scene.objects),
    "mallas": len(objects),
    "materiales": len(bpy.data.materials),
    "imagenes": len(bpy.data.images),
    "imagenes_ausentes": missing,
    "recursos_empacados": all(i.packed_file or i.source != 'FILE' for i in bpy.data.images),
    "sofa_objetos": sofas,
    "rango": [scene.frame_start, scene.frame_end],
    "fps": scene.render.fps,
    "resolucion": [scene.render.resolution_x, scene.render.resolution_y],
}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
print("AUDITORIA=" + str(out), flush=True)
