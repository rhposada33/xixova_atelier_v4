"""Interfaz de archivos/comandos para agentes y personas."""
import argparse
import contextlib
import fcntl
import hashlib
import html
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path
from .core import ROOT, camera_frames, diagnostic, digest, load, resolve

def atomic(path,data):
    path.parent.mkdir(parents=True,exist_ok=True); tmp=path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n'); os.replace(tmp,path)

def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def output(b):
    p=b['proyecto']; prod=p['produccion']; base=Path(b['archivo']).parent
    engine=digest({f.name:sha(f) for f in sorted(ROOT.glob('*.py'))})
    identity=digest({'proyecto':p,'arquitectura':b['arquitectura'],'interiorismo':b['interiorismo'],'presentacion':b['presentacion'],'catalogo':b['catalogo'],'motor':engine})[:20]
    return (base/Path(os.path.expandvars(os.path.expanduser(prod['salidas'])))).resolve()/p['id']/b['arquitectura']['version']/b['interiorismo']['id']/identity

def review_path(b):
    return Path(b['archivo']).parent/'.revisiones'/f"{b['arquitectura_hash']}.json"

def run_blender(b,script,args,scene=None):
    exe=os.path.expandvars(os.path.expanduser(b['proyecto']['produccion']['blender']))
    cmd=[exe,'--background','--factory-startup','--disable-autoexec']
    cmd += [str(scene)] if scene else []
    cmd += ['--python-exit-code','1','--python',str(ROOT/script),'--',*map(str,args)]
    subprocess.run(cmd,check=True,stdout=sys.stderr)

