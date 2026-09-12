"""Construcción reproducible del catálogo web multi-maqueta."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import yaml

from .core import load
from .maquette import export as export_maquette, serve


DEFAULT_CATALOG = {
    "schema": 1,
    "projects": [
        {"id": "garden_house_18", "name": "Garden House", "project": "proyectos/garden_house_18/proyecto.yaml", "variant": "lujo_contemporaneo", "floors": [6, 8, 10], "units": ["01", "04"]},
        {"id": "terraza_luz", "name": "Terraza Luz", "project": "proyectos/terraza_luz/proyecto.yaml", "variant": "editorial_jardin", "floors": [6, 8, 10], "units": ["01", "04"]},
    ],
}

BUILDING_RESERVED = {"401", "704", "902", "1201", "1504", "1702"}
BUILDING_SOLD = {"101", "104", "202", "203", "301", "304", "502", "603", "801", "1004", "1302", "1603"}
BUILDING_TYPES = (
    {"bedrooms": 3, "suites": 2, "parkingSpaces": 2, "privateAreaM2": 118, "orientation": "northeast", "viewType": "garden", "base": 1040000, "interiorProjectId": "garden_house_18"},
    {"bedrooms": 2, "suites": 1, "parkingSpaces": 1, "privateAreaM2": 82, "orientation": "northwest", "viewType": "city", "base": 740000, "interiorProjectId": "terraza_luz"},
    {"bedrooms": 3, "suites": 2, "parkingSpaces": 2, "privateAreaM2": 96, "orientation": "southeast", "viewType": "sea", "base": 920000, "interiorProjectId": "terraza_luz"},
    {"bedrooms": 4, "suites": 3, "parkingSpaces": 3, "privateAreaM2": 146, "orientation": "southwest", "viewType": "garden", "base": 1220000, "interiorProjectId": "garden_house_18"},
)


def build_building_inventory() -> list[dict]:
    """Inventario de demostración determinista, compartible fuera de React."""
    units = []
    for floor in range(1, 19):
        for final, typology in enumerate(BUILDING_TYPES, 1):
            code = str(floor * 100 + final)
            area = typology["privateAreaM2"] + (8 if floor > 16 else 0)
            status = "reserved" if code in BUILDING_RESERVED else "sold" if code in BUILDING_SOLD else "available"
            price = typology["base"] + floor * 35000 + (120000 if typology["viewType"] == "sea" else 0) + (150000 if floor > 16 else 0)
            units.append({"id": f"unit-{code}", "code": code, "projectId": "garden_house_18", "buildingId": "garden-house-tower", "towerId": "A", "floor": floor, "status": status, **{key: value for key, value in typology.items() if key != "base"}, "totalAreaM2": round(area * 1.22), "privateAreaM2": area, "priceBRL": price, "modelObjectId": f"UNIT_{code}_PROXY", "published": True, "updatedAt": "2026-09-12T00:00:00Z"})
    return units


def load_catalog_config(filename: Path | None, root: Path) -> dict:
    value = yaml.safe_load(filename.read_text(encoding="utf-8")) if filename else DEFAULT_CATALOG
    if value.get("schema") != 1 or not value.get("projects"):
        raise ValueError("El catálogo debe usar schema 1 y declarar projects.")
    ids = [item.get("id") for item in value["projects"]]
    if any(not item for item in ids) or len(ids) != len(set(ids)):
        raise ValueError("Cada proyecto del catálogo necesita un id único.")
    return value


def export_catalog(destination: Path, config_file: Path | None = None, profile: str = "premium") -> dict:
    root = Path(__file__).resolve().parents[1]
    destination = destination.resolve()
    config = load_catalog_config(config_file.resolve() if config_file else None, root)
    web_dist = root / "xixova" / "maquette_web" / "dist"
    if not (web_dist / "index.html").is_file():
        raise ValueError("Compila xixova/maquette_web antes de exportar el catálogo.")

    staging = destination.with_name(destination.name + ".tmp")
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    for child in web_dist.iterdir():
        target = staging / child.name
        shutil.copytree(child, target) if child.is_dir() else shutil.copy2(child, target)

    public_projects = []
    for declared in config["projects"]:
        project_file = (root / declared["project"]).resolve()
        bundle, errors = load(project_file, declared["variant"])
        if bundle is None or errors:
            explanations = "; ".join(x.get("explicacion", str(x)) for x in errors)
            raise ValueError(f"{declared['id']}: {explanations}")
        project_destination = staging / "projects" / declared["id"]
        result = export_maquette(bundle, project_destination, profile)
        # Cada proyecto sólo necesita datos; el cliente se comparte en la raíz.
        shutil.rmtree(project_destination / "assets", ignore_errors=True)
        shutil.rmtree(project_destination / "building", ignore_errors=True)
        (project_destination / "index.html").unlink(missing_ok=True)
        public_projects.append({
            "id": declared["id"], "name": declared["name"], "variant": declared["variant"],
            "floors": declared.get("floors", [8]), "units": declared.get("units", ["04"]),
            "scene": f"projects/{declared['id']}/data/scene.json",
            "manifest": f"projects/{declared['id']}/manifest.json",
            "thumbnail": f"projects/{declared['id']}/data/miniatura.svg",
            "bytes": result["bytes"],
        })
    building_dir = staging / "building"
    building_dir.mkdir(exist_ok=True)
    inventory = build_building_inventory()
    (building_dir / "inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {"schema": 1, "defaultProject": public_projects[0]["id"], "defaultView": "building", "building": {"model": "building/xixova-building.glb", "inventory": "building/inventory.json", "visualModes": ["neutral_day", "warm_dusk"], "statistics": "building/asset-statistics.json", "residentialFloors": 18, "units": 72, "provisional": True}, "projects": public_projects}
    (staging / "catalog.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # `vercel --cwd <destino>` guarda aquí el vínculo del proyecto. Es estado
    # local, no un artefacto de la publicación, y debe sobrevivir al reemplazo
    # atómico para que los siguientes despliegues manuales no pidan relink.
    vercel_link = destination / ".vercel"
    if vercel_link.is_dir():
        shutil.copytree(vercel_link, staging / ".vercel")
    if destination.exists():
        shutil.rmtree(destination)
    staging.replace(destination)
    return {"ok": True, "salida": str(destination), "proyectos": len(public_projects), "catalogo": str(destination / "catalog.json")}


__all__ = ["build_building_inventory", "export_catalog", "load_catalog_config", "serve"]
