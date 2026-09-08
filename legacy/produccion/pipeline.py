# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml>=6,<7"]
# ///
"""CLI declarativo del pipeline de producción arquitectónica."""
import argparse, hashlib, json, os, re, shutil, struct, subprocess, sys, time
from fractions import Fraction
from pathlib import Path
import yaml

HERE=Path(__file__).resolve().parent

def expand(value):
    pattern=re.compile(r'\$\{([A-Z0-9_]+):-([^}]+)\}')
    value=pattern.sub(lambda m:os.environ.get(m.group(1),m.group(2)),str(value))
    return os.path.expandvars(os.path.expanduser(value))

def load(path):
    raw=yaml.safe_load(path.read_text(encoding='utf-8'))
    base=path.parent.resolve()
    for key,value in raw['rutas'].items():
        p=Path(expand(value)); raw['rutas'][key]=str((p if p.is_absolute() else base/p).resolve())
    raw['blender']['ejecutable']=str(Path(expand(raw['blender']['ejecutable'])).resolve())
    for name,value in raw.get('herramientas',{}).items():
        candidate=expand(value); raw['herramientas'][name]=shutil.which(candidate) or candidate
    raw['_archivo']=str(path.resolve())
    scene=Path(raw['rutas']['escena'])
    raw['_escena_fingerprint']={'size':scene.stat().st_size,'mtime_ns':scene.stat().st_mtime_ns} if scene.exists() else None
    # Herramientas de montaje no cambian el contenido de los PNG y no invalidan el render.
    hash_basis={k:v for k,v in raw.items() if k!='herramientas'}
    canonical=json.dumps(hash_basis,sort_keys=True,ensure_ascii=False).encode()
    raw['_hash']=hashlib.sha256(canonical).hexdigest()[:16]
    return raw

def validate(c, allow_missing_catalog=False):
    errors=[]; warnings=[]
    if c.get('schema')!=3: errors.append('schema debe ser 3')
    if '/originales/' in c['rutas']['escena']: errors.append('rutas.escena no puede apuntar a originales')
    shots=c.get('tomas',[]); expected=int(c['video']['inicio'])
    for s in shots:
        if int(s['inicio'])!=expected: errors.append(f"{s['id']}: rango no contiguo")
        if int(s['fin'])<int(s['inicio']): errors.append(f"{s['id']}: rango invertido")
        if not 18<=float(s['lente'])<=70: errors.append(f"{s['id']}: lente fuera de 18–70 mm")
        expected=int(s['fin'])+1
    if shots and int(shots[-1]['fin'])!=int(c['video']['fin']): errors.append('última toma no coincide con video.fin')
    for name,p in c.get('perfiles',{}).items():
        if len(p.get('resolucion',[]))!=2 or any(int(x)<=0 or int(x)%2 for x in p['resolucion']): errors.append(f'{name}: resolución debe ser positiva y par')
    catalog=Path(c['_archivo']).parent/c['activos']['catalogo']
    recipes=Path(c['_archivo']).parent/c['activos']['recetas']
    try:
        data=json.loads(catalog.read_text(encoding='utf-8')); ids={x['id'] for x in data['activos']}
        required={'version','categoria','dimensiones_m','archivo','licencia','autor','triangulos','memoria_estimada_mb','miniatura','validado','hash_receta_sha256'}
        if data.get('schema')!=3: errors.append('catálogo de activos debe usar schema 3')
        for asset in data['activos']:
            if not required.issubset(asset): errors.append(f"{asset.get('id')}: metadatos incompletos")
            quality={'quality_tier','lod_variants','mapas_pbr','densidad_texel_px_m','uv_validado','normales_validadas','resolucion_texturas','estado_visual','tomas'}
            if not quality.issubset(asset): errors.append(f"{asset.get('id')}: metadatos v3 incompletos")
            if not asset['archivo'].startswith('${XIXOVA_LIBRARY_DIR}'): errors.append(f"{asset['id']}: ruta de biblioteca no portable")
        placements=json.loads(recipes.read_text(encoding='utf-8'))['colocaciones']
        for item in placements:
            if item['activo'] not in ids: errors.append(f"receta usa activo desconocido: {item['activo']}")
            if not isinstance(item['escala'],(int,float)) or item['escala']<=0: errors.append(f"{item['activo']}: escala no uniforme/válida")
    except (OSError,KeyError,ValueError,TypeError) as exc:
        (warnings if allow_missing_catalog else errors).append('catálogo/recetas inválidos: '+str(exc))
    for name in ('blender','ffmpeg','ffprobe'):
        exe=c['blender']['ejecutable'] if name=='blender' else c['herramientas'].get(name)
        if not exe or not Path(exe).exists(): errors.append(f'{name} no disponible')
    return errors,warnings

