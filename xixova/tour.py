"""Generador determinista de recorridos editables para Xixova Director."""
from __future__ import annotations
import math
from collections import deque
from shapely.geometry import Point, Polygon, LineString
from .core import footprint, resolve
from .director import _key, validate_script

PRESETS={
 'visita_completa':{'nombre':'Visita completa','descripcion':'Recorrido natural y tranquilo por todas las áreas.','areas':'todas','ritmo':1.0},
 'editorial':{'nombre':'Editorial','descripcion':'Alterna movimientos y prioriza protagonistas.','areas':'todas','ritmo':1.0},
 'recorrido_rapido':{'nombre':'Recorrido rápido','descripcion':'Resumen ágil de muchas áreas.','areas':'todas','ritmo':.72},
 'zona_social':{'nombre':'Zona social','descripcion':'Sala, comedor, cocina y terraza.','areas':'social','ritmo':1.0},
 'zona_privada':{'nombre':'Zona privada','descripcion':'Dormitorios, baños y circulación.','areas':'privada','ritmo':1.0},
}

def room_kind(identifier):
    value=identifier.lower()
    for key in ('bano','baño','dormitorio','cocina','comedor','sala','social','terraza','circulacion','pasillo'):
        if key in value:return {'baño':'bano','pasillo':'circulacion'}.get(key,key)
    return 'otro'

def duration_for(identifier,preset):
    kind=room_kind(identifier); base=5 if kind in {'social','sala','comedor','terraza'} else 4 if kind in {'dormitorio','cocina'} else 3
    return round(max(2.25,base*PRESETS[preset]['ritmo']),2)

def circulation(architecture):
    rooms={r['id']:Polygon(r['contorno']) for r in architecture['espacios']}; graph={x:set() for x in rooms}; entrance=None
    for wall in architecture['paredes']:
        dx,dy=wall['b'][0]-wall['a'][0],wall['b'][1]-wall['a'][1]; length=max(math.hypot(dx,dy),1e-9)
        for opening in wall['aberturas']:
            if opening['tipo']!='puerta':continue
            offset=opening['distancia']+opening['ancho']/2; midpoint=Point(wall['a'][0]+dx*offset/length,wall['a'][1]+dy*offset/length)
            touching=[identifier for identifier,poly in rooms.items() if poly.boundary.distance(midpoint)<.16]
            if len(touching)==1 and (opening['id']=='entrada' or entrance is None):entrance=touching[0]
            for left in touching:
                for right in touching:
                    if left!=right:graph[left].add(right)
    named=next((x for x in rooms if any(word in x.lower() for word in ('acceso','entrada','vestibulo'))),None)
    if named:entrance=named
    if entrance is None:entrance=min(rooms,key=lambda x:(rooms[x].centroid.y,rooms[x].centroid.x))
    return rooms,graph,entrance

def natural_order(architecture,selected):
    rooms,graph,start=circulation(architecture); selected=set(selected); ordered=[]; visited=set(); queue=deque([start])
    while queue:
        current=queue.popleft()
        if current in visited:continue
        visited.add(current)
        if current in selected:ordered.append(current)
        queue.extend(sorted(graph[current]-visited,key=lambda x:rooms[x].centroid.distance(rooms[current].centroid)))
    remaining=selected-set(ordered)
    while remaining:
        anchor=rooms[ordered[-1]].centroid if ordered else rooms[start].centroid
        chosen=min(remaining,key=lambda x:rooms[x].centroid.distance(anchor));ordered.append(chosen);remaining.remove(chosen)
    return ordered,start,graph

def preset_areas(bundle,preset):
    identifiers=[r['id'] for r in bundle['arquitectura']['espacios']]; group=PRESETS[preset]['areas']
    if group=='todas':return identifiers
    social={'social','sala','comedor','cocina','terraza'}
    return [x for x in identifiers if (room_kind(x) in social)==(group=='social')]

