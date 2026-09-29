"""Interrumpe solo su propio proceso y comprueba reanudación de una demo generada."""
import argparse
import json
import os
import signal
import subprocess
import time
from pathlib import Path

p=argparse.ArgumentParser(); p.add_argument('--proyecto',required=True);p.add_argument('--variante',default='calida');p.add_argument('--salida',required=True);a=p.parse_args()
root=Path(a.salida).resolve(); frames=sorted((root/'animatica').glob('frame_*.png')); assert len(frames)>1
last=frames[-1]; backup=last.with_suffix('.png.reanudacion_backup'); assert not backup.exists()
stamps={str(f):f.stat().st_mtime_ns for f in frames[:-1]}; last.rename(backup)
cmd=['uv','run','xixova_cli.py','animatica','-p',a.proyecto,'--variante',a.variante]
logpath=root/'interrupcion_prueba.log'; killed=False; proc=None
try:
 with logpath.open('w') as log:
  proc=subprocess.Popen(cmd,stdout=log,stderr=log,start_new_session=True)
  deadline=time.monotonic()+45
  while proc.poll() is None and time.monotonic()<deadline:
   if 'Sample 0/' in logpath.read_text(errors='replace') or 'Updating Shaders' in logpath.read_text(errors='replace'):
    os.killpg(proc.pid,signal.SIGTERM); killed=True; break
   time.sleep(.02)
  if proc.poll() is None and not killed: os.killpg(proc.pid,signal.SIGTERM); killed=True
  proc.wait(timeout=10)
 missing_after_interrupt=not last.exists()
 with (root/'reanudacion_prueba.log').open('w') as log: subprocess.run(cmd,check=True,stdout=log,stderr=log)
 assert all(Path(f).stat().st_mtime_ns==stamp for f,stamp in stamps.items())
 assert last.exists() and (root/'animatica'/'recorrido.mp4').exists()
 report={'proceso_interrumpido':killed,'ultimo_pendiente_tras_interrupcion':missing_after_interrupt,'fotogramas_conservados':len(stamps),'fotogramas_finales':len(list((root/'animatica').glob('frame_*.png'))),'ok':killed and missing_after_interrupt}
 (root/'prueba_reanudacion.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report)); assert report['ok']
finally:
 if proc is not None and proc.poll() is None: os.killpg(proc.pid,signal.SIGTERM);proc.wait()
 if not last.exists():backup.rename(last)
 elif backup.exists():backup.unlink()
