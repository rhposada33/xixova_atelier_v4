"""Construcción reproducible del catálogo web multi-maqueta."""
from __future__ import annotations

import json
import os
import shutil
from html import escape
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

def build_building_inventory() -> list[dict]:
    """Carga el fixture temporal compartido por web, catálogo y seed SQL."""
    fixture = Path(__file__).resolve().parent / "data" / "escobar_inventory.json"
    units = json.loads(fixture.read_text(encoding="utf-8"))
    if not isinstance(units, list) or len(units) != 72:
        raise ValueError("El fixture de Escobar debe contener exactamente 72 unidades.")
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
        # El cliente se comparte en la raíz; no duplicarlo durante la exportación
        # ni incluirlo en el presupuesto de tamaño de cada proyecto.
        result = export_maquette(bundle, project_destination, profile, include_client=False)
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
    public_url = os.environ.get("ESCOBAR_PUBLIC_URL", "https://www.promoven.online").rstrip("/")
    social_image = f"{public_url}/social/escobar-residences.png"
    for unit in inventory:
        unit_url = f"{public_url}/unidades/{unit['code']}/"
        app_url = f"/demo?vista=edificio&unidad={unit['code']}"
        title = f"Unidade {unit['code']} · Escobar Residences"
        description = (
            f"{unit['privateAreaM2']} m², {unit['bedrooms']} dormitórios, andar {unit['floor']}. "
            "Conheça esta unidade e explore sua tipologia ilustrativa em 3D."
        )
        page = f'''<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>{escape(title)}</title>
<meta name="description" content="{escape(description)}"/><link rel="canonical" href="{escape(unit_url)}"/>
<link rel="icon" type="image/svg+xml" href="../../favicon.svg"/><meta property="og:type" content="website"/>
<meta property="og:locale" content="pt_BR"/><meta property="og:site_name" content="Escobar Residences"/>
<meta property="og:title" content="{escape(title)}"/><meta property="og:description" content="{escape(description)}"/>
<meta property="og:url" content="{escape(unit_url)}"/><meta property="og:image" content="{escape(social_image)}"/>
<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="Vista 3D do Escobar Residences"/><meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{escape(title)}"/><meta name="twitter:description" content="{escape(description)}"/>
<meta name="twitter:image" content="{escape(social_image)}"/><meta http-equiv="refresh" content="0;url={escape(app_url)}"/>
<script>location.replace({json.dumps(app_url)})</script></head><body><p>Abrindo a <a href="{escape(app_url)}">Unidade {unit['code']}</a>…</p></body></html>'''
        unit_dir = staging / "unidades" / unit["code"]
        unit_dir.mkdir(parents=True, exist_ok=True)
        (unit_dir / "index.html").write_text(page, encoding="utf-8")
    manifest = {"schema": 1, "defaultProject": public_projects[0]["id"], "defaultView": "building", "building": {"organizationSlug": "escobar", "projectSlug": "escobar-residences", "defaultUnitCode": "1203", "model": "building/xixova-building.glb", "inventory": "building/inventory.json", "visualModes": ["neutral_day", "warm_dusk"], "statistics": "building/asset-statistics.json", "residentialFloors": 18, "units": 72, "provisional": True}, "projects": public_projects}
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
