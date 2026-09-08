"""Carga, resolución espacial y diagnósticos; no importa Blender."""
import copy
import hashlib
import json
import math
import os
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator
from shapely.geometry import LineString, Point, Polygon
from shapely import affinity

ROOT = Path(__file__).resolve().parent

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def read(path):
    return yaml.safe_load(Path(path).read_text(encoding='utf-8'))

def diagnostic(code, element, explanation, severity='error'):
    return dict(codigo=code, gravedad=severity, elemento=element, explicacion=explanation)

def contract(data, kind):
    schema = json.loads((ROOT / 'schemas' / f'{kind}.json').read_text())
    invalid = []
    def finite(value, path=''):
        if isinstance(value, float) and not math.isfinite(value): invalid.append(diagnostic('CONTRATO', path, 'Número no finito.'))
        elif isinstance(value, dict):
            for key, child in value.items(): finite(child, path+'/'+str(key))
        elif isinstance(value, list):
            for key, child in enumerate(value): finite(child, path+'/'+str(key))
    finite(data)
    return invalid + [diagnostic('CONTRATO', '/'.join(map(str, e.absolute_path)), e.message)
            for e in sorted(Draft202012Validator(schema).iter_errors(data), key=lambda e: str(e.path))]

def load(path, variant=None):
    path = Path(path).resolve()
    p = read(path)
    errors = contract(p, 'proyecto')
    if errors:
        return None, errors
    base = path.parent
    a = read(base / p['arquitectura'])
    i = read(base / p['variantes'][variant or next(iter(p['variantes']))])
    selected = variant or next(iter(p['variantes']))
    presentation_path = p.get('presentaciones', {}).get(selected, p['presentacion'])
    s = read(base / presentation_path)
    c = read(base / p['produccion']['catalogo'])
    for obj, kind in [(a, 'arquitectura'), (i, 'interiorismo'), (s, 'presentacion'), (c, 'catalogo')]:
        errors += contract(obj, kind)
    if errors:
        return None, errors
    for asset in c['activos']:
        asset['archivo'] = str((base / os.path.expanduser(os.path.expandvars(asset['archivo']))).resolve())
    for spec in i['materiales'].values():
        for key, filename in spec.get('mapas', {}).items():
            spec['mapas'][key] = str((base / os.path.expanduser(os.path.expandvars(filename))).resolve())
    if s['entorno'].get('archivo'):
        s['entorno']['archivo'] = str((base / os.path.expanduser(os.path.expandvars(s['entorno']['archivo']))).resolve())
    bundle = dict(proyecto=p, arquitectura=a, interiorismo=i, presentacion=s, catalogo=c,
                  archivo=str(path), arquitectura_hash=digest(a))
    paths = [path, base / p['arquitectura'], base / p['variantes'][selected],
             base / presentation_path, base / p['produccion']['catalogo']]
    bundle['sincronizacion'] = dict(proyecto=str(path), variante=selected,
        archivos={str(f.resolve()): hashlib.sha256(f.read_bytes()).hexdigest() for f in paths})
    return bundle, validate(bundle)

def wall_polygon(w):
    return LineString([w['a'], w['b']]).buffer(w['espesor']/2, cap_style=2)

def footprint(item):
    w, d, _ = item['dimensiones']
    poly = Polygon([(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)])
    poly = affinity.rotate(poly, item['rotacion'], origin=(0,0))
    return affinity.translate(poly, *item['posicion'][:2])

def resolve(bundle):
    a, interior = bundle['arquitectura'], bundle['interiorismo']
    rooms = {r['id']: Polygon(r['contorno']) for r in a['espacios']}
    walls = {w['id']: w for w in a['paredes']}
    assets = {v['id']: v for v in bundle['catalogo']['activos']}
    pending = copy.deepcopy(interior['elementos']); resolved = {}; errors = []
    while pending:
        progress = False
        for item in pending[:]:
            asset = assets.get(item['activo'])
            if asset is None or item['espacio'] not in rooms:
                errors.append(diagnostic('REFERENCIA', item['id'], 'Activo o espacio inexistente.'))
                pending.remove(item); progress = True; continue
            item['dimensiones'] = [x * item.get('escala', 1) for x in asset['dimensiones']]
            place = item['colocacion']; mode = place['tipo']; angle = place.get('rotacion', 0)
            if mode == 'explicita':
                pos = place['posicion']
            elif mode == 'espacio':
                center = rooms[item['espacio']].centroid
                delta = place.get('desplazamiento', [0,0,0])
                pos = [center.x+delta[0], center.y+delta[1], delta[2]]
            elif mode == 'objeto':
                other = resolved.get(place['referencia'])
                if other is None:
                    continue
                dx,dy,dz = place['desplazamiento']; theta = math.radians(other['rotacion'])
                pos = [other['posicion'][0]+dx*math.cos(theta)-dy*math.sin(theta),
                       other['posicion'][1]+dx*math.sin(theta)+dy*math.cos(theta),other['posicion'][2]+dz]
                angle += other['rotacion']
            else:
                w = walls.get(place['referencia'])
                if w is None:
                    errors.append(diagnostic('REFERENCIA', item['id'], 'Pared inexistente.'))
                    pending.remove(item); progress = True; continue
                dx,dy = w['b'][0]-w['a'][0],w['b'][1]-w['a'][1]; length = math.hypot(dx,dy)
                if length == 0:
                    errors.append(diagnostic('PARED_INVALIDA', w['id'], 'Longitud nula.')); pending.remove(item); progress = True; continue
                side = place['lado']; t = place['distancia']; gap = place['separacion']
                normal = w['espesor']/2+item['dimensiones'][1]/2+gap
                pos = [w['a'][0]+dx*t/length-side*dy*normal/length,
                       w['a'][1]+dy*t/length+side*dx*normal/length,0]
                angle = math.degrees(math.atan2(dy,dx))+(180 if side == -1 else 0)
            item['posicion'] = pos; item['rotacion'] = angle
            item['holgura'] = asset['holgura']; resolved[item['id']] = item
            pending.remove(item); progress = True
        if not progress:
            errors += [diagnostic('ANCLA_NO_RESUELTA', x['id'], 'Referencia a objeto ausente o ciclo de anclajes.') for x in pending]
            break
    return list(resolved.values()), errors

