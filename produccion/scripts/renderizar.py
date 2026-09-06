"""Render recuperable por fotograma con perfiles previa, animática y final."""
import argparse
import json
import struct
import sys
import time
import traceback
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]


def cli():
    p = argparse.ArgumentParser()
    p.add_argument('--modo', choices=('previa', 'animatica', 'final'), required=True)
    p.add_argument('--frames', default='')
    p.add_argument('--salida', type=Path)
    p.add_argument('--samples', type=int)
    return p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def frame_list(spec):
    if not spec:
        return list(range(1, 481))
    result = set()
    for part in spec.split(','):
        if '-' in part:
            a, b = map(int, part.split('-', 1)); result.update(range(a, b + 1))
        else:
            result.add(int(part))
    return sorted(x for x in result if 1 <= x <= 480)


def valid_png(path, width, height):
    try:
        with path.open('rb') as f:
            head = f.read(24)
            if len(head) != 24 or head[:8] != b'\x89PNG\r\n\x1a\n': return False
            return struct.unpack('>II', head[16:24]) == (width, height)
    except OSError:
        return False


def log(path, payload):
    with path.open('a', encoding='utf-8') as f:
        f.write(json.dumps(payload, ensure_ascii=False) + '\n')


def main():
    a = cli(); scene = bpy.context.scene
    defaults = {
        'previa': (480, 270, 16, 'CYCLES', ROOT/'salidas/previas'),
        'animatica': (640, 360, 1, 'BLENDER_WORKBENCH', ROOT/'salidas/animatica/frames'),
        # Perfil ligero aprobado para GTX 1060 6 GB. 746x420 conserva 16:9
        # prácticamente exacto y ambas dimensiones son pares para H.264.
        'final': (746, 420, 32, 'CYCLES', ROOT/'salidas/final_frames'),
    }
    width, height, samples, engine, default_out = defaults[a.modo]
    out = (a.salida or default_out).resolve(); out.mkdir(parents=True, exist_ok=True)
    logfile = ROOT/'salidas/logs'/f'{a.modo}.jsonl'; logfile.parent.mkdir(parents=True, exist_ok=True)
    scene.render.engine = engine
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_depth = '8'
    scene.render.use_file_extension = True
    if engine == 'CYCLES':
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'CUDA'; prefs.refresh_devices()
        devices = []
        for d in prefs.devices:
            d.use = d.type == 'CUDA'
            if d.use: devices.append(d.name)
        if not devices: raise RuntimeError('CUDA no disponible')
        scene.cycles.device = 'GPU'; scene.cycles.samples = a.samples or samples
        scene.cycles.use_adaptive_sampling = True; scene.cycles.use_denoising = True
        scene.cycles.adaptive_threshold = .02 if a.modo == 'final' else .03
        scene.render.use_persistent_data = a.modo == 'final'
    else:
        scene.display.shading.light = 'STUDIO'
        scene.display.shading.studio_light = 'paint.sl'
        scene.display.shading.show_shadows = True
        scene.display.shading.show_cavity = True
        scene.display.shading.cavity_type = 'WORLD'
        scene.display.shading.color_type = 'MATERIAL'
        devices = ['Workbench']
    requested = frame_list(a.frames)
    done = skipped = failed = 0; started = time.time()
    for frame in requested:
        target = out/f'frame_{frame:04d}.png'
        if valid_png(target, width, height):
            skipped += 1; log(logfile, {'ts': time.time(), 'frame': frame, 'estado': 'omitido_existente'})
            continue
        scene.frame_set(frame); scene.render.filepath = str(target)
        t0 = time.perf_counter()
        try:
            bpy.ops.render.render(write_still=True)
            if not valid_png(target, width, height): raise RuntimeError('PNG incompleto')
            done += 1; log(logfile, {'ts': time.time(), 'frame': frame, 'estado': 'ok',
                                    'segundos': round(time.perf_counter()-t0, 3)})
        except BaseException as exc:
            failed += 1; log(logfile, {'ts': time.time(), 'frame': frame, 'estado': 'error',
                                      'error': str(exc), 'traceback': traceback.format_exc()})
    status = {'modo': a.modo, 'resolucion': [width, height], 'motor': engine,
              'samples': a.samples or samples, 'dispositivos': devices, 'solicitados': len(requested),
              'renderizados': done, 'omitidos': skipped, 'errores': failed,
              'segundos_total': round(time.time()-started, 3), 'salida': str(out)}
    (ROOT/'salidas'/f'estado_{a.modo}.json').write_text(json.dumps(status, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(status, ensure_ascii=False), flush=True)
    if failed: raise RuntimeError(f'{failed} fotogramas fallaron; consulta {logfile}')


if __name__ == '__main__':
    main()
