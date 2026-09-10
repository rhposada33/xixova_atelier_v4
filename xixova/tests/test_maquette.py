import copy
import json
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from xixova.core import load
from xixova.director_server import create_app
from xixova.maquette import audit, build_payload, export

ROOT = Path(__file__).resolve().parents[2]


def garden():
    bundle, errors = load(ROOT / "proyectos/garden_house/proyecto.yaml", "lujo_contemporaneo")
    assert not errors
    return bundle


def test_payload_preserves_coordinates_and_uses_safe_proxies():
    bundle = garden(); payload = build_payload(bundle)
    assert payload["arquitectura_hash"] == bundle["arquitectura_hash"]
    assert len(payload["espacios"]) == len(bundle["arquitectura"]["espacios"])
    assert all(item["nivel_web"] in {"procedural_proxy", "optimizado_propio"} for item in payload["elementos"])
    assert all(item["nivel_web"] == "procedural_proxy" for item in payload["elementos"] if item["licencia"] not in {"propia", "CC0"})
    assert not any("archivo" in item for item in payload["elementos"])
    assert payload["solar"]["enabled"]
    assert payload["solar"]["calibrationStatus"] == "demo_unverified"
    assert all(room["solarSamples"] for room in payload["espacios"])


def test_solar_audit_rejects_unknown_timezone():
    bundle = copy.deepcopy(garden())
    bundle["presentacion"]["maqueta"]["solar"]["location"]["timezone"] = "Mars/Olympus"
    report = audit(bundle)
    assert not report["ok"]
    assert any(x["codigo"] == "MAQUETA_SOLAR_ZONA" for x in report["diagnosticos"])


def test_unknown_license_blocks_publication():
    bundle = garden(); bundle = copy.deepcopy(bundle)
    used = bundle["interiorismo"]["elementos"][0]["activo"]
    next(x for x in bundle["catalogo"]["activos"] if x["id"] == used)["licencia"] = "desconocida"
    report = audit(bundle)
    assert not report["ok"]
    assert any(x["codigo"] == "MAQUETA_LICENCIA" for x in report["diagnosticos"])


def test_static_export_is_self_contained_and_does_not_change_source(monkeypatch):
    monkeypatch.setenv("XIXOVA_MAQUETA_SIN_BLENDER", "1")
    bundle = garden(); before = bundle["arquitectura_hash"]
    with tempfile.TemporaryDirectory() as directory:
        result = export(bundle, directory); root = Path(directory)
        assert result["ok"] and (root / "index.html").is_file()
        assert (root / "data/scene.glb").is_file()
        scene = json.loads((root / "data/scene.json").read_text())
        assert scene["arquitectura_hash"] == before == bundle["arquitectura_hash"]
        assert ".blend" not in (root / "data/scene.json").read_text()


def test_director_exposes_maquette_manifest_and_export(monkeypatch):
    monkeypatch.setenv("XIXOVA_MAQUETA_SIN_BLENDER", "1")
    client = TestClient(create_app(ROOT / "proyectos/garden_house/proyecto.yaml", "lujo_contemporaneo"))
    manifest = client.get("/api/maqueta/manifest")
    assert manifest.status_code == 200 and manifest.json()["auditoria"]["ok"]
    exported = client.post("/api/maqueta/export", json={})
    assert exported.status_code == 200 and exported.json()["estado"] == "completo"
    job = client.get("/api/maqueta/status/" + exported.json()["id"])
    assert job.status_code == 200 and job.json()["progreso"] == 1