def camera_frames(presentation):
    for shot in presentation['tomas']:
        keys = shot['puntos']; count = shot['fotogramas']
        for frame in range(count):
            t = frame/(count-1)*(len(keys)-1); idx = min(int(t), len(keys)-2); f = t-idx
            if shot.get('interpolacion') == 'suave': f = f*f*(3-2*f)
            def lerp(field): return [keys[idx][field][j]*(1-f)+keys[idx+1][field][j]*f for j in range(3)]
            yield shot['id'], frame+1, lerp('posicion'), lerp('objetivo')

def solid_walls(a):
    """Tramos verticales sólidos, incluyendo dinteles y antepechos."""
    for w in a['paredes']:
        length = math.dist(w['a'], w['b']); cursor = 0
        for op in sorted(w['aberturas'], key=lambda o:o['distancia']):
            if op['distancia'] > cursor: yield w, cursor, op['distancia'], 0, w['altura']
            if op['antepecho'] > 0: yield w, op['distancia'], op['distancia']+op['ancho'], 0, op['antepecho']
            if op['antepecho']+op['alto'] < w['altura']: yield w, op['distancia'], op['distancia']+op['ancho'], op['antepecho']+op['alto'], w['altura']
            cursor = op['distancia']+op['ancho']
        if cursor < length: yield w, cursor, length, 0, w['altura']

def solid_volumes(a):
    for w, start, end, bottom, top in solid_walls(a):
        length = math.dist(w['a'],w['b'])
        if length == 0: continue
        points = [[w['a'][j]+(w['b'][j]-w['a'][j])*v/length for j in range(2)] for v in (start,end)]
        yield w['id'], LineString(points).buffer(w['espesor']/2, cap_style=2), bottom, top
    for p in a['pilares']:
        yield p['id'], Polygon(p['contorno']), 0, p['altura']

