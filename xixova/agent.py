"""Contexto y operaciones compactas para agentes, sin depender de Blender."""
import copy
import json
import os
from pathlib import Path

import yaml
from shapely.geometry import Polygon

from .core import contract, digest, read, validate


def _placement(item):
    result = {"id": item["id"], "activo": item["activo"], "espacio": item["espacio"],
              "colocacion": item["colocacion"]}
    for key in ("escala", "material", "nivel_detalle"):
        if key in item:
            result[key] = item[key]
    return result


def agent_context(bundle, issues, output_root):
    architecture = bundle["arquitectura"]
    files = bundle["sincronizacion"]["archivos"]
    sections = {
        "arquitectura": {
            "id": architecture["id"], "version": architecture["version"],
            "hash": bundle["arquitectura_hash"],
            "espacios": [{"id": room["id"],
                           "dimensiones": [round(Polygon(room["contorno"]).bounds[2]-Polygon(room["contorno"]).bounds[0], 3),
                                           round(Polygon(room["contorno"]).bounds[3]-Polygon(room["contorno"]).bounds[1], 3)],
                           "area": round(Polygon(room["contorno"]).area, 3),
                           "altura": room["altura"]} for room in architecture["espacios"]],
            "dudas": architecture["dudas"],
        },
        "interiorismo": {"id": bundle["interiorismo"]["id"],
                           "elementos": [_placement(item) for item in bundle["interiorismo"]["elementos"]],
                           "acabados": bundle["interiorismo"]["acabados"]},
        "presentacion": {"exposicion": bundle["presentacion"]["exposicion"],
                          "luces": bundle["presentacion"]["luces"],
                          "tomas": bundle["presentacion"]["tomas"]},
        "catalogo": {"total": len(bundle["catalogo"]["activos"]),
                      "categorias": sorted({asset["categoria"] for asset in bundle["catalogo"]["activos"]}),
                      "referenciados": sorted({item["activo"] for item in bundle["interiorismo"]["elementos"]})},
    }
    fingerprints = {key: digest(value) for key, value in sections.items()}
    from .maquette import build_payload, audit as audit_maquette
    maquette_payload=build_payload(bundle); maquette_report=audit_maquette(bundle,maquette_payload)
    maquette={"hash":maquette_report["hash"],"perfil":maquette_payload["configuracion"]["perfil"],
              "espacios":[x["id"] for x in maquette_payload["espacios"]],
              "puntos_interes":[x["id"] for x in maquette_payload["puntos_interes"]],
              "diagnosticos":[x for x in maquette_report["diagnosticos"] if x["gravedad"]=="error"]}
    return {"schema": 1,
            "proyecto": {"id": bundle["proyecto"]["id"], "variante": bundle["interiorismo"]["id"]},
            "fingerprints": fingerprints, **sections,
            "maqueta": maquette,
            "diagnosticos": issues,
            "archivos": {"fuentes": sorted(files), "salida": str(output_root),
                         "escena": (output_root/"escena.blend").is_file(),
                         "previas": len(list((output_root/"previa").glob("frame_*.png"))),
                         "animatica": (output_root/"animatica"/"recorrido.mp4").is_file()}}


def context_delta(current, previous=None):
    if not previous or previous.get("schema") != 1:
        return current
    changed = [key for key, value in current["fingerprints"].items()
               if previous.get("fingerprints", {}).get(key) != value]
    result = {"schema": 1, "proyecto": current["proyecto"],
              "fingerprints": current["fingerprints"], "cambios": changed,
              "diagnosticos": current["diagnosticos"], "archivos": current["archivos"]}
    for key in changed:
        result[key] = current[key]
    return result


def _find(values, identifier, kind):
    found = next((value for value in values if value["id"] == identifier), None)
    if found is None:
        raise ValueError(f"{kind} inexistente: {identifier}")
    return found


