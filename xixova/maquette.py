"""Exporta una representación editorial y segura para el navegador."""
from __future__ import annotations

import json
import math
import copy
import os
import shutil
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .core import digest, resolve
from .director_glb import make_glb

KNOWN_LICENSES = {"propia", "CC0", "CC Attribution", "Royalty Free"}
DIRECT_LICENSES = {"propia", "CC0"}
DEFAULTS = {
    "perfil": "editorial_calido",
    "camara": "isometrica",
    "fondo": "cielo_suave",
    "techo_visible": False,
    "paredes": {"modo": "inteligentes", "transicion_ms": 220},
    "etiquetas": {"espacios": True, "superficies": True, "objetos": "seleccionables"},
    "interaccion": {"puertas": True, "filtros_espacios": True, "puntos_interes": True},
    "semilla": 1842,
    "solar": {"enabled": False},
    "calidad_web": {
        "perfil": "standard",
        "presupuesto_mb": 30,
        "carga_inicial_mb": 8,
        "nivel_inicial": "mobile",
        "nivel_objetivo": "standard",
        "lightmaps": False,
        "reflejos_entorno": True,
        "sombras_contacto": True,
        "vegetacion": "media",
    },
}


def _polygon_centroid(points):
    twice_area = 0.0; x = 0.0; y = 0.0
    for a, b in zip(points, points[1:] + points[:1]):
        cross = a[0] * b[1] - b[0] * a[1]
        twice_area += cross; x += (a[0] + b[0]) * cross; y += (a[1] + b[1]) * cross
    if abs(twice_area) < 1e-8:
        return [sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)]
    return [x / (3 * twice_area), y / (3 * twice_area)]


def _display_name(identifier):
    words = {"area": "Área", "servicio": "servicio", "circulacion": "Circulación",
             "bano": "Baño", "social": "social", "comedor": "comedor"}
    return " ".join(words.get(word, word.capitalize()) for word in identifier.split("_"))


def _polygon_area(points):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1]))) / 2


def _room_for(point, rooms):
    from shapely.geometry import Point, Polygon
    return next((room["id"] for room in rooms if Polygon(room["contorno"]).buffer(.01).contains(Point(point[:2]))), None)


def _solar_samples(contour, declared=None):
    """Muestras interiores reutilizables; nunca dependen del nombre del espacio."""
    if declared:
        return declared
    from shapely.geometry import Point, Polygon
    polygon = Polygon(contour)
    safe = polygon.buffer(-.25)
    if safe.is_empty:
        safe = polygon.buffer(-.05)
    candidates = [safe.representative_point(), polygon.centroid]
    minx, miny, maxx, maxy = safe.bounds
    step = max(.55, min(maxx-minx, maxy-miny) / 3)
    y = miny
    while y <= maxy:
        x = minx
        while x <= maxx:
            point = Point(x, y)
            if safe.covers(point): candidates.append(point)
            x += step
        y += step
    unique = []
    for point in candidates:
        xy = (round(point.x, 3), round(point.y, 3))
        if xy not in unique: unique.append(xy)
    return [[x, y, z] for x, y in unique[:12] for z in (.15, .8, 1.4)]


def config(bundle):
    value = json.loads(json.dumps(DEFAULTS))
    declared = bundle["presentacion"].get("maqueta", {})
    for key, child in declared.items():
        if isinstance(child, dict) and isinstance(value.get(key), dict): value[key].update(child)
        else: value[key] = child
    value["semilla"] = declared.get("semilla", bundle["proyecto"].get("realismo", {}).get("semilla", 1842))
    return value


