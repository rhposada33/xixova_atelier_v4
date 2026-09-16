"""Validate a generated Visual V2 Blender scene and its exported GLB.

Run in Blender after ``building_model.py``. It is intentionally independent of
the viewer: it never edits the public production asset or inventory data.
"""
import bpy
import hashlib
import json
import math
import os
import struct

ROOT = "/home/rafa/RenderCasa/xixova_atelier_v4"
MODEL_STEM = os.environ.get("XIXOVA_BUILDING_STEM", "xixova-building-visual-v2")
SCENE_PREFIX = os.environ.get("XIXOVA_BUILDING_SCENE", "XIXOVA_BUILDING_VISUAL_V2")
GLB_PATH = os.path.join(ROOT, "xixova", "maquette_web", "public", "building", MODEL_STEM + ".glb")
REPORT_PATH = os.path.join(ROOT, "resultados", "building_visual_v2", MODEL_STEM + "-audit.json")
BASELINE_PATH = os.path.join(ROOT, "xixova", "maquette_web", "public", "building", "xixova-building.glb")

EXPECTED_CODES = [str(floor * 100 + unit) for floor in range(1, 19) for unit in range(1, 5)]
EXPECTED_NAMES = {"UNIT_" + code + "_PROXY" for code in EXPECTED_CODES}
scenes = [item for item in bpy.data.scenes if item.name.startswith(SCENE_PREFIX)]
if not scenes:
    raise RuntimeError("Visual V2 scene not found: " + SCENE_PREFIX)
# A recovery run can leave an archived predecessor in the same .blend. Select
# the V2 scene that owns the canonical proxy names, never the scene by suffix.
scene = max(scenes, key=lambda item: sum(obj.name in EXPECTED_NAMES for obj in item.objects))

errors = []
proxies = [obj for obj in scene.objects if obj.name.startswith("UNIT_")]
names = [obj.name for obj in proxies]
if len(proxies) != 72:
    errors.append("expected 72 proxy objects, got %d" % len(proxies))
if set(names) != EXPECTED_NAMES:
    errors.append("proxy names do not exactly match the expected 72 unit codes")
if len(names) != len(set(names)):
    errors.append("duplicate proxy names")
for obj in proxies:
    code = obj.name.removeprefix("UNIT_").removesuffix("_PROXY")
    expected_floor = int(code[:-2])
    if obj.get("xixova_unit_code") != code or obj.get("xixova_floor") != expected_floor or obj.get("xixova_proxy") is not True:
        errors.append("invalid metadata: " + obj.name)
    if not all(math.isfinite(value) for row in obj.matrix_world for value in row):
        errors.append("non-finite transform: " + obj.name)
for obj in scene.objects:
    if obj.type in {"CAMERA", "LIGHT"}:
        errors.append("accidental %s: %s" % (obj.type.lower(), obj.name))
    if obj.name.startswith("ARCHIVE_"):
        errors.append("working/archive object leaked into scene: " + obj.name)

mesh_objects = [obj for obj in scene.objects if obj.type == "MESH"]
vertices = [obj.matrix_world @ vertex.co for obj in mesh_objects for vertex in obj.data.vertices]
if not vertices:
    errors.append("scene has no mesh geometry")
bounds = {
    "min": [min(vertex[i] for vertex in vertices) for i in range(3)],
    "max": [max(vertex[i] for vertex in vertices) for i in range(3)],
} if vertices else None
normal_issues = []
for obj in mesh_objects:
    for polygon in obj.data.polygons:
        if polygon.area <= 1e-9 or polygon.normal.length <= 1e-9:
            normal_issues.append(obj.name)
            break
if normal_issues:
    errors.append("zero-area or invalid normals: " + ", ".join(normal_issues))
local_references = [image.filepath for image in bpy.data.images if image.filepath and not image.packed_file]

def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def glb_summary(path):
    with open(path, "rb") as handle:
        header = handle.read(20)
        magic, version, _, json_length, chunk_type = struct.unpack("<IIIII", header)
        if magic != 0x46546C67 or version != 2 or chunk_type != 0x4E4F534A:
            raise RuntimeError("invalid GLB header")
        document = json.loads(handle.read(json_length).decode("utf-8").rstrip(" \t\r\n\x00"))
    node_names = [node.get("name", "") for node in document.get("nodes", [])]
    glb_proxies = [name for name in node_names if name.startswith("UNIT_")]
    return {
        "nodes": len(document.get("nodes", [])), "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])), "images": len(document.get("images", [])),
        "cameras": len(document.get("cameras", [])),
        "lights": len(document.get("extensions", {}).get("KHR_lights_punctual", {}).get("lights", [])),
        "proxies": len(glb_proxies), "proxyNamesExact": set(glb_proxies) == EXPECTED_NAMES,
    }

if not os.path.isfile(GLB_PATH):
    errors.append("missing GLB: " + GLB_PATH)
    glb = None
else:
    glb = glb_summary(GLB_PATH)
    if glb["proxies"] != 72 or not glb["proxyNamesExact"]:
        errors.append("exported GLB proxy nodes are invalid")
    if glb["cameras"] or glb["lights"]:
        errors.append("exported GLB contains cameras or lights")

report = {
    "ok": not errors, "scene": scene.name, "blendObjects": len(scene.objects),
    "blendMeshes": len(mesh_objects), "blendMaterials": len({slot.material for obj in mesh_objects for slot in obj.material_slots if slot.material}),
    "blendTriangles": sum(len(polygon.vertices) - 2 for obj in mesh_objects for polygon in obj.data.polygons),
    "bounds": bounds, "normalIssueObjects": normal_issues, "localReferences": local_references,
    "glb": glb, "glbSha256": sha256(GLB_PATH) if glb else None,
    "glbBytes": os.path.getsize(GLB_PATH) if glb else None,
    "baselineSha256": sha256(BASELINE_PATH), "baselineBytes": os.path.getsize(BASELINE_PATH),
    "errors": errors,
}
os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
with open(REPORT_PATH, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
print(json.dumps(report, indent=2, sort_keys=True))
if errors:
    raise RuntimeError("Visual V2 audit failed; see " + REPORT_PATH)
