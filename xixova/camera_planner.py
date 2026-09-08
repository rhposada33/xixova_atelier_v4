"""Convierte un guion visual compacto en tomas numéricas reproducibles."""
import math
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

from .core import contract, diagnostic, footprint, resolve, solid_volumes


def _clamp(value, low, high):
    return max(low, min(high, value))


def _clear(point, room, obstacles, margin=.18):
    p = Point(point[:2])
    return room.buffer(-margin).covers(p) and not any(poly.buffer(.08).covers(p) for poly in obstacles)


def _visible(point, target, obstacles, ignored):
    ray = LineString([point[:2], target[:2]])
    return not any(identifier not in ignored and ray.crosses(poly.buffer(.03)) for identifier, poly in obstacles)


def _subject(scene, placements, room):
    chosen = [placements[x] for x in scene['mostrar'] if x in placements]
    if not chosen:
        return None
    weights = [max(.05, x['dimensiones'][0] * x['dimensiones'][1]) for x in chosen]
    total = sum(weights)
    x = sum(item['posicion'][0] * weight for item, weight in zip(chosen, weights)) / total
    y = sum(item['posicion'][1] * weight for item, weight in zip(chosen, weights)) / total
    z = sum((item['posicion'][2] + item['dimensiones'][2] * .55) * weight for item, weight in zip(chosen, weights)) / total
    return [x, y, _clamp(z, .65, 1.35)], chosen


def _candidates(room, target, height, obstacles, ignored, direction=None, preferred_front=None, target_room=None):
    minx, miny, maxx, maxy = room.bounds
    candidates = []
    step = .35
    x = minx + .2
    while x <= maxx - .2:
        y = miny + .2
        while y <= maxy - .2:
            p = [x, y, height]
            if _clear(p, room, [poly for _, poly in obstacles]) and _visible(p, target, obstacles, ignored):
                distance = math.dist(p[:2], target[:2])
                clearance = room.boundary.distance(Point(x, y))
                score = -abs(distance - 3.0) + min(clearance, 1.2) * .7
                directional = {'norte': (y-miny)/(maxy-miny), 'sur': (maxy-y)/(maxy-miny),
                               'este': (x-minx)/(maxx-minx), 'oeste': (maxx-x)/(maxx-minx)}
                if direction: score += directional[direction] * 4
                if preferred_front and distance>.01:
                    view=((x-target[0])/distance,(y-target[1])/distance)
                    score += (view[0]*preferred_front[0]+view[1]*preferred_front[1])*2.5
                if target_room is not None and not target_room.covers(Point(x,y)): score += 20
                candidates.append((score, p))
            y += step
        x += step
    return [p for _, p in sorted(candidates, reverse=True)]


def _access_candidates(architecture, target_room, building, target, height, obstacles, ignored):
    """Prolonga la visual protagonista-puerta hacia la estancia contigua."""
    result=[]
    for wall in architecture['paredes']:
        dx,dy=wall['b'][0]-wall['a'][0],wall['b'][1]-wall['a'][1]; length=math.hypot(dx,dy)
        if length<=0: continue
        for opening in wall['aberturas']:
            if opening['tipo']!='puerta': continue
            offset=opening['distancia']+opening['ancho']/2
            midpoint=[wall['a'][0]+dx*offset/length,wall['a'][1]+dy*offset/length]
            if target_room.boundary.distance(Point(midpoint))>.08: continue
            vx,vy=midpoint[0]-target[0],midpoint[1]-target[1]; distance=max(math.hypot(vx,vy),.001); ux,uy=vx/distance,vy/distance
            for extension in (1.8,1.4,1.05,.75,.45):
                point=[midpoint[0]+ux*extension,midpoint[1]+uy*extension,height]
                if not target_room.buffer(.02).covers(Point(point[:2])) and _clear(point,building,[p for _,p in obstacles]) and _visible(point,target,obstacles,ignored):
                    result.append(point)
    return result


def _path(kind, base, target, room, obstacles, ignored):
    dx, dy = target[0] - base[0], target[1] - base[1]
    length = max(math.hypot(dx, dy), .001)
    ux, uy = dx / length, dy / length
    tx, ty = -uy, ux
    amount = _clamp(length * .22, .35, .85)
    def point(radial=0, lateral=0):
        return [base[0] + ux * radial + tx * lateral, base[1] + uy * radial + ty * lateral, base[2]]
    if kind == 'estatica': raw = [base, base]
    elif kind == 'aproximacion': raw = [point(-amount), point(amount)]
    elif kind == 'retroceso': raw = [point(amount), point(-amount)]
    elif kind == 'desplazamiento_lateral': raw = [point(0, -amount), point(0, amount)]
    elif kind == 'orbita_suave':
        angle = math.radians(14); vx, vy = base[0]-target[0], base[1]-target[1]
        raw = [[target[0]+vx*math.cos(a)-vy*math.sin(a), target[1]+vx*math.sin(a)+vy*math.cos(a), base[2]] for a in (-angle, angle)]
    else:  # revelar_desde_puerta: parte junto al límite y avanza hacia el sujeto.
        boundary = room.boundary.interpolate(room.boundary.project(Point(base[:2])))
        start = [boundary.x + ux*.3, boundary.y + uy*.3, base[2]]
        raw = [start, point(amount*.35)]
    samples = []
    for left, right in zip(raw, raw[1:]):
        samples += [[left[j] + (right[j]-left[j])*step/20 for j in range(3)] for step in range(21)]
    if all(_clear(p, room, [poly for _, poly in obstacles]) and _visible(p, target, obstacles, ignored) for p in samples):
        return raw
    return None


