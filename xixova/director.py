"""Modelo de dominio del Director: timeline, comandos, borradores y publicación."""
from __future__ import annotations
import copy, hashlib, json, math, os, uuid
from pathlib import Path
import yaml
from .core import contract, digest, load, resolve

INTERPOLATIONS={'linear','bezier','ease_in','ease_out','ease_in_out','hold'}

def _key(time,value,interpolation='ease_in_out', identity=None):
    identifier=(hashlib.sha256(identity.encode()).hexdigest()[:12] if identity else uuid.uuid4().hex[:12])
    return {'id':identifier,'tiempo':round(time,4),'valor':value,'interpolacion':interpolation}

def import_legacy(bundle):
    fps=bundle['proyecto']['produccion']['fps']; shots=[]; tracks=[]; start=0.0
    for shot in bundle['presentacion']['tomas']:
        duration=shot['fotogramas']/fps; sid=shot['id']; shots.append({'id':sid,'inicio':round(start,4),'duracion':round(duration,4),'camara':sid,'transicion':'corte'})
        times=[start+(duration*i/max(1,len(shot['puntos'])-1)) for i in range(len(shot['puntos']))]
        for prop in ('posicion','objetivo'):
            tracks.append({'id':f'{sid}:{prop}','tipo':'camara','objetivo':sid,'propiedad':prop,'claves':[_key(t,p[prop],identity=f'{sid}:{prop}:{i}') for i,(t,p) in enumerate(zip(times,shot['puntos']))]})
        tracks += [
          {'id':f'{sid}:lente','tipo':'camara','objetivo':sid,'propiedad':'lente','claves':[_key(start,shot['lente'],'hold',f'{sid}:lente')]},
          {'id':f'{sid}:apertura','tipo':'camara','objetivo':sid,'propiedad':'apertura','claves':[_key(start,shot.get('apertura_f',7.1),'hold',f'{sid}:apertura')]},
          {'id':f'{sid}:exposicion','tipo':'camara','objetivo':sid,'propiedad':'exposicion','claves':[_key(start,shot.get('exposicion',bundle['presentacion']['exposicion']),'hold',f'{sid}:exposicion')]},]
        start+=duration
    return {'schema':1,'fps':fps,'duracion':round(start,4),'semilla':bundle['proyecto'].get('realismo',{}).get('semilla',1842),'tomas':shots,'pistas':tracks,'marcadores':[]}

def validate_script(script,bundle):
    openings={opening['id'] for wall in bundle['arquitectura']['paredes'] for opening in wall['aberturas']}
    issues=contract(script,'guion_direccion'); ids={x['id'] for x in bundle['interiorismo']['elementos']}|{x['id'] for x in bundle['presentacion']['luces']}|{x['id'] for x in bundle['presentacion']['tomas']}|{x.get('camara') for x in script.get('tomas',[])}|openings
    for track in script.get('pistas',[]):
        if track['objetivo'] not in ids and track['tipo']!='material':issues.append({'codigo':'DIRECTOR_REFERENCIA','gravedad':'error','elemento':track['id'],'explicacion':'Objetivo inexistente.'})
        previous=-1
        for key in sorted(track['claves'],key=lambda x:x['tiempo']):
            if key['tiempo']>script.get('duracion',0):issues.append({'codigo':'DIRECTOR_TIEMPO','gravedad':'error','elemento':key['id'],'explicacion':'Clave fuera del montaje.'})
            if key['tiempo']==previous:issues.append({'codigo':'DIRECTOR_CLAVE_DUPLICADA','gravedad':'error','elemento':track['id'],'explicacion':'Dos claves ocupan el mismo tiempo.'})
            previous=key['tiempo']
    ordered=sorted(script.get('tomas',[]),key=lambda x:x['inicio'])
    if len({x['id'] for x in ordered})!=len(ordered):issues.append({'codigo':'DIRECTOR_ID_DUPLICADO','gravedad':'error','elemento':'tomas','explicacion':'Los IDs de toma deben ser únicos.'})
    if ordered and ordered[0]['inicio']>1e-6:issues.append({'codigo':'DIRECTOR_HUECO','gravedad':'error','elemento':ordered[0]['id'],'explicacion':'El montaje debe comenzar en 0 s.'})
    for left,right in zip(ordered,ordered[1:]):
        if left['inicio']+left['duracion']>right['inicio']+1e-6:issues.append({'codigo':'DIRECTOR_SOLAPE','gravedad':'error','elemento':right['id'],'explicacion':'Las tomas se superponen.'})
        elif left['inicio']+left['duracion']<right['inicio']-1e-6:issues.append({'codigo':'DIRECTOR_HUECO','gravedad':'error','elemento':right['id'],'explicacion':'Hay un hueco sin toma en el montaje.'})
    for shot in ordered:
        if shot['inicio']+shot['duracion']>script.get('duracion',0)+1e-6:issues.append({'codigo':'DIRECTOR_MONTAJE','gravedad':'error','elemento':shot['id'],'explicacion':'La toma termina fuera del montaje.'})
    return issues