def apply_operations(bundle, request):
    invalid = contract(request, "operaciones")
    if invalid:
        raise ValueError("Contrato de operaciones inválido: "+"; ".join(item["elemento"]+" "+item["explicacion"] for item in invalid))
    expected = request.get("arquitectura_hash")
    if expected != bundle["arquitectura_hash"]:
        raise ValueError("Hash de arquitectura ausente o desactualizado.")
    operations = request.get("operaciones")
    if not isinstance(operations, list) or not operations:
        raise ValueError("Falta una lista no vacía de operaciones.")
    updated = copy.deepcopy(bundle); interior = updated["interiorismo"]; presentation = updated["presentacion"]
    changes = []; layers = set(); new_variant = None
    for operation in operations:
        action = operation.get("accion")
        if action == "mover_elemento":
            item = _find(interior["elementos"], operation.get("elemento"), "Elemento")
            before = {"espacio": item["espacio"], "colocacion": item["colocacion"]}
            if "espacio" in operation: item["espacio"] = operation["espacio"]
            item["colocacion"] = copy.deepcopy(operation["colocacion"])
            changes.append({"accion": action, "elemento": item["id"], "antes": before,
                            "despues": {"espacio": item["espacio"], "colocacion": item["colocacion"]}}); layers.add("interiorismo")
        elif action == "cambiar_activo":
            item = _find(interior["elementos"], operation.get("elemento"), "Elemento")
            _find(updated["catalogo"]["activos"], operation.get("activo"), "Activo")
            before = {key: item.get(key) for key in ("activo", "escala") if key in item}
            item["activo"] = operation["activo"]
            if "escala" in operation: item["escala"] = operation["escala"]
            changes.append({"accion": action, "elemento": item["id"], "antes": before,
                            "despues": {"activo": item["activo"], "escala": item.get("escala", 1)}}); layers.add("interiorismo")
        elif action == "anadir_elemento":
            item = copy.deepcopy(operation["elemento"])
            if any(value["id"] == item.get("id") for value in interior["elementos"]): raise ValueError("Elemento duplicado: "+str(item.get("id")))
            interior["elementos"].append(item); changes.append({"accion": action, "elemento": item}); layers.add("interiorismo")
        elif action == "eliminar_elemento":
            item = _find(interior["elementos"], operation.get("elemento"), "Elemento")
            interior["elementos"].remove(item); changes.append({"accion": action, "elemento": item["id"]}); layers.add("interiorismo")
        elif action == "aplicar_acabado":
            surface = operation.get("superficie"); material = operation.get("material")
            before = interior["acabados"].get(surface); interior["acabados"][surface] = material
            changes.append({"accion": action, "superficie": surface, "antes": before, "despues": material}); layers.add("interiorismo")
        elif action == "ajustar_luz":
            light = _find(presentation["luces"], operation.get("luz"), "Luz")
            fields = operation.get("cambios", {}); before = {key: light.get(key) for key in fields}
            light.update(copy.deepcopy(fields)); changes.append({"accion": action, "luz": light["id"], "antes": before, "despues": fields}); layers.add("presentacion")
        elif action == "ajustar_toma":
            shot = _find(presentation["tomas"], operation.get("toma"), "Toma")
            fields = operation.get("cambios", {}); before = {key: shot.get(key) for key in fields}
            shot.update(copy.deepcopy(fields)); changes.append({"accion": action, "toma": shot["id"], "antes": before, "despues": fields}); layers.add("presentacion")
        elif action == "crear_variante":
            if len(operations) != 1: raise ValueError("crear_variante debe ejecutarse sola.")
            identifier = operation.get("id")
            if not identifier or identifier in updated["proyecto"]["variantes"]: raise ValueError("ID de variante ausente o existente.")
            interior["id"] = identifier; new_variant = identifier
            changes.append({"accion": action, "desde": bundle["interiorismo"]["id"], "id": identifier}); layers.add("proyecto"); layers.add("interiorismo")
        else:
            raise ValueError("Operación desconocida: "+str(action))
    if "interiorismo" in layers and "presentacion" in layers:
        raise ValueError("Separa cambios de interiorismo y presentación en ejecuciones distintas.")
    issues = validate(updated)
    return updated, changes, sorted(layers), issues, new_variant


def write_yaml_atomic(path, value):
    path = Path(path); temp = path.with_suffix(path.suffix+".tmp")
    temp.write_text(yaml.safe_dump(value, allow_unicode=True, sort_keys=False), encoding="utf-8")
    os.replace(temp, path)


def publish_operations(bundle, updated, layers, new_variant=None):
    base = Path(bundle["archivo"]).parent; project = copy.deepcopy(bundle["proyecto"])
    selected = bundle["sincronizacion"]["variante"]
    if new_variant:
        filename = new_variant+".yaml"; project["variantes"][new_variant] = filename
        write_yaml_atomic(base/filename, updated["interiorismo"]); write_yaml_atomic(bundle["archivo"], project)
        return [str((base/filename).resolve()), str(Path(bundle["archivo"]).resolve())]
    written = []
    if "interiorismo" in layers:
        path = base/project["variantes"][selected]; write_yaml_atomic(path, updated["interiorismo"]); written.append(str(path.resolve()))
    if "presentacion" in layers:
        path = base/project.get("presentaciones", {}).get(selected, project["presentacion"])
        write_yaml_atomic(path, updated["presentacion"]); written.append(str(path.resolve()))
    return written


def read_operations(path):
    return read(path)