def plan_cameras(bundle, script):
    """Devuelve (tomas, informe, diagnósticos), sin modificar documentos."""
    issues = contract(script, 'guion_camara')
    if issues: return [], [], issues
    rooms = {x['id']: Polygon(x['contorno']) for x in bundle['arquitectura']['espacios']}
    building = unary_union(list(rooms.values()))
    resolved, placement_issues = resolve(bundle)
    if placement_issues: return [], [], placement_issues
    placements = {x['id']: x for x in resolved}
    assets = {x['id']:x for x in bundle['catalogo']['activos']}
    obstacles = [(x['id'], footprint(x)) for x in resolved]
    obstacles += [(identifier, polygon) for identifier, polygon, _, _ in solid_volumes(bundle['arquitectura'])]
    fps = bundle['proyecto']['produccion']['fps']
    requested = [x.get('duracion') for x in script['escenas']]
    fixed = sum(x for x in requested if x is not None)
    missing = sum(x is None for x in requested)
    remainder = max(0.25 * missing, script['duracion_segundos'] - fixed)
    default_duration = remainder / missing if missing else 0
    shots, report = [], []
    for index, scene in enumerate(script['escenas'], 1):
        room = rooms.get(scene['espacio'])
        if room is None:
            issues.append(diagnostic('REFERENCIA', scene.get('id', str(index)), 'Espacio de la toma inexistente.')); continue
        missing_subjects = [x for x in scene['mostrar'] if x not in placements]
        if missing_subjects:
            issues.append(diagnostic('REFERENCIA', scene.get('id', str(index)), 'Elementos inexistentes: '+', '.join(missing_subjects))); continue
        result = _subject(scene, placements, room)
        target, chosen = result
        ignored = set(scene['mostrar'])
        door_walls=set()
        if scene.get('desde')=='acceso':
            for wall in bundle['arquitectura']['paredes']:
                if any(opening['tipo']=='puerta' for opening in wall['aberturas']):
                    line=LineString([wall['a'],wall['b']])
                    if room.boundary.distance(line)<.08: door_walls.add(wall['id'])
        camera_ignored=ignored|door_walls
        front=[]
        for item in chosen:
            angle=math.radians(item['rotacion']); front.append((-math.sin(angle),math.cos(angle)))
        preferred=(sum(x[0] for x in front)/len(front),sum(x[1] for x in front)/len(front))
        through_access=scene.get('desde')=='acceso'; search_area=building if through_access else room
        candidates = _candidates(search_area, target, script.get('altura', 1.55), obstacles, camera_ignored,
                                 None if through_access else scene.get('desde'),preferred,room if through_access else None)
        if through_access:
            access=_access_candidates(bundle['arquitectura'],room,building,target,script.get('altura',1.55),obstacles,camera_ignored)
            candidates=access+candidates
        if not candidates:
            issues.append(diagnostic('CAMARA_SIN_SOLUCION', scene.get('id', str(index)), 'No hay posición visible y libre en la estancia.')); continue
        requested_kind = scene['movimiento']; points = None
        for candidate in candidates:
            points = _path(requested_kind, candidate, target, search_area, obstacles, camera_ignored)
            if points is not None: break
        effective = requested_kind
        if points is None:
            points = [candidates[0], candidates[0]]; effective = 'estatica'
        duration = scene.get('duracion', default_duration)
        distance=math.dist(points[0][:2],target[:2]); width=max(x['dimensiones'][0] for x in chosen)
        framing=assets[chosen[0]['activo']].get('ocupacion_encuadre',{'minima':.25,'maxima':.65}); desired=(framing['minima']+framing['maxima'])/2
        lens = scene.get('lente', _clamp(desired*36*distance/max(width,.2), 28, 40))
        shot_id = scene.get('id', f"{scene['espacio']}_{index:02d}")
        shots.append({'id':shot_id, 'lente':round(lens, 1), 'fotogramas':max(2, round(duration*fps)),
                      'interpolacion':'suave', 'sensor_mm':36, 'apertura_f':7.1, 'foco':scene['mostrar'][0],
                      'puntos':[{'posicion':[round(v,3) for v in p], 'objetivo':[round(v,3) for v in target]} for p in points]})
        if 'exposicion' in scene: shots[-1]['exposicion']=scene['exposicion']
        report.append({'toma':shot_id, 'espacio':scene['espacio'], 'movimiento_solicitado':requested_kind,
                       'movimiento_resuelto':effective, 'duracion':round(duration,3), 'lente':round(lens,1),
                       'protagonistas':scene['mostrar'], 'candidatos_validos':len(candidates)})
    return shots, report, issues