def apply_command(script,command):
    out=copy.deepcopy(script); action=command.get('accion')
    def track(identifier):
        found=next((x for x in out['pistas'] if x['id']==identifier),None)
        if not found:raise ValueError('Pista inexistente: '+str(identifier))
        return found
    if action=='move_keyframe':
        key=next((x for x in track(command['pista'])['claves'] if x['id']==command['clave']),None)
        if not key:raise ValueError('Clave inexistente.')
        key['tiempo']=round(command['tiempo'],4)
        if 'valor' in command:key['valor']=command['valor']
    elif action=='set_keyframe':
        target=next((x for x in out['pistas'] if x['id']==command.get('pista')),None)
        if target is None and command.get('objetivo') and command.get('propiedad'):
            target={'id':command.get('pista') or uuid.uuid4().hex[:12],'tipo':command.get('tipo','objeto'),'objetivo':command['objetivo'],'propiedad':command['propiedad'],'claves':[]}; out['pistas'].append(target)
        if target is None:raise ValueError('Pista inexistente.')
        existing=next((x for x in target['claves'] if abs(x['tiempo']-command['tiempo'])<1e-6),None)
        value={'id':existing['id'] if existing else uuid.uuid4().hex[:12],'tiempo':round(command['tiempo'],4),'valor':command['valor'],'interpolacion':command.get('interpolacion','ease_in_out')}
        if existing:target['claves'][target['claves'].index(existing)]=value
        else:target['claves'].append(value); target['claves'].sort(key=lambda x:x['tiempo'])
    elif action=='delete_keyframe':
        target=track(command['pista']); target['claves']=[x for x in target['claves'] if x['id']!=command['clave']]
    elif action=='change_lens':
        target=next((x for x in out['pistas'] if x['objetivo']==command['camara'] and x['propiedad']=='lente'),None)
        if not target:raise ValueError('Cámara inexistente.')
        target['claves']=[_key(command.get('tiempo',0),max(18,min(70,command['lente'])),'hold')]
    elif action=='add_cut':
        shot=copy.deepcopy(command['toma']); out['tomas'].append(shot); out['tomas'].sort(key=lambda x:x['inicio'])
    elif action=='create_camera':
        identifier=command['id']; start=out['duracion']; duration=max(.25,command.get('duracion',4)); position=command['posicion']; target=command['objetivo']
        out['tomas'].append({'id':identifier,'inicio':start,'duracion':duration,'camara':identifier,'transicion':'corte'}); out['duracion']=round(start+duration,4)
        out['pistas'] += [
          {'id':identifier+':posicion','tipo':'camara','objetivo':identifier,'propiedad':'posicion','claves':[_key(start,position,'hold'),_key(start+duration,position,'hold')]},
          {'id':identifier+':objetivo','tipo':'camara','objetivo':identifier,'propiedad':'objetivo','claves':[_key(start,target,'hold'),_key(start+duration,target,'hold')]},
          {'id':identifier+':lente','tipo':'camara','objetivo':identifier,'propiedad':'lente','claves':[_key(start,command.get('lente',35),'hold')]},
          {'id':identifier+':apertura','tipo':'camara','objetivo':identifier,'propiedad':'apertura','claves':[_key(start,7.1,'hold')]},
          {'id':identifier+':exposicion','tipo':'camara','objetivo':identifier,'propiedad':'exposicion','claves':[_key(start,0,'hold')]},]
    elif action=='duplicate_shot':
        original=next((x for x in out['tomas'] if x['id']==command['toma']),None)
        if not original:raise ValueError('Toma inexistente.')
        duplicate=copy.deepcopy(original); duplicate['id']=command.get('id',original['id']+'_copia'); duplicate['inicio']=round(command.get('inicio',out['duracion']),4)
        out['tomas'].append(duplicate); out['tomas'].sort(key=lambda x:x['inicio']); out['duracion']=max(out['duracion'],duplicate['inicio']+duplicate['duracion'])
    elif action=='split_shot':
        original=next((x for x in out['tomas'] if x['id']==command['toma']),None); at=command['tiempo']
        if not original or not original['inicio']<at<original['inicio']+original['duracion']:raise ValueError('El corte debe quedar dentro de la toma.')
        end=original['inicio']+original['duracion']; original['duracion']=round(at-original['inicio'],4)
        duplicate=copy.deepcopy(original); duplicate['id']=command.get('id',original['id']+'_b'); duplicate['inicio']=round(at,4); duplicate['duracion']=round(end-at,4); out['tomas'].append(duplicate); out['tomas'].sort(key=lambda x:x['inicio'])
    elif action=='animate_object':
        target=next((x for x in out['pistas'] if x['objetivo']==command['objeto'] and x['propiedad']==command['propiedad']),None)
        if not target:
            target={'id':uuid.uuid4().hex[:12],'tipo':command.get('tipo','objeto'),'objetivo':command['objeto'],'propiedad':command['propiedad'],'claves':[]}; out['pistas'].append(target)
        fresh=[_key(k['tiempo'],k['valor'],k.get('interpolacion','ease_in_out')) for k in command['claves']]
        if command.get('reemplazar'):target['claves']=fresh
        else:
            times={k['tiempo'] for k in fresh}; target['claves']=sorted([k for k in target['claves'] if k['tiempo'] not in times]+fresh,key=lambda k:k['tiempo'])
    elif action=='preset': apply_preset(out,command)
    elif action=='set_duration': out['duracion']=round(command['duracion'],4)
    else: raise ValueError('Acción de Director desconocida: '+str(action))
    out['revision']={'estado':'pendiente','motivo':'Guion, cámara, luz, material o animación modificados.'}
    return out

