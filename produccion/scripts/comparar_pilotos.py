"""Genera comparaciones antes/después reproducibles mediante FFmpeg."""
import argparse,json,subprocess
from pathlib import Path
def main():
    p=argparse.ArgumentParser(); p.add_argument('--config',type=Path,required=True); a=p.parse_args(); c=json.loads(a.config.read_text())
    legacy=Path(c['_archivo']).parent/'salidas'/'recorrido'/'final_frames'; current=Path(c['rutas']['salidas'])/c['_hash']/'piloto'/'frames'; out=Path(c['rutas']['salidas'])/'comparaciones_pilotos'; out.mkdir(parents=True,exist_ok=True)
    report={'schema':1,'antes':str(legacy),'despues':str(current),'comparaciones':[]}
    for frame in [x for values in c['calidad']['pilotos'].values() for x in values]:
        old=legacy/f'frame_{frame:04d}.png'; new=current/f'frame_{frame:04d}.png'; target=out/f'comparacion_{frame:04d}.png'
        status='ausente'
        if old.exists() and new.exists():
            subprocess.run([c['herramientas']['ffmpeg'],'-y','-i',str(old),'-i',str(new),'-filter_complex','[0:v]scale=746:420[a];[1:v]scale=746:420[b];[a][b]hstack=inputs=2','-frames:v','1',str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); status='ok'
        report['comparaciones'].append({'frame':frame,'estado':status,'archivo':str(target)})
    (out/'informe.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8'); print(out)
if __name__=='__main__': main()