def validate(b):
    errors = []; a = b['arquitectura']; i = b['interiorismo']
    groups = [a['espacios'], a['paredes'], a['pilares'], a['instalaciones'],
              [op for w in a['paredes'] for op in w['aberturas']]]
    ids = [x['id'] for group in groups for x in group]
    if len(ids) != len(set(ids)): errors.append(diagnostic('ID_DUPLICADO', a['id'], 'IDs arquitectónicos repetidos.'))
    for group in (i['elementos'], b['catalogo']['activos'], b['presentacion']['tomas']):
        values = [x['id'] for x in group]
        if len(values) != len(set(values)): errors.append(diagnostic('ID_DUPLICADO', a['id'], 'IDs repetidos en elementos, catálogo o tomas.'))
    if i['arquitectura'] != {'id':a['id'],'version':a['version'],'hash':b['arquitectura_hash']}:
        errors.append(diagnostic('ARQUITECTURA_CAMBIADA', i['id'], 'La propuesta debe revisarse y vincularse al hash actual de arquitectura.'))
    rooms = {}
    for r in a['espacios']+a['pilares']:
        poly = Polygon(r['contorno'])
        if not poly.is_valid or poly.area <= 0: errors.append(diagnostic('CONTORNO_INVALIDO',r['id'],'Polígono degenerado o autointersectado.'))
        else: rooms[r['id']] = poly
    for idx, left in enumerate(a['espacios']):
        for right in a['espacios'][idx+1:]:
            if left['id'] in rooms and right['id'] in rooms and rooms[left['id']].intersection(rooms[right['id']]).area > .0001:
                errors.append(diagnostic('ESPACIOS_SUPERPUESTOS', left['id'], 'Solapamiento con '+right['id']))
    for w in a['paredes']:
        length = math.dist(w['a'], w['b']); end = 0
        if length <= 0: errors.append(diagnostic('PARED_INVALIDA',w['id'],'Longitud nula.'))
        for op in sorted(w['aberturas'], key=lambda o:o['distancia']):
            if op['distancia'] < end-1e-7 or op['distancia']+op['ancho'] > length+1e-7 or op['antepecho']+op['alto'] > w['altura']+1e-7:
                errors.append(diagnostic('ABERTURA_INVALIDA',op['id'],'Abertura fuera de pared o superpuesta.'))
            end = op['distancia']+op['ancho']
    surfaces = {f"{r['id']}:{s}" for r in a['espacios'] for s in ('piso','techo')} | {w['id'] for w in a['paredes']} | {p['id'] for p in a['pilares']}
    mats = i['materiales']
    for surface, material in i['acabados'].items():
        if surface not in surfaces or material not in mats: errors.append(diagnostic('REFERENCIA',surface,'Superficie o material inexistente.'))
    for material, spec in mats.items():
        for role, filename in spec.get('mapas', {}).items():
            if not Path(filename).is_file(): errors.append(diagnostic('RECURSO_AUSENTE',material,f'Mapa {role}: {filename}'))
    environment = b['presentacion']['entorno'].get('archivo')
    if environment and not Path(environment).is_file(): errors.append(diagnostic('RECURSO_AUSENTE','entorno',environment))
    assets = {v['id']:v for v in b['catalogo']['activos']}
    for item in i['elementos']:
        if item.get('material') and item['material'] not in mats: errors.append(diagnostic('REFERENCIA',item['id'],'Material inexistente.'))
        asset = assets.get(item['activo'])
        if asset and not Path(asset['archivo']).is_file(): errors.append(diagnostic('RECURSO_AUSENTE',item['id'],asset['archivo']))
        if asset and asset['licencia'] not in b['proyecto']['produccion']['licencias_permitidas']: errors.append(diagnostic('LICENCIA',item['id'],'Licencia no admitida.'))
    if errors: return errors
    placements, issues = resolve(b); errors += issues
    solids = list(solid_volumes(a))
    for item in placements:
        poly = footprint(item); z = item['posicion'][2]; top = z+item['dimensiones'][2]
        room = next(r for r in a['espacios'] if r['id']==item['espacio'])
        if not rooms[item['espacio']].buffer(.001).covers(poly) or z < 0 or top > room['altura']:
            errors.append(diagnostic('FUERA_ESPACIO',item['id'],'El volumen no cabe en la estancia.'))
        for sid, solid, bottom, ceiling in solids:
            if min(top,ceiling)-max(z,bottom) > .001 and poly.intersection(solid).area > .0001:
                errors.append(diagnostic('INTERSECCION_ARQUITECTURA',item['id'],f'Intersección con {sid}.'))
        for w in a['paredes']:
            length = math.dist(w['a'],w['b'])
            for op in w['aberturas']:
                if op['tipo'] != 'puerta': continue
                points = [[w['a'][j]+(w['b'][j]-w['a'][j])*v/length for j in range(2)] for v in (op['distancia'],op['distancia']+op['ancho'])]
                # Reserva aproximada para aproximarse y abrir la hoja. El búfer
                # anterior usaba el ancho completo a ambos lados y bloqueaba
                # muebles situados a más de un metro de la puerta.
                clearance = LineString(points).buffer(min(op['ancho']*.55, .55), cap_style=2)
                if poly.intersection(clearance).area > .0001 and z < op['alto']:
                    errors.append(diagnostic('PUERTA_BLOQUEADA',item['id'],f'Invade espacio de maniobra conservador de {op["id"]}.'))
    for idx, left in enumerate(placements):
        for right in placements[idx+1:]:
            overlap_z = min(left['posicion'][2]+left['dimensiones'][2],right['posicion'][2]+right['dimensiones'][2])-max(left['posicion'][2],right['posicion'][2])
            gap = max(left['holgura'], right['holgura'])
            if overlap_z > .001 and footprint(left).buffer(gap).intersection(footprint(right)).area > .0001:
                errors.append(diagnostic('INTERSECCION_MUEBLES',left['id'],f'Intersección o falta de separación con {right["id"]}.'))
    for shot, frame, pos, target in camera_frames(b['presentacion']):
        hit = []
        if math.dist(pos,target)<.001: hit.append('objetivo coincidente')
        if not any(rooms[r['id']].covers(Point(pos[:2])) and .05<pos[2]<r['altura']-.05 for r in a['espacios']): hit.append('fuera del volumen habitable')
        for sid, poly, bottom, top in solids:
            if bottom-.05 < pos[2] < top+.05 and poly.buffer(.05).covers(Point(pos[:2])): hit.append(sid)
        for item in placements:
            if item['posicion'][2]-.05 < pos[2] < item['posicion'][2]+item['dimensiones'][2]+.05 and footprint(item).buffer(.05).covers(Point(pos[:2])): hit.append(item['id'])
        if hit: errors.append(diagnostic('CAMARA_OBSTRUIDA',shot,f'Fotograma {frame}: {", ".join(hit)}.'))
    return errors