def apply_preset(script,command):
    name=command['preset']; start=command.get('inicio',0); duration=command.get('duracion',4); target=command['objetivo']; kind=command.get('tipo','camara'); base=command.get('valor',[0,0,0]); amount=command.get('magnitud',.6)
    vectors={'aproximacion':([0,-amount,0],[0,amount,0]),'desplazamiento_lateral':([-amount,0,0],[amount,0,0]),'grua':([0,0,-amount],[0,0,amount]),'revelar_desde_puerta':([-amount,0,0],[amount*.3,0,0]),'orbita_suave':([-amount,-amount*.25,0],[amount,amount*.25,0]),'detalle_estatico':([0,0,0],[0,0,0]),'aparicion':(False,True),'encender_luz':(0,command.get('potencia',500))}
    if name not in vectors:raise ValueError('Preset desconocido: '+name)
    prop='visible' if name=='aparicion' else ('potencia' if name=='encender_luz' else 'posicion'); a,b=vectors[name]
    values=(a,b) if prop!='posicion' else ([base[i]+a[i] for i in range(3)],[base[i]+b[i] for i in range(3)])
    apply= {'accion':'animate_object','objeto':target,'tipo':kind,'propiedad':prop,'claves':[{'tiempo':start,'valor':values[0],'interpolacion':'ease_in_out'},{'tiempo':start+duration,'valor':values[1],'interpolacion':'ease_in_out'}]}
    updated=apply_command(script,apply); script.clear(); script.update(updated)

def paths(project,variant):
    bundle,_=load(project,variant); base=Path(bundle['archivo']).parent; selected=variant or next(iter(bundle['proyecto']['variantes'])); source=base/bundle['proyecto'].get('guion_direccion',f'.director/{selected}/guion_direccion.yaml'); draft=base/'.director'/selected/'borrador.yaml'; return bundle,source,draft

def read_or_import(project,variant):
    bundle,legacy_source,legacy_draft=paths(project,variant); selected=variant or next(iter(bundle['proyecto']['variantes'])); root=Path(bundle['archivo']).parent/'.director'/selected
    source=root/'guiones'/'principal.yaml' if (root/'guiones'/'principal.yaml').is_file() else legacy_source
    draft=root/'borradores'/'principal.yaml' if (root/'borradores'/'principal.yaml').is_file() else legacy_draft
    path=draft if draft.is_file() else source
    script=yaml.safe_load(path.read_text()) if path.is_file() else import_legacy(bundle)
    return bundle,script,source,draft,digest(script)

