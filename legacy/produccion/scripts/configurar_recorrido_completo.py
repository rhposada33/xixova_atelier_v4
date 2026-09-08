"""Crea siete tomas de auditoría/recorrido sin reconstruir la escena base."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pipeline_common import load_config

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = 'xixova_recorrido_completo.blend'

SHOTS = [
    # id, posición, objetivo, desplazamiento total seguro durante cinco segundos
    ('R01_ACCESO_CIRCULACION', (7.78, 4.88, 1.55), (8.52, 5.68, 1.18), (.06, .02, .01)),
    ('R02_SUITE_SECUNDARIA', (9.20, 1.52, 1.50), (10.10, 2.58, .88), (.06, .08, .01)),
    ('R03_BANO_CIRCULACION', (7.63, 3.10, 1.52), (8.38, 2.08, .98), (.06, .05, .01)),
    ('R04_SUITE_PRINCIPAL', (4.72, 1.50, 1.50), (5.83, 2.42, .88), (.12, .06, .01)),
    ('R05_SALA', (7.05, 4.28, 1.45), (5.48, 5.22, 1.05), (.28, -.20, .02)),
    ('R06_COMEDOR_COCINA', (4.15, 4.82, 1.48), (2.05, 3.65, 1.12), (-.30, -.16, .02)),
    ('R07_TERRAZA', (3.55, 2.55, 1.44), (2.75, .92, 1.12), (.24, -.16, .02)),
]


def point_camera(cam, target):
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    scene = bpy.context.scene
    config_path = Path(sys.argv[sys.argv.index('--config')+1]) if '--config' in sys.argv else None
    config = load_config(config_path) if config_path else None
    if not bpy.data.filepath.endswith(EXPECTED):
        raise RuntimeError(f'Abre una copia llamada {EXPECTED}')
    col = bpy.data.collections.get('PRODUCCION / RECORRIDO')
    if col is None:
        col = bpy.data.collections.new('PRODUCCION / RECORRIDO')
        scene.collection.children.link(col)
    # En esta copia, solo los siete marcadores nuevos deben decidir la cámara activa.
    # Los objetos/cámaras heredados se conservan intactos para consulta.
    for marker in list(scene.timeline_markers):
        scene.timeline_markers.remove(marker)
    for old in [o for o in col.objects if o.type == 'CAMERA' or o.name.startswith('FOCO_R0')]:
        bpy.data.objects.remove(old, do_unlink=True)
    shots = [(s['id'],s['posicion'],s['objetivo'],s['desplazamiento']) for s in config['tomas']] if config else SHOTS
    for index, (name, start, target, drift) in enumerate(shots):
        first = int(config['tomas'][index]['inicio']) if config else index * 120 + 1
        cam_data = bpy.data.cameras.new(name)
        cam = bpy.data.objects.new(name, cam_data)
        col.objects.link(cam)
        cam.location = start
        cam.data.lens = float(config['tomas'][index]['lente']) if config else (25 if index in (0, 2) else 28)
        cam.data.sensor_width = 36
        focus=bpy.data.objects.new('FOCO_'+name,None); col.objects.link(focus); focus.location=target; focus.hide_render=True
        cam.data.dof.use_dof=True; cam.data.dof.focus_object=focus; cam.data.dof.aperture_fstop=7.1
        point_camera(cam, target)
        cam.keyframe_insert('location', frame=first)
        cam.keyframe_insert('rotation_euler', frame=first)
        cam.location += Vector(drift) * .5
        point_camera(cam, Vector(target) + Vector((.08, 0, .02)))
        cam.keyframe_insert('location', frame=first + 59)
        cam.keyframe_insert('rotation_euler', frame=first + 59)
        cam.location += Vector(drift) * .5
        point_camera(cam, Vector(target) + Vector((.15, 0, .02)))
        cam.keyframe_insert('location', frame=first + 119)
        cam.keyframe_insert('rotation_euler', frame=first + 119)
        for fc in (cam.animation_data.action.fcurves if cam.animation_data and cam.animation_data.action else []):
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'; kp.handle_left_type = 'AUTO_CLAMPED'; kp.handle_right_type = 'AUTO_CLAMPED'
        scene.timeline_markers.new(name, frame=first).camera = cam
    scene.frame_start = int(config['video']['inicio']) if config else 1
    scene.frame_end = int(config['video']['fin']) if config else 840
    scene.render.fps = int(config['video']['fps']) if config else 24
    scene.render.resolution_x, scene.render.resolution_y = config['video']['resolucion_final'] if config else (746, 420)
    if hasattr(scene.render,'use_motion_blur'): scene.render.use_motion_blur=True
    scene['xixova_recorrido'] = '1.1-amueblado-7x5s'
    scene['xixova_exterior'] = 'Conceptual; no representa la vista real del inmueble.'
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    print('RECORRIDO_CONFIGURADO=7 tomas, 840 fotogramas, 35 segundos')


if __name__ == '__main__':
    main()
