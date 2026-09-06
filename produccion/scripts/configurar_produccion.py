"""Configura cámaras, marcadores y ajustes de producción sobre el .blend ya construido."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]


def cli():
    p = argparse.ArgumentParser()
    p.add_argument('--salida', type=Path, default=ROOT / 'salidas' / 'configuracion.json')
    return p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


SHOTS = [
    dict(id='T01_COMEDOR_GENERAL', inicio=1, fin=120, lente=25,
         posiciones=[(4.05, 5.24, 1.42), (3.91, 5.15, 1.44), (3.77, 5.05, 1.46)],
         objetivos=[(2.79, 2.51, 1.30), (2.82, 2.58, 1.29), (2.85, 2.65, 1.28)],
         descripcion='Comedor completo y apertura exterior'),
    dict(id='T02_MESA_DETALLE', inicio=121, fin=240, lente=35,
         posiciones=[(3.78, 4.58, 1.18), (3.68, 4.46, 1.20), (3.56, 4.34, 1.22)],
         objetivos=[(2.86, 3.05, .88), (2.86, 3.08, .90), (2.86, 3.11, .92)],
         descripcion='Detalle de mesa, vajilla y carpintería'),
    dict(id='T03_TERRAZA', inicio=241, fin=360, lente=28,
         posiciones=[(3.92, 3.84, 1.40), (3.80, 3.68, 1.42), (3.68, 3.52, 1.44)],
         objetivos=[(2.72, 1.24, 1.24), (2.76, 1.22, 1.24), (2.80, 1.20, 1.24)],
         descripcion='Apertura a terraza y exterior orientado'),
    dict(id='T04_BIBLIOTECA', inicio=361, fin=480, lente=32,
         posiciones=[(6.86, 4.18, 1.34), (6.68, 4.13, 1.36), (6.50, 4.08, 1.38)],
         objetivos=[(5.18, 5.72, 1.42), (5.14, 5.72, 1.43), (5.10, 5.72, 1.44)],
         descripcion='Biblioteca, arte y luz indirecta; evita depender del sofá'),
]


def aim(camera, target):
    camera.rotation_mode = 'QUATERNION'
    camera.rotation_quaternion = (Vector(target) - camera.location).to_track_quat('-Z', 'Y')


def bbox_contains(obj, point, margin=.04):
    inv = obj.matrix_world.inverted_safe()
    p = inv @ Vector(point)
    lo = Vector((min(c[i] for c in obj.bound_box) for i in range(3)))
    hi = Vector((max(c[i] for c in obj.bound_box) for i in range(3)))
    return all(lo[i] - margin <= p[i] <= hi[i] + margin for i in range(3))


def main():
    a = cli()
    if bpy.app.version[:2] != (4, 5):
        raise RuntimeError('Se requiere Blender 4.5 LTS')
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end, scene.render.fps = 1, 480, 24
    scene.render.resolution_x, scene.render.resolution_y = 746, 420
    scene.render.resolution_percentage = 100
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 32
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .01
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.cycles.transmission_bounces = 6
    scene.cycles.volume_bounces = 0
    scene.cycles.sample_clamp_indirect = 8
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.film_transparent = False
    scene.render.use_file_extension = True
    scene.render.use_overwrite = False
    scene.render.use_placeholder = False

    old = bpy.data.collections.get('PRODUCCION / CAMARAS')
    if old:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old)
    col = bpy.data.collections.new('PRODUCCION / CAMARAS')
    scene.collection.children.link(col)
    for marker in list(scene.timeline_markers):
        if marker.name.startswith('T0'):
            scene.timeline_markers.remove(marker)

    report = {'version_pipeline': '1.0.0', 'blender': bpy.app.version_string,
              'fps': 24, 'fotogramas': 480, 'duracion_s': 20,
              'resolucion_final': [746, 420], 'tomas': [], 'advertencias': []}
    walls = [o for o in scene.objects if o.type == 'MESH' and any(k in o.name.lower() for k in
             ('fondo', 'lateral', 'division', 'dintel', 'frontal', 'extremo', 'techo'))]
    furniture = [o for o in scene.objects if o.type == 'MESH' and any(k in o.name.lower() for k in
                 ('sofa', 'mesa', 'silla', 'consola', 'libreria', 'banco'))]
    for shot in SHOTS:
        data = bpy.data.cameras.new(shot['id'])
        data.lens, data.sensor_width = shot['lente'], 36
        data.clip_start, data.clip_end = .05, 500
        data.dof.use_dof = False
        cam = bpy.data.objects.new(shot['id'], data)
        col.objects.link(cam)
        frames = [shot['inicio'], (shot['inicio'] + shot['fin']) // 2, shot['fin']]
        collisions = []
        for frame, pos, target in zip(frames, shot['posiciones'], shot['objetivos']):
            cam.location = pos
            aim(cam, target)
            cam.keyframe_insert('location', frame=frame)
            cam.keyframe_insert('rotation_quaternion', frame=frame)
            hit = [o.name for o in walls + furniture if bbox_contains(o, pos)]
            if hit:
                collisions.append({'fotograma': frame, 'objetos': sorted(set(hit))})
        if cam.animation_data and cam.animation_data.action:
            for curve in cam.animation_data.action.fcurves:
                for point in curve.keyframe_points:
                    point.interpolation = 'BEZIER'
                    point.handle_left_type = point.handle_right_type = 'AUTO_CLAMPED'
        marker = scene.timeline_markers.new(shot['id'], frame=shot['inicio'])
        marker.camera = cam
        report['tomas'].append({k: v for k, v in shot.items() if k not in ('posiciones', 'objetivos')} |
                               {'camara': cam.name, 'fotogramas_revision': frames,
                                'colisiones_bbox': collisions})
        if collisions:
            report['advertencias'].append(shot['id'] + ': posible cámara dentro de geometría')
    scene.camera = bpy.data.objects[SHOTS[0]['id']]

    sofa_names = [o.name for o in scene.objects if 'sofa' in o.name.lower()]
    report['sofa'] = {
        'estado': 'NO_VALIDADO',
        'objetos_conservados': sofa_names,
        'medida_previa_m': [1.6584, .9500, .4777],
        'accion': 'No deformado ni sustituido. Se requiere sofá recto 2.0–2.2 m x 0.80–0.95 m x 0.75–0.95 m.',
    }
    report['exterior'] = 'Se conserva HDRI con coordenadas Generated y giro aprobado de 250 grados.'
    scene['xixova_pipeline'] = '1.0.0'
    scene['xixova_sofa_estado'] = 'NO_VALIDADO_CHAISE_PEQUENO'
    scene['xixova_notas'] = 'Ajustar sobre este .blend; no ejecutar construcción inicial para cambios de cámaras/render.'
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 1
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    a.salida.parent.mkdir(parents=True, exist_ok=True)
    a.salida.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('CONFIGURACION=' + str(a.salida), flush=True)


if __name__ == '__main__':
    main()