def build_payload(bundle):
    elements, issues = resolve(bundle)
    if issues: raise ValueError("; ".join(x["explicacion"] for x in issues))
    assets = {x["id"]: x for x in bundle["catalogo"]["activos"]}
    rooms = []
    for room in bundle["arquitectura"]["espacios"]:
        center = _polygon_centroid(room["contorno"])
        rooms.append({**room, "centro": [round(center[0], 4), round(center[1], 4), .12],
                      "nombre": _display_name(room["id"]), "area_m2": round(_polygon_area(room["contorno"]), 2),
                      "solarSamples": _solar_samples(room["contorno"], room.get("muestras_solares"))})
    web_elements = []
    for item in elements:
        asset = assets[item["activo"]]; license_name = asset.get("licencia", "desconocida")
        # v1 deliberately never exposes catalog source meshes. Even direct-compatible
        # assets use a generated proxy until the optimized Blender exporter is audited.
        mode = "optimizado_propio" if license_name in DIRECT_LICENSES else "procedural_proxy"
        web_elements.append({
            "id": item["id"], "activo": item["activo"], "categoria": asset["categoria"],
            "espacio": item["espacio"], "posicion": item["posicion"], "rotacion": item["rotacion"],
            "dimensiones": item["dimensiones"], "licencia": license_name,
            "nivel_web": mode,
            "nombre": item["id"].replace("_", " ").title(),
            "acabado": next(iter(item.get("materiales_partes", {}).values()), item.get("material", "original")),
        })
    openings = []
    for wall in bundle["arquitectura"]["paredes"]:
        length = math.dist(wall["a"], wall["b"]); dx = (wall["b"][0]-wall["a"][0])/length; dy = (wall["b"][1]-wall["a"][1])/length
        for opening in wall["aberturas"]:
            middle = opening["distancia"] + opening["ancho"] / 2
            openings.append({**opening, "pared": wall["id"], "posicion": [wall["a"][0]+dx*middle, wall["a"][1]+dy*middle, opening["antepecho"]], "rotacion": math.degrees(math.atan2(dy, dx))})
    points = bundle["presentacion"].get("maqueta", {}).get("puntos_interes") or [
        {"id": "area_"+room["id"], "nombre": room["nombre"], "espacio": room["id"], "posicion": room["centro"]}
        for room in rooms
    ]
    walls = []
    for wall in bundle["arquitectura"]["paredes"]:
        length=math.dist(wall["a"],wall["b"]); dx=(wall["b"][0]-wall["a"][0])/length; dy=(wall["b"][1]-wall["a"][1])/length
        middle=[(wall["a"][0]+wall["b"][0])/2,(wall["a"][1]+wall["b"][1])/2]
        probes=[[middle[0]-dy*.2,middle[1]+dx*.2],[middle[0]+dy*.2,middle[1]-dx*.2]]
        sides=sum(_room_for(point,rooms) is not None for point in probes)
        walls.append({**wall,"exterior":sides<2})
    project = bundle["proyecto"]
    return {
        "schema": 1, "proyecto": project["id"], "nombre": project["id"].replace("_", " ").title(),
        "variante": bundle["interiorismo"]["id"], "arquitectura_hash": bundle["arquitectura_hash"],
        "configuracion": config(bundle), "espacios": rooms, "paredes": walls,
        "aberturas": openings, "elementos": web_elements, "puntos_interes": points,
        "luces": [{"id": x["id"], "posicion": x["posicion"], "potencia": x["potencia"],
                    "temperatura_k": x.get("temperatura_k", 3000)} for x in bundle["presentacion"].get("luces", [])],
        "activos_glb": False,
        "solar": config(bundle).get("solar", {"enabled": False}),
    }


