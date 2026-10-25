from pathlib import Path

from xixova.catalog import load_catalog_config
from xixova.demo_buildings import validate_demo_buildings
from xixova.core import load
from xixova.maquette import build_payload


ROOT = Path(__file__).resolve().parents[2]


def test_catalog_has_two_unique_projects():
    catalog = load_catalog_config(ROOT / "catalogo.yaml", ROOT)
    assert [project["id"] for project in catalog["projects"]] == ["garden_house_18", "terraza_luz"]


def test_demo_buildings_assets_and_inventory_match():
    registry = validate_demo_buildings(ROOT)
    assert [building["id"] for building in registry["buildings"]] == ["escobar", "jequitiba", "canto-do-forte"]


def test_garden_house_contract_matches_source_plan():
    bundle, errors = load(ROOT / "proyectos/garden_house_18/proyecto.yaml", "lujo_contemporaneo")
    assert not errors
    payload = build_payload(bundle)
    assert len(payload["espacios"]) == 20
    points = [point for room in payload["espacios"] for point in room["contorno"]]
    assert max(point[0] for point in points) - min(point[0] for point in points) == 18
    assert max(point[1] for point in points) - min(point[1] for point in points) == 13
    terraces = [room for room in payload["espacios"] if room["id"].startswith("terraza_")]
    assert terraces and any(2.4 in {
        round(max(p[0] for p in room["contorno"])-min(p[0] for p in room["contorno"]), 2),
        round(max(p[1] for p in room["contorno"])-min(p[1] for p in room["contorno"]), 2),
    } for room in terraces)


def test_demo_rejects_missing_or_modified_environment(monkeypatch):
    import copy
    import pytest
    import xixova.demo_buildings as demo

    original = demo.load_demo_buildings()
    for environment, message in [
        ({"url": "building/canto-assets/missing.png", "sha256": "0" * 64}, "falta el entorno"),
        ({"url": "building/canto-assets/coastal-panorama.png", "sha256": "0" * 64}, "SHA-256 incorrecto para el entorno"),
    ]:
        registry = copy.deepcopy(original)
        registry["buildings"][-1]["environment"] = environment
        monkeypatch.setattr(demo, "load_demo_buildings", lambda: registry)
        with pytest.raises(ValueError, match=message):
            demo.validate_demo_buildings(ROOT)
