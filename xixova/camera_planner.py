"""Convierte un guion visual compacto en tomas numéricas reproducibles."""
import math
from shapely.geometry import LineString, Point, Polygon

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


def _candidates(room, target, height, obstacles, ignored, direction=None):
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
                candidates.append((score, p))
            y += step
        x += step
    return [p for _, p in sorted(candidates, reverse=True)]


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
    resolved, placement_issues = resolve(bundle)
    if placement_issues: return [], [], placement_issues
    placements = {x['id']: x for x in resolved}
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
        candidates = _candidates(room, target, script.get('altura', 1.55), obstacles, ignored, scene.get('desde'))
        if not candidates:
            issues.append(diagnostic('CAMARA_SIN_SOLUCION', scene.get('id', str(index)), 'No hay posición visible y libre en la estancia.')); continue
        requested_kind = scene['movimiento']; points = None
        for candidate in candidates:
            points = _path(requested_kind, candidate, target, room, obstacles, ignored)
            if points is not None: break
        effective = requested_kind
        if points is None:
            points = [candidates[0], candidates[0]]; effective = 'estatica'
        duration = scene.get('duracion', default_duration)
        lens = scene.get('lente', _clamp(22 + math.dist(points[0][:2], target[:2]) * 2, 24, 35))
        shot_id = scene.get('id', f"{scene['espacio']}_{index:02d}")
        shots.append({'id':shot_id, 'lente':round(lens, 1), 'fotogramas':max(2, round(duration*fps)),
                      'interpolacion':'suave', 'puntos':[{'posicion':[round(v,3) for v in p], 'objetivo':[round(v,3) for v in target]} for p in points]})
        report.append({'toma':shot_id, 'espacio':scene['espacio'], 'movimiento_solicitado':requested_kind,
                       'movimiento_resuelto':effective, 'duracion':round(duration,3), 'lente':round(lens,1),
                       'protagonistas':scene['mostrar'], 'candidatos_validos':len(candidates)})
    return shots, report, issues