def audit(bundle, payload=None, quality_visual=False):
    payload = payload or build_payload(bundle); problems = []; warnings = []
    solar = payload.get("solar", {})
    if solar.get("enabled"):
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        try:
            ZoneInfo(solar.get("location", {}).get("timezone", ""))
        except (ZoneInfoNotFoundError, ValueError):
            problems.append({"codigo": "MAQUETA_SOLAR_ZONA", "gravedad": "error", "elemento": "solar.location.timezone", "explicacion": "Zona horaria IANA desconocida."})
        if solar.get("calibrationStatus") == "demo_unverified":
            warnings.append({"codigo": "MAQUETA_SOLAR_DEMO", "gravedad": "aviso", "elemento": "solar", "explicacion": "Ubicación y norte de demostración; el resultado es una estimación por calibrar."})
        for room in payload["espacios"]:
            if not room.get("solarSamples"):
                problems.append({"codigo": "MAQUETA_SOLAR_MUESTRAS", "gravedad": "error", "elemento": room["id"], "explicacion": "La estancia no tiene muestras solares."})
    for item in payload["elementos"]:
        if item["licencia"] not in KNOWN_LICENSES:
            problems.append({"codigo": "MAQUETA_LICENCIA", "gravedad": "error", "elemento": item["id"], "explicacion": "Licencia desconocida; se bloquea la publicación."})
        elif item["licencia"] not in DIRECT_LICENSES:
            warnings.append({"codigo": "MAQUETA_PROXY_LICENCIA", "gravedad": "aviso", "elemento": item["id"], "explicacion": "Se publicará sólo el proxy procedural; la malla fuente queda fuera."})
    triangles = len(payload["paredes"]) * 12 + len(payload["elementos"]) * 180 + len(payload["espacios"]) * 8
    budget = 200_000
    if triangles > budget:
        problems.append({"codigo": "MAQUETA_POLIGONOS", "gravedad": "error", "elemento": "escena", "explicacion": f"{triangles} triángulos estimados superan el presupuesto móvil {budget}."})
    if quality_visual:
        generic = [x for x in payload["elementos"] if x["nivel_web"] == "procedural_proxy"]
        if generic:
            warnings.append({"codigo": "MAQUETA_PROXY_VISIBLE", "gravedad": "aviso", "elemento": "escena",
                             "explicacion": f"{len(generic)} elementos requieren proxy web por licencia o falta de activo exportable."})
    quality = payload["configuracion"].get("calidad_web", {})
    return {"schema": 2, "ok": not problems, "hash": digest(payload), "perfil_web": quality.get("perfil", "standard"),
            "metricas": {"triangulos_estimados": triangles, "limite_movil": budget, "activos": len(payload["elementos"]), "espacios": len(payload["espacios"])},
            "diagnosticos": problems + warnings}


def _profile(bundle, requested=None):
    quality = config(bundle)["calidad_web"]
    selected = requested or quality.get("perfil", "standard")
    if selected == "premium":
        quality.update({"perfil": "premium_editorial", "presupuesto_mb": 60, "carga_inicial_mb": 8,
                        "nivel_inicial": "mobile", "nivel_objetivo": "premium", "lightmaps": True,
                        "reflejos_entorno": True, "sombras_contacto": True, "vegetacion": "alta"})
    elif selected in {"mobile", "standard"}:
        quality["perfil"] = selected
        quality["nivel_objetivo"] = selected
    return quality


def _safe_glb(path):
    binary = path.read_bytes()
    # Bloquea rutas de la máquina y referencias al archivo fuente. Algunos JPG
    # CC0 conservan metadatos EXIF del autor con una ruta Windows pública; no es
    # una dependencia resoluble ni expone la estación que genera el paquete.
    if any(marker in binary for marker in (b'/home/', b'.blend', b'xixova_sync_base')):
        raise ValueError('El GLB contiene metadatos o rutas locales; publicación bloqueada.')


def bake(bundle, destination, profile=None):
    """Genera el contrato ambiental reutilizable por el visor híbrido.

    La oclusión de contacto se calcula en tiempo real; este archivo mantiene los
    tres estados ambientales continuos sin mezclar el color base de materiales.
    """
    destination = Path(destination).resolve(); data = destination / "data"; data.mkdir(parents=True, exist_ok=True)
    quality = _profile(bundle, profile)
    lighting = {"schema": 1, "metodo": "ambiente_pbr_mas_sol_dinamico", "lightmaps": bool(quality.get("lightmaps")),
                "estados": {"dia": {"exposicion": 1.0, "ambiente": 1.0, "temperatura_k": 6100},
                            "atardecer": {"exposicion": .9, "ambiente": .68, "temperatura_k": 4400},
                            "noche": {"exposicion": .52, "ambiente": .18, "temperatura_k": 3000}}}
    target = data / "lighting.json"; target.write_text(json.dumps(lighting, ensure_ascii=False, indent=2)+"\n")
    return {"ok": True, "archivo": str(target), "metodo": lighting["metodo"]}


