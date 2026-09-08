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

def run_blender(b,script,args,scene=None,log=None):
    exe=os.path.expandvars(os.path.expanduser(b['proyecto']['produccion']['blender']))
    cmd=[exe,'--background','--factory-startup','--disable-autoexec']
    cmd += [str(scene)] if scene else []
    cmd += ['--python-exit-code','1','--python',str(ROOT/script),'--',*map(str,args)]
    if log:
        log=Path(log); log.parent.mkdir(parents=True,exist_ok=True)
        print(json.dumps({'evento':'blender_inicio','script':script,'log':str(log)},ensure_ascii=False),file=sys.stderr,flush=True)
        with log.open('w') as stream: subprocess.run(cmd,check=True,stdout=stream,stderr=subprocess.STDOUT)
        print(json.dumps({'evento':'blender_fin','script':script,'log':str(log)},ensure_ascii=False),file=sys.stderr,flush=True)
    else:
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
    parser.add_argument('accion',choices=['validar','resolver','catalogo','arquitectura','confirmar-arquitectura','componer','comprobar','previas','animatica','confirmar-visual','recorrido','estado','capturar','sincronizar','contexto-agente','operar','preflight','auditar-calidad','comparar','planificar-camaras','preparar-realismo','pilotos-fotograficos','piloto-temporal','auditar-fotografia'])
    parser.add_argument('-p','--proyecto',type=Path,required=True); parser.add_argument('--variante'); parser.add_argument('--revisor'); parser.add_argument('--nota'); parser.add_argument('--categoria'); parser.add_argument('--ancho-max',type=float)
    parser.add_argument('--captura',type=Path); parser.add_argument('--escena',type=Path); parser.add_argument('--aplicar',action='store_true')
    parser.add_argument('--compacto',action='store_true'); parser.add_argument('--desde',type=Path); parser.add_argument('--operaciones',type=Path); parser.add_argument('--toma',action='append')
    parser.add_argument('--anterior',type=Path); parser.add_argument('--perfil',choices=['previa','animatica','final','piloto_fotografico','fotografico_1080p']); parser.add_argument('--guion',type=Path)
    args=parser.parse_args(argv)
    try:
        if args.accion=='sincronizar':
            if not args.captura: raise ValueError('Falta --captura JSON exportado desde Blender.')
            from .sync import synchronize
            report=synchronize(args.proyecto,args.variante,json.loads(args.captura.read_text()),args.aplicar)
            print(json.dumps(report,indent=2,ensure_ascii=False)); return 0 if report['ok'] else 1
        b,errors=load(args.proyecto,args.variante)
        if b is None: print(json.dumps({'ok':False,'diagnosticos':errors},ensure_ascii=False)); return 1
        root=output(b)
        if args.accion=='planificar-camaras':
            from .camera_planner import plan_cameras
            import yaml
            source=args.guion or (args.proyecto.parent/b['proyecto'].get('guion_camara',''))
            if not source or not Path(source).is_file(): raise ValueError('Indica --guion o guion_camara en proyecto.yaml.')
            script=yaml.safe_load(Path(source).read_text(encoding='utf-8'))
            shots,planning,planning_issues=plan_cameras(b,script)
            report={'ok':not planning_issues,'aplicado':False,'tomas':planning,'diagnosticos':planning_issues}
            if args.aplicar and not planning_issues:
                target=args.proyecto.parent/b['proyecto']['presentacion']
                presentation=yaml.safe_load(target.read_text(encoding='utf-8')); presentation['tomas']=shots
                temp=target.with_suffix(target.suffix+'.tmp'); temp.write_text(yaml.safe_dump(presentation,sort_keys=False,allow_unicode=True),encoding='utf-8'); os.replace(temp,target)
                report['aplicado']=True; report['archivo']=str(target)
            print(json.dumps(report,ensure_ascii=False,separators=(',',':'))); return 0 if not planning_issues else 1
        if args.accion=='contexto-agente':
            from .agent import agent_context, context_delta
            current=agent_context(b,errors,root); previous=json.loads(args.desde.read_text()) if args.desde else None
            root.mkdir(parents=True,exist_ok=True); atomic(root/'contexto-agente.json',current)
            print(json.dumps(context_delta(current,previous),ensure_ascii=False,separators=(',',':'))); return 0
        if args.accion=='operar':
            if not args.operaciones: raise ValueError('Indica --operaciones con un archivo YAML o JSON.')
            from .agent import apply_operations, publish_operations, read_operations
            updated,changes,layers,operation_issues,new_variant=apply_operations(b,read_operations(args.operaciones))
            report={'ok':not operation_issues,'aplicado':False,'capas':layers,'cambios':changes,'diagnosticos':operation_issues}
            if args.aplicar and not operation_issues:
                with lock(root): report['archivos']=publish_operations(b,updated,layers,new_variant); report['aplicado']=True
            print(json.dumps(report,ensure_ascii=False,separators=(',',':'))); return 0 if not operation_issues else 1
        resolved,issues=resolve(b)
        b['resueltos']=resolved; b['fotogramas']=[dict(toma=s,numero=f,posicion=p,objetivo=t) for s,f,p,t in camera_frames(b['presentacion'])]
        if args.accion=='capturar':
            if not args.captura or not args.escena: raise ValueError('Indica --escena BLEND guardado y --captura JSON de salida. Para cambios sin guardar usa capturar() mediante MCP.')
            run_blender(b,'blender_sync.py',['--salida',args.captura.resolve()],args.escena.resolve())
            print(args.captura.resolve()); return 0
        if args.accion=='catalogo':
            assets=[v for v in b['catalogo']['activos'] if (not args.categoria or v['categoria']==args.categoria) and (args.ancho_max is None or v['dimensiones'][0]<=args.ancho_max)]
            print(json.dumps({'activos':[{**v,'disponible':Path(v['archivo']).is_file()} for v in assets]},ensure_ascii=False)); return 0
        if args.accion in {'validar','comprobar'}:
            report={'ok':not errors,'arquitectura_hash':b['arquitectura_hash'],'diagnosticos':errors}
            if args.compacto:
                print(('OK '+b['arquitectura_hash']) if not errors else '\n'.join(f'{e["gravedad"]}|{e["codigo"]}|{e["elemento"]}|{e["explicacion"]}' for e in errors))
            else: print(json.dumps(report,ensure_ascii=False,indent=2))
            return bool(errors)
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
            from .production import render_progress
            total=len(b['fotogramas']); samples=[]; offset=0
            for shot in b['presentacion']['tomas']:
                samples.extend((offset+1,offset+(shot['fotogramas']+1)//2,offset+shot['fotogramas'])); offset+=shot['fotogramas']
            expected={name:(sorted(set(samples)) if name in {'previa','piloto_fotografico'} else list(range(1,total+1))) for name in b['proyecto']['produccion']['perfiles']}
            progress=render_progress(root,b['proyecto']['produccion']['perfiles'],expected,png_ok)
            print(json.dumps({'salida':str(root),'arquitectura_revisada':review_path(b).exists(),'escena':(root/'escena.blend').exists(),'renders':progress},indent=2)); return 0
        if args.accion not in architecture_actions and not review_path(b).exists(): raise ValueError('Arquitectura pendiente de revisión: ejecuta arquitectura y confirmar-arquitectura.')
        with lock(root):
            datafile=root/'resuelto.json'; atomic(datafile,b)
            if args.accion=='arquitectura':
                floorplan(b,root/'planta.svg'); run_blender(b,'blender_build.py',['--datos',datafile,'--salida',root/'arquitectura.blend','--arquitectura'],log=root/'logs'/'arquitectura_build.log')
                samples=[]; offset=0
                for s in b['presentacion']['tomas']: samples.append(offset+1); offset+=s['fotogramas']
                run_blender(b,'render.py',['--datos',datafile,'--salida',root/'arquitectura_previas','--perfil','previa','--frames',','.join(map(str,samples))],root/'arquitectura.blend',root/'logs'/'arquitectura_previas.log')
            elif args.accion=='componer':
                for item in resolved:
                    asset=next(x for x in b['catalogo']['activos'] if x['id']==item['activo'])
                    if sha(asset['archivo'])!=asset['sha256']: raise ValueError('Recurso cambió; actualiza catálogo: '+asset['id'])
                run_blender(b,'blender_build.py',['--datos',datafile,'--salida',root/'escena.blend'],log=root/'logs'/'componer.log')
                atomic(root/'escena.manifest.json',{'sha256':sha(root/'escena.blend')})
            else:
                scene=root/'escena.blend'
                if not scene.exists(): raise ValueError('Ejecuta componer antes de renderizar.')
                if sha(scene)!=json.loads((root/'escena.manifest.json').read_text())['sha256']: raise ValueError('El .blend fue modificado fuera del contrato. Reconstruye la escena.')
                if args.accion=='preflight':
                    target=root/'preflight.json'; run_blender(b,'preflight.py',['--datos',datafile,'--salida',target],scene,root/'logs'/'preflight.log'); print(target); return 0
                if args.accion=='preparar-realismo':
                    target=root/'realismo_preflight.json'; run_blender(b,'realism_preflight.py',['--datos',datafile,'--salida',target],scene,root/'logs'/'realismo_preflight.log'); print(target); return 0
                if args.accion=='auditar-calidad':
                    target=root/'auditoria_calidad.json'; run_blender(b,'quality_audit.py',['--datos',datafile,'--salida',target],scene,root/'logs'/'auditoria_calidad.log'); print(target); return 0
                if args.accion=='auditar-fotografia':
                    target=root/'auditoria_fotografia.json'; images=root/'piloto_fotografico'
                    run_blender(b,'photography_audit.py',['--datos',datafile,'--imagenes',images,'--salida',target],scene,root/'logs'/'auditoria_fotografia.log'); print(target); return 0
                if args.accion=='piloto-temporal':
                    profile='piloto_fotografico'; count=min(48,len(b['fotogramas'])); folder=root/'piloto_temporal'; frames=list(range(1,count+1))
                    run_blender(b,'render.py',['--datos',datafile,'--salida',folder,'--perfil',profile,'--frames',','.join(map(str,frames))],scene,root/'logs'/'piloto_temporal.log')
                    target=folder/'piloto.mp4'; temp=folder/'piloto.tmp.mp4'; encoded={**b['proyecto']['produccion']['perfiles'][profile],'postproduccion':b['presentacion'].get('postproduccion',{})}
                    from .production import ffmpeg_args
                    subprocess.run(ffmpeg_args(folder,temp,b['proyecto']['produccion']['fps'],encoded),check=True); os.replace(temp,target); print(target); return 0
                if args.accion=='comparar':
                    if not args.anterior: raise ValueError('Indica --anterior con el directorio de fotogramas de referencia.')
                    from .production import compare_frames
                    selected_profile=args.perfil or 'previa'; profile=b['proyecto']['produccion']['perfiles'][selected_profile]; frames=[]; offset=0
                    for shot in b['presentacion']['tomas']:
                        frames.extend((offset+1,offset+(shot['fotogramas']+1)//2,offset+shot['fotogramas'])); offset+=shot['fotogramas']
                    report=compare_frames(args.anterior,root/selected_profile,root/'comparaciones'/selected_profile,sorted(set(frames)),*profile['resolucion'])
                    print(json.dumps(report,ensure_ascii=False,separators=(',',':'))); return 0
                if args.toma and args.accion not in {'previas','pilotos-fotograficos'}: raise ValueError('--toma solo se admite con previas o pilotos-fotograficos.')
                if args.accion=='confirmar-visual':
                    if not args.revisor or not args.nota: raise ValueError('Especifica --revisor y --nota tras inspeccionar previas y animática.')
                    if not (root/'animatica'/'recorrido.mp4').exists(): raise ValueError('Genera e inspecciona primero la animática.')
                    atomic(root/'revision_visual.json',{'escena':sha(scene),'revisor':args.revisor,'nota':args.nota}); print(root); return 0
                profile={'previas':'previa','pilotos-fotograficos':'piloto_fotografico','animatica':'animatica','recorrido':args.perfil or ('fotografico_1080p' if 'fotografico_1080p' in b['proyecto']['produccion']['perfiles'] else 'final')}[args.accion]
                if profile in {'final','fotografico_1080p'}:
                    review=root/'revision_visual.json'
                    if not review.exists() or json.loads(review.read_text())['escena']!=sha(scene): raise ValueError('Falta confirmar-visual para esta escena.')
                frames=[]; offset=0
                selected=set(args.toma or [])
                unknown=selected-{shot['id'] for shot in b['presentacion']['tomas']}
                if unknown: raise ValueError('Tomas inexistentes: '+', '.join(sorted(unknown)))
                for s in b['presentacion']['tomas']:
                    if profile in {'previa','piloto_fotografico'} and (not selected or s['id'] in selected):frames.extend([offset+1,offset+(s['fotogramas']+1)//2,offset+s['fotogramas']])
                    offset+=s['fotogramas']
                extra=['--frames',','.join(map(str,sorted(set(frames))))] if frames else []
                run_blender(b,'render.py',['--datos',datafile,'--salida',root/profile,'--perfil',profile,*extra],scene,root/'logs'/(profile+'.log'))
                if profile in {'previa','piloto_fotografico'}:
                    previews=sorted((root/profile).glob('frame_*.png')); rows=max(1,(len(previews)+2)//3)
                    if previews:
                        subprocess.run(['ffmpeg','-v','error','-y','-pattern_type','glob','-i',str(root/profile/'frame_*.png'),'-vf',f'scale=320:-1,tile=3x{rows}','-frames:v','1',str(root/profile/'contacto.jpg')],check=True)
                if profile not in {'previa','piloto_fotografico'}:
                    w,h=b['proyecto']['produccion']['perfiles'][profile]['resolucion']
                    if not all(png_ok(root/profile/f'frame_{f:04d}.png',w,h) for f in range(1,offset+1)): raise ValueError('Secuencia incompleta.')
                    target=root/profile/'recorrido.mp4'; temp=target.with_name('recorrido.tmp.mp4'); fps=b['proyecto']['produccion']['fps']
                    from .production import ffmpeg_args
                    encoded={**b['proyecto']['produccion']['perfiles'][profile],'postproduccion':b['presentacion'].get('postproduccion',{})}
                    subprocess.run(ffmpeg_args(root/profile,temp,fps,encoded),check=True)
                    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,nb_read_frames,r_frame_rate','-of','json',str(temp)]))
                    stream=probe['streams'][0]
                    if (stream['width'],stream['height'],int(stream['nb_read_frames']))!=(w,h,offset):raise ValueError('MP4 no coincide con la secuencia.')
                    os.replace(temp,target); atomic(root/profile/'ffprobe.json',probe)
            print(root)
        return 0
    except (OSError,ValueError,KeyError,TypeError,subprocess.CalledProcessError) as exc:
        print(json.dumps({'ok':False,'diagnosticos':[diagnostic('EJECUCION',str(args.proyecto),str(exc))]},ensure_ascii=False)); return 1
