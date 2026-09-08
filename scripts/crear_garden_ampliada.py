#!/usr/bin/env python3
"""Genera los contratos del proyecto inferido desde el plano Tipo Garden Ampliada."""
from __future__ import annotations

import copy
import hashlib
import json
import shutil
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "proyectos" / "garden_ampliada"
SOURCE_CATALOG = ROOT / "cache" / "framework" / "activos" / "catalogo.json"


def save(name, value):
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / name).write_text(yaml.safe_dump(value, sort_keys=False, allow_unicode=True), encoding="utf-8")


def room(id, points, height=2.7, covered=True):
    return {"id": id, "contorno": points, "altura": height, "cubierto": covered}


def rect(id, x0, y0, x1, y1, height=2.7, covered=True):
    return room(id, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], height, covered)


def opening(id, kind, distance, width, height=2.15, sill=0):
    return {"id": id, "tipo": kind, "distancia": distance, "ancho": width,
            "alto": height, "antepecho": sill}


def wall(id, a, b, openings=(), height=2.7, thickness=.12):
    return {"id": id, "a": a, "b": b, "espesor": thickness, "altura": height,
            "aberturas": list(openings)}


def item(id, asset, space, position, rotation=0, scale=1):
    return {"id": id, "activo": asset, "espacio": space,
            "colocacion": {"tipo": "explicita", "posicion": position, "rotacion": rotation},
            "escala": scale}


def shot(id, lens, points):
    return {"id": id, "lente": lens, "fotogramas": 80,
            "puntos": [{"posicion": p, "objetivo": t} for p, t in points]}