def atomic_yaml(path,data):
    path.parent.mkdir(parents=True,exist_ok=True); temp=path.with_suffix(path.suffix+'.tmp'); temp.write_text(yaml.safe_dump(data,sort_keys=False,allow_unicode=True)); os.replace(temp,path)

def scene_payload(bundle,script):
    resolved,_=resolve(bundle)
    return {'arquitectura_hash':bundle['arquitectura_hash'],'fps':script['fps'],'duracion':script['duracion'],'espacios':bundle['arquitectura']['espacios'],'paredes':bundle['arquitectura']['paredes'],'elementos':resolved,'luces':bundle['presentacion']['luces'],'tomas':script['tomas'],'pistas':script['pistas']}

def context(bundle,script,selected=None,issues=None):
    value={'schema':1,'proyecto':bundle['proyecto']['id'],'variante':bundle['interiorismo']['id'],'hash':digest(script),'duracion':script['duracion'],'fps':script['fps'],'seleccion':selected,'tomas':[{'id':x['id'],'inicio':x['inicio'],'duracion':x['duracion'],'camara':x['camara']} for x in script['tomas']],'diagnosticos':issues or []}
    value['bytes']=len(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()); return value

def sample(track,time):
    """Evalúa una pista en segundos sin depender de Blender o del navegador."""
    keys=sorted(track.get('claves',[]),key=lambda x:x['tiempo'])
    if not keys:return None
    if time<=keys[0]['tiempo']:return copy.deepcopy(keys[0]['valor'])
    if time>=keys[-1]['tiempo']:return copy.deepcopy(keys[-1]['valor'])
    right=next(i for i,k in enumerate(keys) if k['tiempo']>=time); a,b=keys[right-1],keys[right]
    t=(time-a['tiempo'])/(b['tiempo']-a['tiempo']); mode=a.get('interpolacion','linear')
    if mode=='hold':t=0
    elif mode in {'bezier','ease_in_out'}:t=t*t*(3-2*t)
    elif mode=='ease_in':t=t*t
    elif mode=='ease_out':t=1-(1-t)*(1-t)
    def blend(x,y):return x+(y-x)*t
    if isinstance(a['valor'],list):return [blend(x,y) for x,y in zip(a['valor'],b['valor'])]
    if isinstance(a['valor'],bool):return a['valor'] if t<.5 else b['valor']
    return blend(a['valor'],b['valor'])

def compile_script(bundle,script):
    """Convierte el montaje a datos resueltos para Blender, conservando las pistas."""
    out=copy.deepcopy(bundle); tracks={(x['objetivo'],x['propiedad']):x for x in script['pistas']}; shots=[]
    for cut in sorted(script['tomas'],key=lambda x:x['inicio']):
        camera=cut['camara']; frames=max(2,round(cut['duracion']*script['fps'])); position=tracks.get((camera,'posicion')); target=tracks.get((camera,'objetivo'))
        if not position or not target:raise ValueError('La cámara '+camera+' necesita pistas de posición y objetivo.')
        points=[]
        for frame in range(frames):
            time=cut['inicio']+(frame/(frames-1))*cut['duracion']; points.append({'posicion':sample(position,time),'objetivo':sample(target,time)})
        lens=sample(tracks.get((camera,'lente'),{'claves':[{'tiempo':0,'valor':35}]}),cut['inicio'])
        aperture=sample(tracks.get((camera,'apertura'),{'claves':[{'tiempo':0,'valor':7.1}]}),cut['inicio'])
        exposure=sample(tracks.get((camera,'exposicion'),{'claves':[{'tiempo':0,'valor':out['presentacion']['exposicion']}]}),cut['inicio'])
        shots.append({'id':cut['id'],'lente':lens,'fotogramas':frames,'interpolacion':'lineal','apertura_f':aperture,'exposicion':exposure,'puntos':points,'_director_camera':camera,'_director_inicio':cut['inicio']})
    out['presentacion']['tomas']=shots; out['proyecto']['produccion']['fps']=script['fps']; out['direccion']=copy.deepcopy(script)
    resolved,issues=resolve(out)
    if issues:raise ValueError('; '.join(x['explicacion'] for x in issues))
    out['resueltos']=resolved; out['fotogramas']=[dict(toma=s,numero=f,posicion=p,objetivo=t) for s,f,p,t in __import__('xixova.core',fromlist=['camera_frames']).camera_frames(out['presentacion'])]
    return out
