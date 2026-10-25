"""Validation and export metadata for the multi-building demo."""
from __future__ import annotations

import hashlib
import json
import re
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "xixova" / "data" / "demo_buildings.json"
PUBLIC_STATUSES = {"available", "reserved", "sold"}


def load_demo_buildings() -> dict:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    if registry.get("schema") != 1 or not registry.get("buildings"):
        raise ValueError("El registro de edificios debe usar schema 1 y contener edificios.")
    ids = [item.get("id") for item in registry["buildings"]]
    if len(ids) != len(set(ids)) or registry.get("defaultBuilding") not in ids:
        raise ValueError("IDs de edificio duplicados o edificio predeterminado desconocido.")
    projects = [(item.get("organizationSlug"), item.get("projectSlug")) for item in registry["buildings"]]
    if len(projects) != len(set(projects)):
        raise ValueError("Dos edificios comparten el mismo proyecto de inventario.")
    return registry


def _glb_proxy_names(path: Path) -> list[str]:
    with path.open("rb") as handle:
        header = handle.read(20)
        if len(header) != 20 or header[:4] != b"glTF" or struct.unpack_from("<I", header, 4)[0] != 2:
            raise ValueError(f"GLB inválido: {path}")
        json_length, chunk_type = struct.unpack_from("<II", header, 12)
        if chunk_type != 0x4E4F534A:
            raise ValueError(f"Falta el bloque JSON del GLB: {path}")
        document = json.loads(handle.read(json_length))
    return [node.get("name", "") for node in document.get("nodes", []) if node.get("name", "").startswith("UNIT_")]


def validate_demo_buildings(root: Path = ROOT) -> dict:
    registry = load_demo_buildings()
    all_unit_ids: set[str] = set()
    for building in registry["buildings"]:
        label = building["id"]
        if not re.fullmatch(r"[a-z][a-z0-9_-]*", label):
            raise ValueError(f"ID de edificio inválido: {label}")
        if building.get("inventoryFormat") not in {"legacy", "property-units"} or building.get("inventoryProvider") not in {"static", "supabase"}:
            raise ValueError(f"{label}: formato o proveedor de inventario inválido")
        if building.get("visualExperience") not in {"v2", "standard", "coastal"}:
            raise ValueError(f"{label}: perfil visual desconocido")
        environment = building.get("environment")
        if building.get("visualExperience") == "coastal" and not environment:
            raise ValueError(f"{label}: falta el entorno costero")
        if environment:
            url = environment.get("url", "")
            if not re.fullmatch(r"building/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+\.(png|jpg|webp)", url):
                raise ValueError(f"{label}: ruta de entorno inválida")
            path = root / "xixova" / "maquette_web" / "public" / url
            if not path.is_file():
                raise ValueError(f"{label}: falta el entorno {path}")
            if hashlib.sha256(path.read_bytes()).hexdigest() != environment.get("sha256"):
                raise ValueError(f"{label}: SHA-256 incorrecto para el entorno {path}")
        inventory_file = root / "xixova" / "data" / building["inventory"]
        if not inventory_file.is_file():
            raise ValueError(f"{label}: falta inventario {inventory_file}")
        inventory = json.loads(inventory_file.read_text(encoding="utf-8"))
        visible = [unit for unit in inventory if unit.get("published") and unit.get("status") in PUBLIC_STATUSES]
        if len(visible) != building["floors"] * building["unitsPerFloor"]:
            raise ValueError(f"{label}: cantidad de unidades distinta de pisos × unidades por piso")
        if any(sum(unit["floor"] == floor for unit in visible) != building["unitsPerFloor"] for floor in range(1, building["floors"] + 1)):
            raise ValueError(f"{label}: distribución de unidades por piso inválida")
        codes = [unit["code"] for unit in visible]
        expected = [unit["modelObjectId"] for unit in visible]
        if len(codes) != len(set(codes)) or len(expected) != len(set(expected)) or building["defaultUnitCode"] not in codes:
            raise ValueError(f"{label}: códigos, proxies o unidad inicial inválidos")
        for unit in visible:
            if unit["modelObjectId"] != f"UNIT_{unit['code']}_PROXY" or int(unit["code"]) // 100 != unit["floor"]:
                raise ValueError(f"{label}: código, piso y proxy no coinciden: {unit['code']}")
        unit_ids = {unit["id"] for unit in visible}
        if unit_ids & all_unit_ids or len(unit_ids) != len(visible):
            raise ValueError(f"{label}: IDs de unidad duplicados o reutilizados")
        all_unit_ids.update(unit_ids)
        for level, model in building["models"].items():
            url = model["url"]
            if not re.fullmatch(r"building/[a-zA-Z0-9_-]+\.glb", url):
                raise ValueError(f"{label}/{level}: ruta de GLB inválida")
            path = root / "xixova" / "maquette_web" / "public" / url
            if not path.is_file():
                raise ValueError(f"{label}/{level}: falta el modelo {path}")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != model["sha256"]:
                raise ValueError(f"{label}/{level}: SHA-256 incorrecto para {path}")
            names = _glb_proxy_names(path)
            if len(names) != len(set(names)) or set(names) != set(expected):
                missing = sorted(set(expected) - set(names))[:5]
                extra = sorted(set(names) - set(expected))[:5]
                raise ValueError(f"{label}/{level}: proxies no coinciden; faltan {missing}; sobran {extra}")
    return registry