def main():
    catalog = json.loads(SOURCE_CATALOG.read_text(encoding="utf-8"))
    for asset in catalog["activos"]:
        asset["archivo"] = str((ROOT / "cache" / "framework" / "activos" / (asset["id"] + ".blend")).resolve())
        if asset["id"] in {"sofa_recto", "comedor", "mesa_centro"}:
            asset["archivo"] = str((ROOT / "cache" / "framework" / "activos" / (asset["id"] + ".blend")).resolve())
    save("catalogo.yaml", catalog)

    architecture = {
        "schema": 1,
        "id": "garden_ampliada",
        "version": "0.1-borrador",
        "unidades": "m",
        "fuentes": [{"archivo": "plano_usuario_2026-09-06.png",
                     "descripcion": "Imagen de planta amueblada Tipo Garden Ampliada, sin cotas visibles."}],
        "cota_referencia": {"valor_m": 1.8,
                            "descripcion": "Escala provisional inferida de la cama principal de 1,80 m de ancho.",
                            "fiable": True},
        "dudas": [
            "Todas las medidas son inferidas de la imagen; necesitan una cota real antes de una entrega definitiva.",
            "Se simplificaron espesores, puertas y pequeños quiebres del perímetro.",
            "La zona superior izquierda se interpreta como jardín/terraza exterior descubierta.",
        ],
        "espacios": [
            room("suite_principal", [[4.55, 0], [7.55, 0], [7.55, 4.15], [3.35, 4.15], [3.35, 2.15], [4.55, 2.15]]),
            rect("bano_principal", 3.35, 0, 4.55, 2.15),
            room("suite_secundaria", [[7.55, 0], [8.75, 0], [8.75, 2.05], [10.05, 2.05], [10.05, 4.15], [7.55, 4.15]]),
            rect("bano_secundario", 8.75, 0, 10.05, 2.05),
            rect("circulacion", 4.55, 4.15, 8.55, 5.15),
            rect("sala", 3.35, 5.15, 7.55, 8.55),
            rect("comedor", 7.55, 5.15, 9.75, 8.55),
            rect("lavabo", 8.55, 4.15, 9.75, 5.15),
            rect("cocina", 6.35, 8.55, 9.75, 11.05),
            rect("bano_servicio", 4.55, 10.05, 6.35, 11.05),
            rect("garden_lateral", 0, 4.15, 3.35, 11.05, 3.5, False),
            rect("garden_superior", 0, 11.05, 6.35, 15.2, 3.5, False),
        ],
        "paredes": [
            wall("fachada_sur_master", [3.35, 0], [7.55, 0], [opening("ventana_master", "ventana", 1.2, 2.2, 1.5, .75)]),
            wall("fachada_sur_sec", [7.55, 0], [10.05, 0], [opening("ventana_sec", "ventana", .35, 1.45, 1.5, .75)]),
            wall("fachada_este", [10.05, 0], [10.05, 4.15]),
            wall("limite_este_social", [9.75, 4.15], [9.75, 11.05], [opening("ventana_comedor", "ventana", 2.25, 1.25, 1.45, .85)]),
            wall("norte_cocina", [6.35, 11.05], [9.75, 11.05], [opening("ventana_cocina", "ventana", 1.35, 1.0, 1.1, 1.15)]),
            wall("oeste_master", [3.35, 0], [3.35, 5.15], [opening("entrada_apto", "puerta", 3.75, .9)]),
            wall("oeste_sala", [3.35, 5.15], [3.35, 8.55], [opening("corredera_sala_garden", "puerta", .65, 2.0, 2.4)]),
            wall("oeste_servicio", [4.55, 8.55], [4.55, 11.05], [opening("salida_garden", "puerta", .55, .85)]),
            wall("sur_social", [3.35, 5.15], [9.75, 5.15], [opening("paso_master", "puerta", 3.35, .9), opening("paso_sec", "puerta", 4.85, .8)]),
            wall("division_suites", [7.55, 0], [7.55, 5.15], [opening("puerta_suite_sec", "puerta", 3.45, .8)]),
            wall("bano_master_vertical", [4.55, 0], [4.55, 2.15]),
            wall("bano_master_norte", [3.35, 2.15], [4.55, 2.15], [opening("puerta_bano_master", "puerta", .2, .8)]),
            wall("bano_sec_vertical", [8.75, 0], [8.75, 2.05]),
            wall("bano_sec_norte", [8.75, 2.05], [10.05, 2.05], [opening("puerta_bano_sec", "puerta", .25, .8)]),
            wall("sala_comedor", [7.55, 5.15], [7.55, 8.55]),
            wall("social_cocina", [3.35, 8.55], [9.75, 8.55], [opening("paso_cocina", "puerta", 3.0, 1.4, 2.45)]),
            wall("bano_servicio_sur", [4.55, 10.05], [6.35, 10.05], [opening("puerta_bano_servicio", "puerta", 1.0, .7)]),
            wall("bano_servicio_este", [6.35, 10.05], [6.35, 11.05]),
            wall("garden_oeste", [0, 4.15], [0, 15.2], height=1.1, thickness=.08),
            wall("garden_norte", [0, 15.2], [6.35, 15.2], height=1.1, thickness=.08),
            wall("garden_retorno", [6.35, 15.2], [6.35, 11.05], height=1.1, thickness=.08),
        ],
        "pilares": [],
        "instalaciones": [
            {"id": "agua_cocina", "tipo": "agua", "posicion": [8.25, 10.85, .6]},
            {"id": "agua_master", "tipo": "agua", "posicion": [3.5, .9, .5]},
            {"id": "agua_sec", "tipo": "agua", "posicion": [9.85, .9, .5]},
        ],
    }
    save("arquitectura.yaml", architecture)
    architecture_hash = hashlib.sha256(json.dumps(architecture, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

    furniture = [
        item("cama_principal", "XVA3_Cama_king", "suite_principal", [6.25, 1.75, 0], 0),
        item("mesita_principal", "XVA3_Mesita_L", "suite_principal", [4.88, 1.55, 0], 0),
        item("armario_principal", "XVA3_Armario_principal", "suite_principal", [5.35, 3.75, 0], 0),
        item("cama_secundaria", "XVA3_Cama_doble", "suite_secundaria", [8.7, 3.35, 0], 0, .72),
        item("cocina_lineal", "XVA3_Cocina_premium", "cocina", [8.0, 10.62, 0], 0, .78),
        item("comedor_interior", "comedor", "comedor", [8.65, 6.9, 0], 0, .68),
        item("sofa_principal", "sofa_recto", "sala", [6.25, 6.55, 0], 180, .9),
        item("mesa_centro", "mesa_centro", "sala", [5.9, 7.55, 0], 0, .9),
        item("comedor_garden", "comedor", "garden_lateral", [1.65, 9.25, 0], 0, .88),
        item("sofa_garden", "sofa_recto", "garden_superior", [3.2, 14.25, 0], 180, 1.12),
        item("mesa_garden", "mesa_centro", "garden_superior", [2.3, 12.65, 0], 0, 1.1),
    ]
    materials = {
        "pared_cal": {"color": [.72, .69, .62], "rugosidad": .78},
        "porcelanato": {"color": [.69, .66, .58], "rugosidad": .38},
        "roble": {"color": [.32, .16, .07], "rugosidad": .52},
        "garden": {"color": [.50, .48, .40], "rugosidad": .72},
        "techo": {"color": [.82, .81, .76], "rugosidad": .82},
    }
    finishes = {w["id"]: "pared_cal" for w in architecture["paredes"]}
    for r in architecture["espacios"]:
        finishes[r["id"] + ":piso"] = "garden" if r["id"].startswith("garden") else ("roble" if r["id"].startswith("suite") else "porcelanato")
        finishes[r["id"] + ":techo"] = "techo"
    interior = {"schema": 1, "id": "natural_contemporanea",
                "arquitectura": {"id": architecture["id"], "version": architecture["version"], "hash": architecture_hash},
                "materiales": materials, "acabados": finishes, "elementos": furniture}
    save("natural_contemporanea.yaml", interior)

    shots = [
        shot("garden_comedor", 26, [([.45, 10.55, 1.55], [1.65, 9.25, .85]), ([.55, 8.15, 1.58], [1.65, 9.25, .85])]),
        shot("garden_lounge", 25, [([1.0, 11.65, 1.58], [3.2, 14.1, .85]), ([4.9, 11.55, 1.62], [3.2, 14.1, .85])]),
        shot("cocina", 27, [([6.7, 9.15, 1.55], [8.0, 10.45, 1.0]), ([9.25, 9.0, 1.6], [8.0, 10.45, 1.0])]),
        shot("sala", 25, [([3.7, 5.3, 1.58], [6.15, 6.65, .9]), ([7.35, 5.3, 1.58], [6.15, 6.65, .9])]),
        shot("suite_principal", 27, [([7.25, 4.55, 1.58], [6.2, 1.7, .8]), ([7.3, 3.25, 1.52], [6.2, 1.7, .8])]),
        shot("comedor_interior", 27, [([9.45, 8.1, 1.58], [8.65, 6.9, .85]), ([7.85, 8.15, 1.55], [8.65, 6.9, .85])]),
    ]
    presentation = {
        "schema": 1, "exposicion": .1,
        "entorno": {"color": [.62, .76, .92], "intensidad": .7},
        "luces": [
            {"id": "luz_social", "posicion": [6.5, 7.4, 2.55], "objetivo": [6.2, 7.0, .8], "potencia": 500, "tamano": 1.8, "color": [1, .86, .7]},
            {"id": "luz_cocina", "posicion": [8.0, 9.8, 2.55], "objetivo": [8.0, 9.8, .8], "potencia": 350, "tamano": 1.3, "color": [1, .9, .78]},
            {"id": "luz_master", "posicion": [6.0, 2.2, 2.55], "objetivo": [6.0, 1.8, .7], "potencia": 320, "tamano": 1.2, "color": [1, .86, .7]},
            {"id": "luz_sec", "posicion": [8.5, 3.0, 2.55], "objetivo": [8.5, 2.7, .7], "potencia": 280, "tamano": 1.0, "color": [1, .86, .7]},
            {"id": "luz_garden", "posicion": [2.6, 12.8, 3.8], "objetivo": [2.6, 11.5, 0], "potencia": 650, "tamano": 3.0, "color": [1, .93, .82]},
        ],
        "tomas": shots,
    }
    save("presentacion.yaml", presentation)
    project = {
        "schema": 1, "id": "garden_ampliada", "arquitectura": "arquitectura.yaml",
        "variantes": {"natural_contemporanea": "natural_contemporanea.yaml"},
        "presentacion": "presentacion.yaml",
        "produccion": {
            "catalogo": "catalogo.yaml", "blender": "~/Aplicaciones/blender-4.5/blender",
            "salidas": "../../resultados/framework", "fps": 24,
            "gpu_vram_gb": 6, "ram_gb": 16,
            "licencias_permitidas": ["propia", "CC0", "CC Attribution"],
            "perfiles": {
                "previa": {"resolucion": [640, 360], "muestras": 12},
                "animatica": {"resolucion": [480, 270], "muestras": 6},
                "final": {"resolucion": [746, 420], "muestras": 32},
            },
        },
    }
    save("proyecto.yaml", project)
    print(DEST / "proyecto.yaml")


if __name__ == "__main__":
    main()
