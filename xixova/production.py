"""Utilidades de producción reutilizables y ajenas a una escena concreta."""
import json
import subprocess
from pathlib import Path


def render_progress(root, profiles, expected_frames, png_validator):
    result = {}
    for name, profile in profiles.items():
        folder = Path(root)/name; width, height = profile['resolucion']
        expected = expected_frames[name]; total_frames = len(expected)
        done = sum(png_validator(folder/f'frame_{frame:04d}.png', width, height) for frame in expected)
        times = []
        log = folder/'render.jsonl'
        if log.exists():
            for line in log.read_text(encoding='utf-8').splitlines()[-50:]:
                try:
                    row = json.loads(line)
                    if row.get('estado') == 'ok': times.append(float(row['segundos']))
                except (ValueError, KeyError, TypeError):
                    pass
        eta = round(sum(times)/len(times)*(total_frames-done), 1) if times else None
        result[name] = {'completos': done, 'total': total_frames, 'progreso': round(done/total_frames, 4), 'eta_segundos': eta}
    return result


def ffmpeg_args(frames, target, fps, profile):
    post=profile.get('postproduccion',{}); filters=[]
    if post.get('contraste',1)!=1 or post.get('saturacion',1)!=1:
        filters.append(f"eq=contrast={post.get('contraste',1)}:saturation={post.get('saturacion',1)}")
    if post.get('vineta',0)>0: filters.append(f"vignette=angle={post['vineta']}")
    if post.get('grano',0)>0: filters.append(f"noise=alls={post['grano']}:allf=u")
    command=['ffmpeg', '-v', 'error', '-y', '-framerate', str(fps), '-i', str(Path(frames)/'frame_%04d.png')]
    if filters: command += ['-vf',','.join(filters)]
    return command+[
            '-c:v', 'libx264', '-preset', profile.get('preset', 'slow' if profile.get('motor', 'CYCLES') == 'CYCLES' else 'medium'),
            '-crf', str(profile.get('crf', 18 if profile.get('motor', 'CYCLES') == 'CYCLES' else 20)),
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target)]


def compare_frames(previous, current, output, frames, width, height):
    previous, current, output = map(Path, (previous, current, output)); output.mkdir(parents=True, exist_ok=True)
    rows = []
    for frame in frames:
        old = previous/f'frame_{frame:04d}.png'; new = current/f'frame_{frame:04d}.png'; target = output/f'comparacion_{frame:04d}.png'
        status = 'ausente'
        if old.is_file() and new.is_file():
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(old),'-i',str(new),'-filter_complex',
                            f'[0:v]scale={width}:{height}[a];[1:v]scale={width}:{height}[b];[a][b]hstack=inputs=2',
                            '-frames:v','1',str(target)], check=True)
            status = 'ok'
        rows.append({'fotograma': frame, 'estado': status, 'archivo': str(target)})
    report = {'schema': 1, 'anterior': str(previous), 'actual': str(current), 'comparaciones': rows}
    (output/'informe.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    return report
