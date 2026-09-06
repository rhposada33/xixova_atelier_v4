"""Valida y publica capturas de Blender sin modificar la arquitectura."""
import copy
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import uuid

import yaml
from .core import contract, diagnostic, load, resolve, validate


def near(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isfinite(a) and math.isfinite(b) and abs(a-b) <= 1e-5
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(near(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(near(x, y) for x, y in zip(a, b))
    return a == b


def prepare(bundle, capture):
    errors = []
    if capture.get('schema') != 1:
        return None, [diagnostic('SINC_CONTRATO', 'captura', 'Versión de captura desconocida.')]
    if capture.get('fuentes') != bundle['sincronizacion']:
        return None, [diagnostic('SINC_CONFLICTO', 'proyecto', 'Los archivos cambiaron desde la construcción, o la captura pertenece a otro proyecto/variante. Reconstruye antes de reintentar.')]
    base, current = capture['base'], capture['actual']
    expected_fields = {'protegido', 'elementos', 'materiales', 'luces', 'tomas', 'exposicion', 'entorno'}
    if set(base) != expected_fields or set(current) != expected_fields:
        return None, [diagnostic('SINC_CONTRATO', 'captura', 'Estado incompleto o con campos desconocidos.')]
    if base['protegido'] != current['protegido']:
        return None, [diagnostic('SINC_NO_REPRESENTABLE', 'escena', 'Cambió arquitectura, geometría interna, jerarquía, asignación de materiales u otra propiedad no representable. No se escribieron datos.')]
    for name in ('elementos', 'materiales', 'luces', 'tomas'):
        if base[name].keys() != current[name].keys():
            errors.append(diagnostic('SINC_IDENTIDAD', name, 'Elementos añadidos, eliminados o sin identidad estable.'))
    expected_ids = {'elementos': {x['id'] for x in bundle['interiorismo']['elementos']},
                    'materiales': set(bundle['interiorismo']['materiales']),
                    'luces': {x['id'] for x in bundle['presentacion']['luces']},
                    'tomas': {x['id'] for x in bundle['presentacion']['tomas']}}
    for name, ids in expected_ids.items():
        # Unused simple materials are intentionally absent from Blender's snapshot.
        if name == 'materiales':
            valid = set(current[name]).issubset(ids)
        else:
            valid = set(current[name]) == ids
        if not valid:
            errors.append(diagnostic('SINC_IDENTIDAD', name, 'La captura no corresponde al contrato del proyecto.'))
    if errors:
        return None, errors
    proposed = copy.deepcopy(bundle)
    changes = []
    def changed(group, id, old, new):
        if near(old, new):
            return False
        changes.append(dict(capa=group, elemento=id, antes=old, despues=new))
        return True
    # Process all placements, including dependents, so preserving an unchanged
    # visual pose cannot accidentally move an anchored child on reconstruction.
    items = {x['id']: x for x in proposed['interiorismo']['elementos']}
    for id, item in items.items():
        state = current['elementos'][id]
        if changed('interiorismo', id, base['elementos'][id], state):
            item['colocacion'] = dict(tipo='explicita', posicion=state['posicion'], rotacion=state['rotacion'])
            item['escala'] = state['escala']
    resolved, issues = resolve(proposed)
    errors += issues
    for item in resolved:
        desired = current['elementos'][item['id']]
        actual = dict(posicion=item['posicion'], rotacion=item['rotacion'], escala=item.get('escala', 1))
        # Rotations differing by a whole turn are equivalent.
        actual['rotacion'] = (actual['rotacion']+180) % 360-180
        target = {**desired, 'rotacion': (desired['rotacion']+180) % 360-180}
        if not near(actual, target):
            source = items[item['id']]
            before = copy.deepcopy(source['colocacion'])
            source['colocacion'] = dict(tipo='explicita', posicion=desired['posicion'], rotacion=desired['rotacion'])
            source['escala'] = desired['escala']
            changes.append(dict(capa='interiorismo', elemento=item['id'], antes=before,
                                despues=source['colocacion'], motivo='Conservar la posición visual al cambiar un ancla.'))
    for id, value in current['materiales'].items():
        if changed('materiales', id, base['materiales'][id], value):
            proposed['interiorismo']['materiales'][id] = value
    for light in proposed['presentacion']['luces']:
        id = light['id']
        if changed('presentacion', id, base['luces'][id], current['luces'][id]):
            light.update(current['luces'][id])
    for shot in proposed['presentacion']['tomas']:
        id = shot['id']
        if changed('presentacion', id, base['tomas'][id], current['tomas'][id]):
            if len(current['tomas'][id]['puntos']) != shot['fotogramas']:
                errors.append(diagnostic('SINC_CONTRATO', id, 'Se requiere una muestra por fotograma.'))
            shot.update(current['tomas'][id])
    for name in ('entorno', 'exposicion'):
        if changed('presentacion', name, base[name], current[name]):
            proposed['presentacion'][name] = current[name]
    for kind in ('interiorismo', 'presentacion'):
        errors += contract(proposed[kind], kind)
    if not errors:
        errors += validate(proposed)
    if errors:
        return None, errors
    return dict(bundle=proposed, cambios=changes), []


def synchronize(path, variant, capture, apply=False):
    """Publicación transaccional: YAML inmutables + reemplazo final del manifiesto.

    Un fallo previo al replace puede dejar archivos huérfanos, pero nunca una
    mezcla de documentos activos. Se bloquea el proyecto y se vuelven a leer
    todos sus archivos antes de publicar.
    """
    path = Path(path).resolve()
    bundle, errors = load(path, variant)
    if bundle is None:
        return dict(ok=False, diagnosticos=errors)
    plan, errors = prepare(bundle, capture)
    if errors:
        return dict(ok=False, diagnosticos=errors)
    report = dict(ok=True, aplicado=False, cambios=plan['cambios'], diagnosticos=[])
    if not apply or not plan['cambios']:
        return report
    with (path.parent/'.sincronizacion.lock').open('a') as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return dict(ok=False, diagnosticos=[diagnostic('SINC_OCUPADO', 'proyecto', 'Otra sincronización está publicando cambios.')])
        latest, errors = load(path, variant)
        if latest is None or latest['sincronizacion'] != bundle['sincronizacion']:
            return dict(ok=False, diagnosticos=[diagnostic('SINC_CONFLICTO', 'proyecto', 'Los archivos cambiaron durante la sincronización.')])
        selected = bundle['sincronizacion']['variante']
        revision = Path('sincronizados')/uuid.uuid4().hex
        directory = path.parent/revision
        directory.mkdir(parents=True)
        manifest = copy.deepcopy(bundle['proyecto'])
        for kind in ('interiorismo', 'presentacion'):
            target = directory/(kind+'.yaml')
            with target.open('w', encoding='utf-8') as output:
                output.write(yaml.safe_dump(plan['bundle'][kind], sort_keys=False, allow_unicode=True))
                output.flush()
                os.fsync(output.fileno())
        manifest['variantes'][selected] = str(revision/'interiorismo.yaml')
        manifest.setdefault('presentaciones', {})[selected] = str(revision/'presentacion.yaml')
        (directory/'cambios.json').write_text(json.dumps(report, indent=2, ensure_ascii=False)+'\n')
        (directory/'proyecto_anterior.yaml').write_bytes(path.read_bytes())
        # Recheck even noncooperating editors immediately before publication.
        for filename, checksum in bundle['sincronizacion']['archivos'].items():
            if hashlib.sha256(Path(filename).read_bytes()).hexdigest() != checksum:
                return dict(ok=False, diagnosticos=[diagnostic('SINC_CONFLICTO', filename, 'Archivo modificado antes de publicar.')])
        temporary = path.with_name('.'+path.name+'.'+uuid.uuid4().hex+'.tmp')
        try:
            with temporary.open('w', encoding='utf-8') as output:
                output.write(yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True))
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
        report.update(aplicado=True, revision=str(directory),
                      siguiente='Ejecuta componer para reconstruir. La revisión visual anterior no se reutiliza.')
        return report