def resolved(c):
    out=Path(c['rutas']['salidas'])/'manifiestos'/c['_hash']; out.mkdir(parents=True,exist_ok=True)
    target=out/'config_resuelta.json'; target.write_text(json.dumps(c,indent=2,ensure_ascii=False),encoding='utf-8')
    return target

def active_on(path):
    needle=str(Path(path).resolve()).encode()
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit(): continue
        try:
            cmd=(proc/'cmdline').read_bytes()
            if b'blender' in cmd and needle in cmd: return int(proc.name)
        except (OSError,PermissionError): pass
    return None

def blender(c,script,extra=(),target=None):
    scene=target or c['rutas']['escena']; pid=active_on(scene)
    if pid: raise SystemExit(f'Escena en uso por Blender PID {pid}; no se modifica: {scene}')
    cfg=resolved(c)
    if Path(scene)==Path(c['rutas']['escena']) and script!='preflight_blender.py':
        phase='camaras' if script=='configurar_recorrido_completo.py' else ('construir' if script in {'completar_zonas_y_biblioteca.py','construir_fotorrealismo_v3.py','optimizar_vram.py'} else 'render')
        subprocess.run([c['blender']['ejecutable'],'--background',scene,'--factory-startup','--python-exit-code','1','--python',str(HERE/'scripts'/'preflight_blender.py'),'--','--config',str(cfg),'--fase',phase],check=True)
    cmd=[c['blender']['ejecutable'],'--background',scene,'--factory-startup','--python-exit-code','1','--python',str(HERE/'scripts'/script),'--','--config',str(cfg),*extra]
    subprocess.run(cmd,check=True,env={**os.environ,'XIXOVA_LIBRARY_DIR':str(Path(c['rutas']['biblioteca']).parent)})

def png_ok(path,w,h):
    try:
        data=path.read_bytes()[:24]
        return path.stat().st_size>1024 and data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(w,h)
    except OSError:return False

def profile_dir(c,name): return Path(c['rutas']['salidas'])/c['_hash']/name

def ffmpeg_args(frames,mp4,fps,profile,binary='ffmpeg'):
    return [binary,'-y','-framerate',str(fps),'-i',str(frames/'frame_%04d.png'),'-c:v','libx264','-preset','slow' if profile=='final' else 'medium','-crf','18' if profile=='final' else '20','-pix_fmt','yuv420p','-movflags','+faststart',str(mp4)]