@contextlib.contextmanager
def lock(root):
    root.mkdir(parents=True,exist_ok=True)
    with (root/'operacion.lock').open('w') as stream:
        try: fcntl.flock(stream,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise ValueError('Otra ejecución utiliza esta variante.')
        try: yield
        finally: fcntl.flock(stream,fcntl.LOCK_UN)

def floorplan(b,path):
    a=b['arquitectura']; points=[p for r in a['espacios'] for p in r['contorno']]; xs,ys=zip(*points)
    lo,bot,hi,top=min(xs),min(ys),max(xs),max(ys); scale=75; width=(hi-lo)*scale+120; height=(top-bot)*scale+150
    def xy(p):return ((p[0]-lo)*scale+60,(top-p[1])*scale+60)
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="white"/>']
    for r in a['espacios']:
        coords=' '.join(f'{x},{y}' for x,y in map(xy,r['contorno'])); parts.append(f'<polygon points="{coords}" fill="#f3efe7" stroke="#999"/>')
        x,y=xy([sum(p[0] for p in r['contorno'])/len(r['contorno']),sum(p[1] for p in r['contorno'])/len(r['contorno'])]); parts.append(f'<text x="{x}" y="{y}" text-anchor="middle" font-size="11">{html.escape(r["id"])}</text>')
    for w in a['paredes']:
        import math
        x,y=xy(w['a']); xx,yy=xy(w['b']); length=math.dist(w['a'],w['b'])
        parts.append(f'<line x1="{x}" y1="{y}" x2="{xx}" y2="{yy}" stroke="#333" stroke-width="{w["espesor"]*scale}"/>')
        parts.append(f'<text x="{(x+xx)/2+5}" y="{(y+yy)/2-8}" font-size="10">{length:.2f} m</text>')
        for o in w['aberturas']:
            t=o['distancia']/length; u=(o['distancia']+o['ancho'])/length
            parts.append(f'<line x1="{x+(xx-x)*t}" y1="{y+(yy-y)*t}" x2="{x+(xx-x)*u}" y2="{y+(yy-y)*u}" stroke="{chr(35)+"59a9c2" if o["tipo"]=="ventana" else "white"}" stroke-width="{w["espesor"]*scale+1}"/>')
    note=' | '.join(a['dudas']) or 'Sin dudas declaradas'
    parts.append(f'<text x="20" y="{height-35}" font-size="11">{html.escape(a["id"]+" / "+a["version"]+" — "+note)}</text></svg>')
    path.write_text(''.join(parts))

def png_ok(path,w,h):
    try:
        data=path.read_bytes()
        return len(data)>100 and data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(w,h) and data[-12:]==b'\x00\x00\x00\x00IEND\xaeB`\x82'
    except OSError:return False

def main(argv=None):
    parser=argparse.ArgumentParser(description='Xixova: arquitectura + interiorismo + presentación + producción')
    parser.add_argument('accion',choices=['validar','resolver','catalogo','arquitectura','confirmar-arquitectura','componer','comprobar','previas','animatica','confirmar-visual','recorrido','estado','capturar','sincronizar'])
    parser.add_argument('-p','--proyecto',type=Path,required=True); parser.add_argument('--variante'); parser.add_argument('--revisor'); parser.add_argument('--nota'); parser.add_argument('--categoria'); parser.add_argument('--ancho-max',type=float)
    parser.add_argument('--captura',type=Path); parser.add_argument('--escena',type=Path); parser.add_argument('--aplicar',action='store_true')
    args=parser.parse_args(argv)
    try:
        if args.accion=='sincronizar':
            if not args.captura: raise ValueError('Falta --captura JSON exportado desde Blender.')
            from .sync import synchronize
            report=synchronize(args.proyecto,args.variante,json.loads(args.captura.read_text()),args.aplicar)
            print(json.dumps(report,indent=2,ensure_ascii=False)); return 0 if report['ok'] else 1
        b,errors=load(args.proyecto,args.variante)
        if b is None: print(json.dumps({'ok':False,'diagnosticos':errors},ensure_ascii=False)); return 1
        root=output(b); resolved,issues=resolve(b)
        b['resueltos']=resolved; b['fotogramas']=[dict(toma=s,numero=f,posicion=p,objetivo=t) for s,f,p,t in camera_frames(b['presentacion'])]
        if args.accion=='capturar':
            if not args.captura or not args.escena: raise ValueError('Indica --escena BLEND guardado y --captura JSON de salida. Para cambios sin guardar usa capturar() mediante MCP.')
            run_blender(b,'blender_sync.py',['--salida',args.captura.resolve()],args.escena.resolve())
            print(args.captura.resolve()); return 0
        if args.accion=='catalogo':
            assets=[v for v in b['catalogo']['activos'] if (not args.categoria or v['categoria']==args.categoria) and (args.ancho_max is None or v['dimensiones'][0]<=args.ancho_max)]
            print(json.dumps({'activos':[{**v,'disponible':Path(v['archivo']).is_file()} for v in assets]},ensure_ascii=False)); return 0
        if args.accion in {'validar','comprobar'}:
            print(json.dumps({'ok':not errors,'arquitectura_hash':b['arquitectura_hash'],'diagnosticos':errors},ensure_ascii=False,indent=2)); return bool(errors)
        # Architecture review can proceed while the proposal is stale or obstructed.
        architecture_actions={'arquitectura','confirmar-arquitectura'}
        if args.accion in architecture_actions:
            from .core import validate
            neutral=json.loads(json.dumps(b)); neutral['interiorismo']['elementos']=[]; neutral['interiorismo']['acabados']={}; neutral['interiorismo']['arquitectura']={'id':b['arquitectura']['id'],'version':b['arquitectura']['version'],'hash':b['arquitectura_hash']}
            errors=validate(neutral)
        if errors: print(json.dumps({'ok':False,'diagnosticos':errors},ensure_ascii=False,indent=2)); return 1
        if args.accion=='resolver': print(json.dumps(b,ensure_ascii=False,indent=2)); return 0
        if args.accion=='confirmar-arquitectura':
            if not args.revisor or not args.nota: raise ValueError('Especifica --revisor y --nota con la revisión de medidas y dudas.')
            if not b['arquitectura']['cota_referencia']['fiable']: raise ValueError('Falta una cota fiable. Para demos, puede ser una dimensión sintética explícita.')
            if not (root/'arquitectura.blend').exists(): raise ValueError('Genera e inspecciona primero arquitectura.')
            atomic(review_path(b),{'hash':b['arquitectura_hash'],'revisor':args.revisor,'nota':args.nota}); print(review_path(b)); return 0
        if args.accion=='estado':
            print(json.dumps({'salida':str(root),'arquitectura_revisada':review_path(b).exists(),'escena':(root/'escena.blend').exists(),'renders':{p:len(list((root/p).glob('frame_*.png'))) for p in b['proyecto']['produccion']['perfiles']}},indent=2)); return 0
        if args.accion not in architecture_actions and not review_path(b).exists(): raise ValueError('Arquitectura pendiente de revisión: ejecuta arquitectura y confirmar-arquitectura.')
        with lock(root):
            datafile=root/'resuelto.json'; atomic(datafile,b)
            if args.accion=='arquitectura':
                floorplan(b,root/'planta.svg'); run_blender(b,'blender_build.py',['--datos',datafile,'--salida',root/'arquitectura.blend','--arquitectura'])
                samples=[]; offset=0
                for s in b['presentacion']['tomas']: samples.append(offset+1); offset+=s['fotogramas']
                run_blender(b,'render.py',['--datos',datafile,'--salida',root/'arquitectura_previas','--perfil','previa','--frames',','.join(map(str,samples))],root/'arquitectura.blend')
            elif args.accion=='componer':
                for item in resolved:
                    asset=next(x for x in b['catalogo']['activos'] if x['id']==item['activo'])
                    if sha(asset['archivo'])!=asset['sha256']: raise ValueError('Recurso cambió; actualiza catálogo: '+asset['id'])
                run_blender(b,'blender_build.py',['--datos',datafile,'--salida',root/'escena.blend'])
                atomic(root/'escena.manifest.json',{'sha256':sha(root/'escena.blend')})
            else:
                scene=root/'escena.blend'
                if not scene.exists(): raise ValueError('Ejecuta componer antes de renderizar.')
                if sha(scene)!=json.loads((root/'escena.manifest.json').read_text())['sha256']: raise ValueError('El .blend fue modificado fuera del contrato. Reconstruye la escena.')
                if args.accion=='confirmar-visual':
                    if not args.revisor or not args.nota: raise ValueError('Especifica --revisor y --nota tras inspeccionar previas y animática.')
                    if not (root/'animatica'/'recorrido.mp4').exists(): raise ValueError('Genera e inspecciona primero la animática.')
                    atomic(root/'revision_visual.json',{'escena':sha(scene),'revisor':args.revisor,'nota':args.nota}); print(root); return 0
                profile={'previas':'previa','animatica':'animatica','recorrido':'final'}[args.accion]
                if profile=='final':
                    review=root/'revision_visual.json'
                    if not review.exists() or json.loads(review.read_text())['escena']!=sha(scene): raise ValueError('Falta confirmar-visual para esta escena.')
                frames=[]; offset=0
                for s in b['presentacion']['tomas']:
                    if profile=='previa':frames.extend([offset+1,offset+(s['fotogramas']+1)//2,offset+s['fotogramas']])
                    offset+=s['fotogramas']
                extra=['--frames',','.join(map(str,sorted(set(frames))))] if frames else []
                run_blender(b,'render.py',['--datos',datafile,'--salida',root/profile,'--perfil',profile,*extra],scene)
                if profile!='previa':
                    w,h=b['proyecto']['produccion']['perfiles'][profile]['resolucion']
                    if not all(png_ok(root/profile/f'frame_{f:04d}.png',w,h) for f in range(1,offset+1)): raise ValueError('Secuencia incompleta.')
                    target=root/profile/'recorrido.mp4'; temp=target.with_name('recorrido.tmp.mp4'); fps=b['proyecto']['produccion']['fps']
                    subprocess.run(['ffmpeg','-v','error','-y','-framerate',str(fps),'-i',str(root/profile/'frame_%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(temp)],check=True)
                    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',str(temp)]))
                    stream=probe['streams'][0]
                    if (stream['width'],stream['height'],int(stream['nb_read_frames']))!=(w,h,offset):raise ValueError('MP4 no coincide con la secuencia.')
                    os.replace(temp,target); atomic(root/profile/'ffprobe.json',probe)
            print(root)
        return 0
    except (OSError,ValueError,KeyError,TypeError,subprocess.CalledProcessError) as exc:
        print(json.dumps({'ok':False,'diagnosticos':[diagnostic('EJECUCION',str(args.proyecto),str(exc))]},ensure_ascii=False)); return 1
