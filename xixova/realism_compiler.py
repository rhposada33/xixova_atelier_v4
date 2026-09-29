"""Planificador fotográfico determinista e independiente de Blender."""
from __future__ import annotations
import copy, json, math, random
from pathlib import Path
import yaml
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from .core import ROOT, digest, footprint, resolve, solid_volumes

def profile(name):
    path=ROOT/'recipes'/f'{name}.yaml'
    if not path.is_file(): raise ValueError('Perfil visual inexistente: '+name)
    return yaml.safe_load(path.read_text(encoding='utf-8'))

def room_kind(identifier):
    value=identifier.lower()
    for needle,result in [('bano','bano'),('baño','bano'),('dorm','dormitorio'),('cocina','cocina'),('comedor','comedor'),('social','sala'),('sala','sala'),('terra','terraza'),('balcon','terraza')]:
        if needle in value:return result
    return 'circulacion'

def window_summary(architecture):
    result=[]
    indoor=unary_union([Polygon(r['contorno']) for r in architecture['espacios'] if r.get('cubierto',True)])
    for wall in architecture['paredes']:
        dx,dy=wall['b'][0]-wall['a'][0],wall['b'][1]-wall['a'][1]; length=math.hypot(dx,dy)
        for opening in wall['aberturas']:
            if opening['tipo']=='ventana':
                normal=[-dy/length,dx/length] if length else [0,0]
                t=opening['distancia']+opening['ancho']/2
                center=[wall['a'][0]+dx*t/length,wall['a'][1]+dy*t/length]
                if indoor.covers(Point(center[0]+normal[0]*.3,center[1]+normal[1]*.3)): normal=[-x for x in normal]
                result.append({'id':opening['id'],'pared':wall['id'],'area_m2':round(opening['ancho']*opening['alto'],3),
                  'direccion':[round(x,4) for x in normal]})
    return sorted(result,key=lambda x:x['area_m2'],reverse=True)

def assign_levels(bundle):
    focused={shot.get('foco') for shot in bundle['presentacion']['tomas']}
    assets={a['id']:a for a in bundle['catalogo']['activos']}; rows=[]; total=0
    aliases={'Sala':'asientos','Comedor':'mesas','Dormitorio':'dormitorio_almacenamiento','Cocina':'cocina_comedor','Baño':'bano'}
    for item in bundle['interiorismo']['elementos']:
        asset=assets.get(item['activo'],{}); available=asset.get('niveles',{})
        replaced=None
        if not available:
            category=aliases.get(asset.get('categoria'),asset.get('categoria'))
            dims=asset.get('dimensiones',[0,0,0]); candidates=[candidate for candidate in assets.values() if candidate.get('niveles') and candidate.get('categoria')==category and candidate.get('puntuacion_materiales',0)>=8 and candidate.get('puntuacion_geometria',0)>=8 and candidate['dimensiones'][0]<=dims[0]*1.2 and candidate['dimensiones'][1]<=dims[1]*1.2]
            if candidates:
                candidate=max(candidates,key=lambda x:(x.get('puntuacion_materiales',0)+x.get('puntuacion_geometria',0),-x.get('memoria_estimada_mb',0))); replaced={'antes':item['activo'],'despues':candidate['id']}; item['activo']=candidate['id']; asset=candidate; available=asset['niveles']
        requested='hero' if item['id'] in focused else 'standard'
        chosen=requested if requested in available else ('standard' if 'standard' in available else None)
        if chosen:item['nivel_detalle']=chosen
        memory=asset.get('memoria_estimada_mb',0); total+=memory
        rows.append({'elemento':item['id'],'activo':item['activo'],'nivel':chosen or 'legacy','protagonista':item['id'] in focused,'memoria_mb':memory,'sustitucion':replaced})
    return rows,total

def solve_lighting(bundle, windows):
    presentation=bundle['presentacion']; changes=[]
    if windows:
        direction=windows[0]['direccion']; azimuth=round(math.degrees(math.atan2(direction[1],direction[0])),1)
        before=presentation.get('sol',{}).get('azimut_grados'); presentation.setdefault('sol',{})['azimut_grados']=azimuth
        changes.append({'campo':'sol.azimut_grados','antes':before,'despues':azimuth,'ventana':windows[0]['id']})
    for light in presentation['luces']:
        before=light.get('temperatura_k'); light['temperatura_k']=max(2700,min(3000,before or 2900))
        if before!=light['temperatura_k']:changes.append({'campo':'luz.'+light['id']+'.temperatura_k','antes':before,'despues':light['temperatura_k']})
    return changes