def render(c,profile,frames=''):
    root=profile_dir(c,profile); out=root/'frames'; root.mkdir(parents=True,exist_ok=True)
    manifest={'config_hash':c['_hash'],'escena':c['_escena_fingerprint'],'perfil':c['perfiles'][profile],'rango':[c['video']['inicio'],c['video']['fin']]}
    (root/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
    args=['--modo',profile,'--salida',str(out)]
    if frames: args+=['--frames',frames]
    blender(c,'renderizar.py',args)
    return out

def assemble(c,profile):
    p=c['perfiles'][profile]; out=profile_dir(c,profile); frames=out/'frames'; w,h=p['resolucion']
    missing=[n for n in range(c['video']['inicio'],c['video']['fin']+1) if not png_ok(frames/f'frame_{n:04d}.png',w,h)]
    if missing: raise SystemExit(f'No se crea MP4: {len(missing)} fotogramas ausentes o inválidos; primero={missing[:8]}')
    mp4=out/f"{c['proyecto']}_{profile}.mp4"; fps=str(c['video']['fps'])
    subprocess.run(ffmpeg_args(frames,mp4,fps,profile,c['herramientas']['ffmpeg']),check=True)
    probe=subprocess.run([c['herramientas']['ffprobe'],'-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=codec_name,width,height,r_frame_rate,nb_read_frames','-show_entries','format=duration','-of','json',str(mp4)],check=True,text=True,capture_output=True)
    payload=json.loads(probe.stdout); stream=payload['streams'][0]
    expected_frames=c['video']['fin']-c['video']['inicio']+1; expected_duration=expected_frames/int(fps)
    checks=(stream['codec_name']=='h264',int(stream['width'])==w,int(stream['height'])==h,Fraction(stream['r_frame_rate'])==int(fps),int(stream['nb_read_frames'])==expected_frames,abs(float(payload['format']['duration'])-expected_duration)<.01)
    payload['validacion']={'ok':all(checks),'esperado':{'codec':'h264','resolucion':[w,h],'fps':int(fps),'fotogramas':expected_frames,'duracion':expected_duration}}
    (out/'ffprobe.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8')
    if not all(checks): raise SystemExit('El MP4 fue creado pero no pasó la validación FFprobe')
    print(mp4)

def status(c):
    print('config_hash:',c['_hash'])
    for name,p in c['perfiles'].items():
        folder=profile_dir(c,name)/'frames'; w,h=p['resolucion']
        if name=='iluminacion': expected=sorted({x for s in c['tomas'] for x in (s['inicio'],(s['inicio']+s['fin'])//2,s['fin'])})
        elif name=='piloto': expected=sorted({x for values in c['calidad']['pilotos'].values() for x in values})
        else: expected=list(range(c['video']['inicio'],c['video']['fin']+1))
        total=len(expected); count=sum(png_ok(folder/f'frame_{n:04d}.png',w,h) for n in expected)
        log=profile_dir(c,name)/'logs'/f'{name}.jsonl'; times=[]
        if log.exists():
            for line in log.read_text(encoding='utf-8').splitlines()[-50:]:
                try:
                    row=json.loads(line)
                    if row.get('estado')=='ok': times.append(float(row['segundos']))
                except (ValueError,KeyError): pass
        eta=(sum(times)/len(times))*(total-count) if times else None
        suffix=f', ETA {eta/60:.1f} min' if eta is not None else ''
        print(f'{name}: {count}/{total} ({count/total:.1%}){suffix}')
    pid=active_on(c['rutas']['escena']); print('blender_pid:',pid or 'inactivo')

def quality_audit(c):
    out=Path(c['rutas']['salidas'])/'auditoria_calidad'; out.mkdir(parents=True,exist_ok=True)
    checks=','.join(str(x) for s in c['tomas'] for x in (s['inicio'],(s['inicio']+s['fin'])//2,s['fin']))
    blender(c,'auditar_calidad.py',('--salida',str(out),'--frames',checks))

def compare(c):
    subprocess.run([sys.executable,str(HERE/'scripts'/'comparar_pilotos.py'),'--config',str(resolved(c))],check=True)

def optimize_vram(c):
    blender(c,'optimizar_vram.py',('--objetivo-mb',str(c['calidad']['objetivo_vram_mb'])))

def ensure_pbr(c):
    subprocess.run([sys.executable,str(HERE/'scripts'/'descargar_recursos_pbr.py'),'--destino',c['rutas']['recursos_pbr']],check=True)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('-c','--config',type=Path,default=HERE/'proyecto.yaml')
    ap.add_argument('accion',choices=['validar','resolver','preparar','construir','camaras','revisar','pilotos','animatica','render','montar','estado','biblioteca','auditar-calidad','comparar','optimizar-vram'])
    ap.add_argument('--quality',choices=['proxy','final'],default='final')
    a=ap.parse_args(); c=load(a.config); errors,warnings=validate(c,a.accion in {'preparar','construir','biblioteca'})
    if errors: raise SystemExit('\n'.join('ERROR: '+x for x in errors))
    if a.accion=='validar': print('CONFIG_OK',c['_hash']); return
    if a.accion=='resolver': print(resolved(c)); return
    if a.accion=='estado': status(c); return
    if a.accion=='preparar':
        dst=Path(c['rutas']['escena']); dst.parent.mkdir(parents=True,exist_ok=True)
        if dst.exists(): print('Existe, no se sobrescribe:',dst)
        else: shutil.copy2(c['rutas']['base'],dst); print(dst)
    elif a.accion=='construir':
        ensure_pbr(c); blender(c,'construir_fotorrealismo_v3.py',('--quality',a.quality))
    elif a.accion=='camaras': blender(c,'configurar_recorrido_completo.py')
    elif a.accion=='revisar':
        checks=','.join(str(x) for s in c['tomas'] for x in (s['inicio'],(s['inicio']+s['fin'])//2,s['fin']))
        render(c,'iluminacion',checks)
    elif a.accion=='pilotos':
        frames=','.join(str(x) for values in c['calidad']['pilotos'].values() for x in values)
        render(c,'piloto',frames)
    elif a.accion=='animatica': render(c,'composicion'); assemble(c,'composicion')
    elif a.accion=='render': render(c,'final')
    elif a.accion=='montar': assemble(c,'final')
    elif a.accion=='biblioteca':
        ensure_pbr(c); blender(c,'construir_fotorrealismo_v3.py',('--quality',a.quality))
        blender(c,'normalizar_biblioteca.py',('--biblioteca',c['rutas']['biblioteca']),target=c['rutas']['biblioteca'])
        blender(c,'generar_previews_biblioteca.py',('--biblioteca',c['rutas']['biblioteca']),target=c['rutas']['biblioteca'])
    elif a.accion=='auditar-calidad': quality_audit(c)
    elif a.accion=='comparar': compare(c)
    elif a.accion=='optimizar-vram': optimize_vram(c)

if __name__=='__main__': main()