def export(bundle, destination, profile=None):
    payload = build_payload(bundle); report = audit(bundle, payload)
    if not report["ok"]: raise ValueError("; ".join(x["explicacion"] for x in report["diagnosticos"] if x["gravedad"] == "error"))
    destination = Path(destination).resolve(); source = Path(__file__).parent / "maquette_web" / "dist"
    if not (source / "index.html").is_file(): raise ValueError("Compila xixova/maquette_web antes de exportar.")
    destination.mkdir(parents=True, exist_ok=True)
    # Hashed Vite bundles change name on every build. Remove only the generated
    # assets directory so an incremental export cannot retain obsolete clients.
    generated_assets = destination / "assets"
    if generated_assets.is_dir(): shutil.rmtree(generated_assets)
    for child in source.iterdir():
        target = destination / child.name
        if child.is_dir(): shutil.copytree(child, target, dirs_exist_ok=True)
        else: shutil.copy2(child, target)
    data = destination / "data"; data.mkdir(exist_ok=True)
    for stale in [*data.glob('assets-*.glb'), *data.glob('assets-*.json'), data/'assets.glb', data/'assets.json']:
        if stale.is_file(): stale.unlink()
    quality = _profile(bundle, profile); payload["configuracion"]["calidad_web"] = quality
    report["hash"] = digest(payload); report["perfil_web"] = quality.get("perfil", "standard")
    reports = {}; web_levels = {}
    if os.environ.get('XIXOVA_MAQUETA_SIN_BLENDER')!='1':
        from .cli import run_blender
        from .core import camera_frames
        scripts=Path(__file__).parent
        generator_hash=digest({name:(scripts/name).read_text() for name in ('blender_build.py','window_details.py')})
        cache_key=digest({'escena':report['hash'],'generador':generator_hash})[:20]
        cache=Path(bundle['archivo']).parent/'.maqueta'/'cache'/cache_key;cache.mkdir(parents=True,exist_ok=True)
        resolved,issues=resolve(bundle)
        if issues:raise ValueError('; '.join(x['explicacion'] for x in issues))
        compiled=copy.deepcopy(bundle);compiled['resueltos']=resolved;compiled['fotogramas']=[dict(toma=s,numero=f,posicion=p,objetivo=t) for s,f,p,t in camera_frames(compiled['presentacion'])]
        datafile=cache/'resuelto.json';datafile.write_text(json.dumps(compiled,ensure_ascii=False))
        scene=cache/'escena.blend'
        if not scene.is_file():run_blender(compiled,'blender_build.py',['--datos',datafile,'--salida',scene],log=cache/'construccion.log')
        target_level=quality.get('nivel_objetivo','standard');levels=['mobile']
        if target_level in {'standard','premium'}:levels.append('standard')
        if target_level=='premium':levels.append('premium')
        for level in levels:
            asset_glb=data/f'assets-{level}.glb'
            run_blender(compiled,'maquette_blender_export.py',['--datos',datafile,'--salida',asset_glb,'--nivel',level],scene,cache/f'exportacion_{level}.log')
            asset_report=json.loads(asset_glb.with_suffix('.json').read_text());reports[level]=asset_report
            if asset_glb.is_file():
                _safe_glb(asset_glb);web_levels[level]={"url":f"data/{asset_glb.name}","bytes":asset_glb.stat().st_size,"activos":asset_report['activos']}
        payload['activos_glb']=bool(web_levels);payload['web_assets']={"inicial":quality['nivel_inicial'],"objetivo":target_level,"niveles":web_levels,"proxies":reports.get(target_level,reports['mobile'])['proxies']}
        last=reports[target_level];report['metricas']['triangulos_estimados']=len(payload['paredes'])*12+round(last['caras_fuente']*last['ratio'])*2
        report['metricas']['caras_activos_fuente']=last['caras_fuente'];report['diagnosticos']+=last['diagnosticos']
        if any(x['gravedad']=='error' for x in last['diagnosticos']):raise ValueError('La exportación premium contiene materiales o texturas inválidos.')
        bake(bundle,destination,profile)
    (data / "scene.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    (data / "scene.glb").write_bytes(make_glb(payload))
    points=[p for room in payload["espacios"] for p in room["contorno"]]; xs=[p[0] for p in points]; ys=[p[1] for p in points]; lo,hi,bot,top=min(xs),max(xs),min(ys),max(ys)
    polygons=''.join(f'<polygon points="{" ".join(f"{(p[0]-lo)/(hi-lo)*560+20:.1f},{(top-p[1])/(top-bot)*360+20:.1f}" for p in room["contorno"])}"/>' for room in payload["espacios"])
    (data/"miniatura.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#e8e0d4"/><g fill="#ceb99c" stroke="#675d51" stroke-width="2">{polygons}</g></svg>')
    manifest = {"schema": 2, "proyecto": payload["proyecto"], "variante": payload["variante"], "hash": report["hash"], "escena": "data/scene.json", "glb": "data/scene.glb", "activos": payload.get("web_assets",{}), "iluminacion": "data/lighting.json" if (data/'lighting.json').is_file() else None, "miniatura": "data/miniatura.svg", "auditoria": "data/auditoria.json", "atribuciones": "data/atribuciones.json", "capacidades": ["paredes_inteligentes", "puertas", "espacios", "puntos_interes", "captura", "tour", "carga_progresiva", "materiales_pbr"] + (["estudio_solar"] if payload["solar"].get("enabled") else [])}
    (destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n")
    (data / "auditoria.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
    attributions = [{"activo": x["activo"], "licencia": x["licencia"]} for x in payload["elementos"] if x["licencia"] not in {"propia"}]
    (data / "atribuciones.json").write_text(json.dumps(attributions, ensure_ascii=False, indent=2)+"\n")
    size=sum(x.stat().st_size for x in destination.rglob("*") if x.is_file())
    limit=int(quality.get('presupuesto_mb',30))*1024*1024
    # La primera pintura contiene shell, contrato y proxies; cualquier LOD de
    # Blender se solicita después y pertenece a la fase "Preparando detalles".
    initial=sum(x.stat().st_size for x in destination.rglob('*') if x.is_file() and not x.name.startswith('assets-'))
    report['metricas'].update({'bytes_totales':size,'bytes_carga_inicial':initial,'limite_carga_inicial':int(quality.get('carga_inicial_mb',8))*1024*1024})
    if size>limit: raise ValueError(f"La publicación ocupa {size/1024/1024:.1f} MB y supera el límite de {limit/1024/1024:.0f} MB.")
    if initial>report['metricas']['limite_carga_inicial']:report['diagnosticos'].append({'codigo':'MAQUETA_CARGA_INICIAL','gravedad':'aviso','elemento':'paquete','explicacion':f'La carga inicial ocupa {initial/1024/1024:.1f} MB.'})
    (data / "auditoria.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n")
    return {**report, "salida": str(destination), "url": "index.html", "bytes": size, "limite_bytes": limit}


def serve(directory, host="127.0.0.1", port=8877):
    directory = Path(directory).resolve()
    if not (directory / "index.html").is_file(): raise ValueError("La salida no contiene index.html.")
    handler = lambda *args, **kwargs: SimpleHTTPRequestHandler(*args, directory=str(directory), **kwargs)
    ThreadingHTTPServer((host, port), handler).serve_forever()