def camera_diagnostics(bundle):
    placements,_=resolve(bundle); obstacles=[(x['id'],footprint(x)) for x in placements]
    obstacles += [(i,p) for i,p,_,_ in solid_volumes(bundle['arquitectura'])]
    wall_ids={w['id'] for w in bundle['arquitectura']['paredes']}
    rows=[]
    for shot in bundle['presentacion']['tomas']:
        problems=[]; corrections=[]; lens=shot['lente']; focus=next((x for x in placements if x['id']==shot.get('foco')),None)
        if lens<24: problems.append('GRAN_ANGULAR_EXTREMO')
        if focus:
            for key in ('posicion','objetivo'):
                for point in [p[key] for p in shot['puntos']]:
                    if not 1.25<=shot['puntos'][0]['posicion'][2]<=1.6: problems.append('ALTURA_CAMARA')
                    ray=LineString([point[:2],focus['posicion'][:2]])
                    blockers=[identifier for identifier,poly in obstacles if identifier!=focus['id'] and ray.crosses(poly.buffer(.02))]
                    if any(identifier not in wall_ids for identifier in blockers): problems.append('VISTA_OBSTRUIDA_MUEBLE')
                    if any(identifier in wall_ids for identifier in blockers): corrections.append('CORTE_ARQUITECTONICO')
        rows.append({'toma':shot['id'],'lente':lens,'problemas':sorted(set(problems)),'correcciones':sorted(set(corrections))})
    return rows

def compile_bundle(bundle):
    result=copy.deepcopy(bundle); settings=result['proyecto'].get('realismo',{})
    style=profile(settings.get('perfil','lujo_editorial_golden_hour')); seed=int(settings.get('semilla',1842)); random.Random(seed)
    levels,memory=assign_levels(result); windows=window_summary(result['arquitectura'])
    lighting=solve_lighting(result,windows)
    for shot in result['presentacion']['tomas']:
        base_exposure=result['presentacion']['exposicion']
        shot['exposicion']=max(base_exposure-.5,min(base_exposure+.5,shot.get('exposicion',base_exposure)))
        inferred=next((x['espacio'] for x in result['interiorismo']['elementos'] if x['id']==shot.get('foco')),shot['id'])
        kind='detalle' if 'detalle' in shot['id'].lower() else room_kind(inferred)
        low,high=style['recetas'][kind]['lente_mm']; shot['lente']=max(low,min(high,shot['lente'])); shot['apertura_f']=max(4,min(8,shot.get('apertura_f',5.6)))
        for point in shot['puntos']: point['posicion'][2]=max(style['altura_camara_m'][0],min(style['altura_camara_m'][1],point['posicion'][2]))
    report={'schema':1,'perfil':style['id'],'version':style['version'],'semilla':seed,'hash_entrada':digest({'a':bundle['arquitectura'],'i':bundle['interiorismo'],'p':bundle['presentacion']}),
      'espacios':[{'id':r['id'],'tipo':room_kind(r['id']),'area_m2':round(Polygon(r['contorno']).area,2)} for r in result['arquitectura']['espacios']],
      'ventanas':windows,'iluminacion':lighting,'niveles':levels,'memoria_activos_mb':round(memory,1),'camaras':camera_diagnostics(result)}
    report['diagnosticos']=[{'codigo':p,'elemento':row['toma']} for row in report['camaras'] for p in row['problemas']]
    report['diagnosticos'] += [{'codigo':'ACTIVO_HEREDADO','elemento':row['elemento']} for row in levels if row['protagonista'] and row['nivel']=='legacy']
    report['hash_compilado']=digest({'i':result['interiorismo'],'p':result['presentacion'],'perfil':style})
    return result,report

def compact_report(report, photo=None, scene=None):
    photo=photo or {}; scene=scene or {}; warnings=photo.get('avisos',[])
    result={'schema':1,'perfil':report['perfil'],'hash':report['hash_compilado'],'memoria_mb':report['memoria_activos_mb'],
      'tomas':[{'id':x['toma'],'lente':x['lente'],'problemas':x['problemas']} for x in report['camaras']],
      'diagnosticos':report['diagnosticos']+scene.get('diagnosticos',[])+warnings}
    encoded=json.dumps(result,ensure_ascii=False,separators=(',',':'))
    result['bytes']=len(encoded.encode()); return result

def correct_exposure(bundle, photo):
    by_shot={}
    for row in photo.get('controles',[]):by_shot.setdefault(row['toma'],[]).append(row)
    changes=[]
    for shot in bundle['presentacion']['tomas']:
        rows=by_shot.get(shot['id'],[])
        if not rows:continue
        mean=sum(x['luminancia_media'] for x in rows)/len(rows); clipped=max(x['altas_recortadas'] for x in rows); delta=.35 if mean<.22 else (-.35 if mean>.75 or clipped>.03 else 0)
        if delta:
            base=bundle['presentacion']['exposicion']; before=shot.get('exposicion',base); shot['exposicion']=round(max(base-.5,min(base+.5,before+delta)),2)
            if shot['exposicion']!=before:changes.append({'toma':shot['id'],'antes':before,'despues':shot['exposicion']})
    return changes