def _shot(bundle,room,index,preset):
    polygon=Polygon(room['contorno']); resolved,_=resolve(bundle); items=[x for x in resolved if x['espacio']==room['id']]
    subject=max(items,key=lambda x:x['dimensiones'][0]*x['dimensiones'][1]*x['dimensiones'][2],default=None)
    target=[subject['posicion'][0],subject['posicion'][1],min(1.25,subject['posicion'][2]+subject['dimensiones'][2]*.55)] if subject else [polygon.representative_point().x,polygon.representative_point().y,1.0]
    obstacles=[footprint(x).buffer(.08) for x in items if not subject or x['id']!=subject['id']]; inset=polygon.buffer(-.2); candidates=[]
    if not inset.is_empty:
        minx,miny,maxx,maxy=inset.bounds; x=minx
        while x<=maxx:
            y=miny
            while y<=maxy:
                point=Point(x,y)
                if inset.covers(point) and not any(o.covers(point) for o in obstacles):
                    distance=point.distance(Point(target[:2])); clearance=polygon.boundary.distance(point); candidates.append((-abs(distance-2.7)+clearance*.35,[x,y,1.45]))
                y+=.3
            x+=.3
    fallback=not candidates;base=max(candidates,key=lambda x:x[0])[1] if candidates else [polygon.representative_point().x,polygon.representative_point().y,1.45]
    kind=room_kind(room['id']); movements={'bano':'estatica','circulacion':'revelar_desde_puerta','cocina':'desplazamiento_lateral','comedor':'desplazamiento_lateral','dormitorio':'orbita_suave','social':'aproximacion','sala':'aproximacion','terraza':'desplazamiento_lateral'}
    movement=movements.get(kind,['aproximacion','desplazamiento_lateral','orbita_suave'][index%3]);dx,dy=target[0]-base[0],target[1]-base[1];length=max(math.hypot(dx,dy),.001);ux,uy=dx/length,dy/length;tx,ty=-uy,ux;amount=min(.55,max(.22,length*.16))
    variants={'estatica':(base,base),'aproximacion':([base[0]-ux*amount,base[1]-uy*amount,base[2]],[base[0]+ux*amount,base[1]+uy*amount,base[2]]),'desplazamiento_lateral':([base[0]-tx*amount,base[1]-ty*amount,base[2]],[base[0]+tx*amount,base[1]+ty*amount,base[2]]),'orbita_suave':([base[0]-tx*amount,base[1]-ty*amount,base[2]],[base[0]+tx*amount,base[1]+ty*amount,base[2]]),'revelar_desde_puerta':(base,[base[0]+ux*amount*.5,base[1]+uy*amount*.5,base[2]])}
    start,end=variants[movement]
    if not all(polygon.buffer(-.08).covers(Point(p[:2])) and not any(o.covers(Point(p[:2])) for o in obstacles) for p in (start,end)):start=end=base;movement='estatica';fallback=True
    lens=30 if kind in {'bano','circulacion'} else 32 if kind in {'dormitorio','cocina'} else 36
    return {'room':room['id'],'subject':subject['id'] if subject else None,'target':[round(x,3) for x in target],'points':[[round(x,3) for x in p] for p in (start,end)],'movement':movement,'lens':lens,'fallback':fallback,'score':round(7.5+min(1.5,len(candidates)/20),2)}

def propose_tour(bundle,areas=None,preset='visita_completa',order='natural'):
    if preset not in PRESETS:raise ValueError('Preset de recorrido inexistente.')
    available={r['id']:r for r in bundle['arquitectura']['espacios']}; areas=areas or preset_areas(bundle,preset); unknown=set(areas)-set(available)
    if unknown:raise ValueError('Áreas inexistentes: '+', '.join(sorted(unknown)))
    ordered,entrance,graph=natural_order(bundle['arquitectura'],areas); fps=bundle['proyecto']['produccion']['fps']; shots=[];tracks=[];report=[];cursor=0.0
    for index,identifier in enumerate(ordered):
        result=_shot(bundle,available[identifier],index,preset); duration=duration_for(identifier,preset); camera='auto_'+identifier; shot='toma_'+identifier
        shots.append({'id':shot,'inicio':cursor,'duracion':duration,'camara':camera,'transicion':'corte'}); times=(cursor,cursor+duration)
        tracks += [
          {'id':camera+':posicion','tipo':'camara','objetivo':camera,'propiedad':'posicion','claves':[_key(t,v,'ease_in_out',f'{camera}:posicion:{i}') for i,(t,v) in enumerate(zip(times,result['points']))]},
          {'id':camera+':objetivo','tipo':'camara','objetivo':camera,'propiedad':'objetivo','claves':[_key(t,result['target'],'hold',f'{camera}:objetivo:{i}') for i,t in enumerate(times)]},
          {'id':camera+':lente','tipo':'camara','objetivo':camera,'propiedad':'lente','claves':[_key(cursor,result['lens'],'hold',camera+':lente')]},
          {'id':camera+':apertura','tipo':'camara','objetivo':camera,'propiedad':'apertura','claves':[_key(cursor,7.1,'hold',camera+':apertura')]},
          {'id':camera+':exposicion','tipo':'camara','objetivo':camera,'propiedad':'exposicion','claves':[_key(cursor,bundle['presentacion']['exposicion'],'hold',camera+':exposicion')]},]
        report.append({'toma':shot,'area':identifier,'protagonista':result['subject'],'movimiento':result['movement'],'duracion':duration,'lente':result['lens'],'puntuacion':result['score'],'fallback':result['fallback']});cursor=round(cursor+duration,4)
    script={'schema':1,'fps':fps,'duracion':cursor,'semilla':bundle['proyecto'].get('realismo',{}).get('semilla',1842),'tomas':shots,'pistas':tracks,'marcadores':[]}
    diagnostics=[{'codigo':'RECORRIDO_FALLBACK','gravedad':'aviso','elemento':x['area'],'explicacion':'Se usó una cámara estática por falta de espacio libre.'} for x in report if x['fallback']]
    errors=validate_script(script,bundle); diagnostics.extend(errors)
    return {'guion':script,'preset':preset,'areas':ordered,'duracion':cursor,'entrada':entrance,'informe':report,'diagnosticos':diagnostics,'ok':not any(x['gravedad']=='error' for x in diagnostics)}
