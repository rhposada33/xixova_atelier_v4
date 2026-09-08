"""Biblioteca curada local para activos reutilizables de Xixova."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
from datetime import date
from pathlib import Path

import yaml

SCHEMA = 1
STATES = {"candidato", "aceptado", "publicado", "rechazado"}
LICENSES = {"CC0", "Royalty Free"}
TIERS = {"proxy", "standard", "hero"}
CATEGORY_QUOTAS = {
    "asientos": 14, "mesas": 10, "dormitorio_almacenamiento": 12,
    "cocina_comedor": 10, "bano": 8, "luminarias": 10,
    "textiles_decoracion": 10, "plantas": 6, "materiales_pbr": 14, "hdri": 6,
}


def digest_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def default_root() -> Path:
    return Path(os.environ.get("XIXOVA_BIBLIOTECA", "biblioteca")).expanduser().resolve()


def init_library(root: Path) -> dict:
    root = root.resolve()
    for name in ("originales", "candidatos", "publicados", "rechazados", "previas", "solicitudes"):
        (root / name).mkdir(parents=True, exist_ok=True)
    manifest = root / "catalogo_biblioteca.yaml"
    if not manifest.exists():
        write_yaml(manifest, {"schema": SCHEMA, "identidad": "lujo_editorial_calido", "activos": []})
    return load_manifest(root)


def write_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
    os.replace(temp, path)


def load_manifest(root: Path) -> dict:
    path = root / "catalogo_biblioteca.yaml"
    if not path.exists():
        raise ValueError(f"Biblioteca no inicializada: {root}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("schema") != SCHEMA or not isinstance(data.get("activos"), list):
        raise ValueError("Manifiesto de biblioteca inválido.")
    return data


def compact_candidate(raw: dict) -> dict:
    provider_id = str(raw.get("provider_id") or raw.get("assetBaseId") or raw.get("id") or "").strip()
    if not provider_id:
        raise ValueError("El candidato no contiene identificador de BlenderKit.")
    license_name = str(raw.get("licencia") or raw.get("license") or "").strip()
    license_name = {"royalty_free":"Royalty Free", "cc_zero":"CC0", "cc0":"CC0"}.get(license_name.lower(), license_name)
    return {
        "provider": "blenderkit", "provider_id": provider_id,
        "nombre": str(raw.get("nombre") or raw.get("name") or provider_id),
        "url": str(raw.get("url") or f"https://www.blenderkit.com/asset-gallery-detail/{provider_id}/"),
        "autor": str(raw.get("autor") or raw.get("author") or "desconocido"),
        "licencia": license_name, "categoria": str(raw.get("categoria") or "sin_clasificar"),
        "tags": list(raw.get("tags") or []), "quality_publica": raw.get("quality_publica") or raw.get("score"),
        "estado": "candidato", "fecha_descarga": None, "archivos": {}, "auditoria": {},
    }


def add_candidates(root: Path, candidates: list[dict]) -> dict:
    data = init_library(root)
    by_id = {x["provider_id"]: x for x in data["activos"]}
    added = 0
    for raw in candidates:
        item = compact_candidate(raw)
        if item["provider_id"] not in by_id:
            data["activos"].append(item); by_id[item["provider_id"]] = item; added += 1
    write_yaml(root / "catalogo_biblioteca.yaml", data)
    return {"ok": True, "agregados": added, "total": len(data["activos"])}


def request_search(root: Path, *, query: str, category: str, limit: int, max_width: float | None = None) -> Path:
    init_library(root)
    request = {"schema": 1, "proveedor": "blenderkit", "consulta": query,
               "categoria": category, "limite": limit, "estilo": "luxury editorial warm",
               "ancho_max_m": max_width}
    key = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()[:12]
    target = root / "solicitudes" / f"buscar_{key}.yaml"
    write_yaml(target, request)
    return target


def find_asset(data: dict, provider_id: str) -> dict:
    try:
        return next(x for x in data["activos"] if x["provider_id"] == provider_id)
    except StopIteration:
        raise ValueError(f"Activo inexistente: {provider_id}") from None


def set_state(root: Path, provider_id: str, state: str, reason: str | None = None) -> dict:
    if state not in STATES:
        raise ValueError(f"Estado inválido: {state}")
    data = load_manifest(root); item = find_asset(data, provider_id)
    item["estado"] = state
    if reason: item["motivo"] = reason
    if state == "rechazado":
        write_yaml(root / "rechazados" / f"{provider_id}.yaml", {"provider_id": provider_id, "motivo": reason or "sin especificar"})
    write_yaml(root / "catalogo_biblioteca.yaml", data)
    return item


def register_download(root: Path, provider_id: str, source: Path) -> dict:
    data = load_manifest(root); item = find_asset(data, provider_id)
    if not source.is_file(): raise ValueError(f"Archivo descargado inexistente: {source}")
    suffix = source.suffix.lower() or ".blend"
    target = root / "originales" / provider_id / ("original" + suffix)
    target.parent.mkdir(parents=True, exist_ok=True)
    source_hash = digest_file(source)
    if not target.exists() or digest_file(target) != source_hash:
        shutil.copy2(source, target)
    item["fecha_descarga"] = date.today().isoformat()
    item["archivos"]["original"] = {"ruta": str(target), "sha256": source_hash}
    write_yaml(root / "catalogo_biblioteca.yaml", data)
    return item


def audit_asset(item: dict, root: Path) -> list[dict]:
    issues = []
    def issue(code, message, severity="error"): issues.append({"codigo": code, "gravedad": severity, "elemento": item.get("provider_id"), "explicacion": message})
    if item.get("licencia") not in LICENSES: issue("LICENCIA", "Licencia ausente o no admitida.")
    if not item.get("autor") or item.get("autor") == "desconocido": issue("AUTOR", "Autor no identificado.")
    original = item.get("archivos", {}).get("original", {})
    path = Path(original.get("ruta", ""))
    if not path.is_file(): issue("ARCHIVO", "Falta el original local.")
    elif digest_file(path) != original.get("sha256"): issue("HASH", "El original cambió desde su registro.")
    audit = item.get("auditoria", {})
    for field, code in (("escala_valida", "ESCALA"), ("uv_validado", "UV"), ("normales_validas", "NORMALES"), ("texturas_completas", "TEXTURAS"), ("cycles_compatible", "CYCLES")):
        if audit.get(field) is not True: issue(code, f"Control pendiente o fallido: {field}.")
    if audit.get("puntuacion_materiales", 0) < 8: issue("MATERIALES", "Puntuación de materiales inferior a 8.")
    if audit.get("puntuacion_geometria", 0) < 8: issue("GEOMETRIA", "Puntuación de geometría inferior a 8.")
    if audit.get("memoria_standard_mb", float("inf")) > 1536: issue("MEMORIA", "La versión standard supera 1,5 GB.")
    if item.get("estado") == "publicado" and not all(t in item.get("niveles", {}) for t in TIERS):
        issue("NIVELES", "Faltan proxy, standard o hero.")
    return issues


def audit_library(root: Path) -> dict:
    data = load_manifest(root); diagnostics = []
    seen = set()
    for item in data["activos"]:
        if item["provider_id"] in seen:
            diagnostics.append({"codigo":"DUPLICADO","gravedad":"error","elemento":item["provider_id"],"explicacion":"ID duplicado."})
        seen.add(item["provider_id"])
        if item.get("estado") in {"aceptado", "publicado"}: diagnostics.extend(audit_asset(item, root))
    counts = {key: sum(x.get("categoria") == key and x.get("estado") == "publicado" for x in data["activos"]) for key in CATEGORY_QUOTAS}
    return {"ok": not any(x["gravedad"] == "error" for x in diagnostics), "completo": all(counts[k] >= v for k,v in CATEGORY_QUOTAS.items()),
            "total": len(data["activos"]), "publicados": sum(x.get("estado") == "publicado" for x in data["activos"]),
            "cupos": counts, "objetivo": CATEGORY_QUOTAS, "diagnosticos": diagnostics}


def public_catalog_entry(item: dict) -> dict:
    level = item["niveles"]["standard"]
    return {"id": item.get("id") or f"bk_{item['provider_id'].replace('-', '_')}", "archivo": level["ruta"],
            "coleccion": level.get("coleccion", "XIXOVA_ASSET"), "categoria": item["categoria"],
            "dimensiones": item["dimensiones"], "origen": "CENTER_XY_BASE_Z", "frente": "+Y",
            "apoyo": item.get("apoyo", "suelo"), "holgura": item.get("holgura", .04),
            "licencia": item["licencia"], "autor": item["autor"], "sha256": level["sha256"],
            "niveles": item["niveles"], "memoria_estimada_mb": item["auditoria"]["memoria_standard_mb"],
            "puntuacion_materiales": item["auditoria"]["puntuacion_materiales"],
            "puntuacion_geometria": item["auditoria"]["puntuacion_geometria"]}


def rebuild_public_catalog(root: Path, data: dict | None = None) -> Path:
    data = data or load_manifest(root)
    entries = [public_catalog_entry(item) for item in data["activos"] if item.get("estado") == "publicado"]
    target = root / "catalogo_xixova.yaml"
    write_yaml(target, {"schema": 1, "activos": entries})
    return target
