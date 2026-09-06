"""Puente bpy para Blender MCP y capturas de .blend guardados.

No necesita PyYAML/Shapely en Blender. Exporta una captura; el CLI valida y
publica los documentos. La captura nunca escribe sobre los YAML.
"""
import argparse
import hashlib
import json
import math
import sys
import uuid
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

KEY = 'xixova_sync_base'
UID = 'xixova_sync_uid'


def clean(value):
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError('Número no finito en la escena.')
        return round(value, 6)
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    return value


def fingerprint(value):
    return hashlib.sha256(json.dumps(clean(value), sort_keys=True).encode()).hexdigest()


def values(value):
    if isinstance(value, bpy.types.ID):
        return value.get(UID, value.name_full)
    if isinstance(value, (bool, int, float, str)) or value is None:
        return value
    try:
        return [values(v) for v in value]
    except TypeError:
        return str(type(value))


def properties(block, exclude=()):
    return {p.identifier: values(getattr(block, p.identifier))
            for p in block.bl_rna.properties
            if p.identifier not in {'rna_type', 'name', *exclude} and not p.is_readonly}


def graph(tree, mutable):
    if tree is None:
        return None
    result = []
    for node in tree.nodes:
        inputs = [[socket.identifier, values(socket.default_value)] for socket in node.inputs
                  if hasattr(socket, 'default_value') and (node.name, socket.name) not in mutable]
        result.append([node.name, node.bl_idname, inputs,
                       properties(node, {'location', 'width', 'height', 'select', 'label', 'color',
                                         'use_custom_color', 'show_options', 'show_preview', 'show_texture'})])
    return [bool(tree.animation_data), result, sorted([l.from_node.name, l.from_socket.identifier, l.to_node.name, l.to_socket.identifier]
                           for l in tree.links)]


def object_signature(o, movable):
    geometry = None
    if o.type == 'MESH':
        geometry = [[list(v.co) for v in o.data.vertices],
                    [[list(p.vertices), p.material_index, p.use_smooth] for p in o.data.polygons],
                    [[[float(v) for v in loop.uv] for loop in layer.data] for layer in o.data.uv_layers],
                    [[list(v.co) for v in block.data] for block in o.data.shape_keys.key_blocks] if o.data.shape_keys else []]
    elif o.type == 'CURVE':
        geometry = [properties(o.data), [[s.type, s.use_cyclic_u,
                    [[list(p.co), list(p.handle_left), list(p.handle_right)] for p in s.bezier_points],
                    [list(p.co) for p in s.points]] for s in o.data.splines]]
    elif o.type in {'CAMERA', 'LIGHT'}:
        exclusions = {'lens', 'angle', 'angle_x', 'angle_y'} if o.type == 'CAMERA' else {'energy', 'color', 'size'}
        geometry = properties(o.data, exclusions)
        geometry['animacion_datos'] = bool(o.data.animation_data)
        if o.type == 'CAMERA':
            geometry['dof'] = properties(o.data.dof)
    return [o.type, o.get('xixova_id'), o.get('xixova_capa'), o.get('xixova_sync_role'),
            [list(row) for row in o.matrix_parent_inverse],
            o.parent.get(UID) if o.parent else None,
            None if movable else [list(row) for row in o.matrix_basis],
            list(o.delta_location), list(o.delta_rotation_euler), list(o.delta_scale),
            o.hide_render, o.hide_viewport, o.hide_get(),
            sorted(c.name for c in o.users_collection),
            [m.get(UID) if m else None for m in getattr(o.data, 'materials', [])],
            [properties(m) for m in o.modifiers], [properties(c) for c in o.constraints],
            bool(o.animation_data) if o.type != 'CAMERA' else False, geometry]


def pose(o):
    loc, rotation, scale = o.matrix_world.decompose()
    rebuilt = Matrix.LocRotScale(loc, rotation, scale)
    if any(abs(o.matrix_world[i][j]-rebuilt[i][j]) > 1e-5 for i in range(4) for j in range(4)):
        raise ValueError(f'{o.name}: transformación con cizalla no representable.')
    return loc, rotation, scale


def target(o, distance):
    loc, rotation, scale = pose(o)
    direction = rotation @ Vector((0, 0, -1))
    expected = direction.to_track_quat('-Z', 'Y')
    if abs(abs(rotation.dot(expected))-1) > 1e-5 or any(abs(v-1) > 1e-5 for v in scale):
        raise ValueError(f'{o.name}: inclinación lateral (roll) o escala de cámara/luz no representable.')
    return list(loc), list(loc + direction*distance)


def snapshot(config):
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    objects = list(scene.objects)
    ids = [o.get(UID) for o in objects]
    if None in ids or len(ids) != len(set(ids)):
        raise ValueError('Objetos nuevos, duplicados o sin identificador: regístralos en los datos y reconstruye.')
    movable = {o.get(UID) for o in objects if o.get('xixova_sync_role') in {'elemento', 'camara', 'luz'}}
    protected = {o[UID]: object_signature(o, o[UID] in movable) for o in objects}
    materials = {}
    material_graphs = {}
    for m in bpy.data.materials:
        if not m.users:
            continue
        if UID not in m:
            if m.users:
                raise ValueError('Material nuevo no registrado: '+m.name)
            continue
        if m[UID] in material_graphs:
            raise ValueError('Material duplicado: registra una variante de material en los datos.')
        material_id = m.get('xixova_material_id')
        mutable = set()
        if material_id:
            bs = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None
            if bs is None:
                raise ValueError('Material simple convertido a otro tipo: '+m.name)
            mutable = {(bs.name, n) for n in ('Base Color', 'Roughness', 'Metallic')}
            # Alpha cannot be represented in the current material contract.
            if abs(bs.inputs['Base Color'].default_value[3]-1) > 1e-6:
                raise ValueError('Transparencia no representable: '+m.name)
            materials[material_id] = {'color': list(bs.inputs['Base Color'].default_value[:3]),
                                      'rugosidad': bs.inputs['Roughness'].default_value,
                                      'metalico': bs.inputs['Metallic'].default_value}
        material_graphs[m[UID]] = [m.use_nodes, graph(m.node_tree, mutable)]
    elements = {}
    for o in objects:
        if o.get('xixova_sync_role') != 'elemento':
            continue
        loc, rot, scale = pose(o)
        euler = rot.to_euler('XYZ')
        if abs(euler.x) > 1e-5 or abs(euler.y) > 1e-5 or min(scale) <= 0 or max(scale)-min(scale) > 1e-5:
            raise ValueError(o.name+': solo giro Z y escala uniforme positiva.')
        if o.animation_data or o.constraints:
            raise ValueError(o.name+': animación o restricciones del mueble no representables.')
        elements[o['xixova_id']] = dict(posicion=list(loc), rotacion=math.degrees(euler.z), escala=scale.x)
    lights = {}
    for spec in config['presentacion']['luces']:
        o = next(o for o in objects if o.get('xixova_sync_role') == 'luz' and o.get('xixova_id') == spec['id'])
        if o.animation_data:
            raise ValueError('La animación de luces no está representada en el contrato.')
        position, goal = target(o, math.dist(spec['posicion'], spec['objetivo']))
        lights[spec['id']] = dict(posicion=position, objetivo=goal, potencia=o.data.energy,
                                  tamano=o.data.size, color=list(o.data.color))
    shots = {}
    original_frame, subframe = scene.frame_current, scene.frame_subframe
    cameras = {o['xixova_id']: o for o in objects if o.get('xixova_sync_role') == 'camara'}
    pending_pose = {id: o.matrix_world.copy() for id, o in cameras.items()}
    try:
        scene.frame_set(original_frame, subframe=subframe)
        for id, o in cameras.items():
            if any(abs(o.matrix_world[i][j]-pending_pose[id][i][j]) > 1e-5 for i in range(4) for j in range(4)):
                raise ValueError(id+': cambio de cámara sin insertar clave; usa ajustar_camara o inserta claves antes de capturar.')
        offset = 0
        for shot in config['presentacion']['tomas']:
            o = cameras[shot['id']]
            points = []
            lens = o.data.lens
            for frame in (f for f in config['fotogramas'] if f['toma'] == shot['id']):
                scene.frame_set(offset+frame['numero'])
                position, goal = target(o, math.dist(frame['posicion'], frame['objetivo']))
                if abs(o.data.lens-lens) > 1e-6:
                    raise ValueError('Lente animada no representable.')
                points.append(dict(posicion=position, objetivo=goal))
            shots[shot['id']] = dict(lente=o.data.lens, puntos=points)
            offset += shot['fotogramas']
    finally:
        scene.frame_set(original_frame, subframe=subframe)
        # Restore unsaved, unkeyed camera changes even when capture is rejected.
        for id, matrix in pending_pose.items():
            cameras[id].matrix_world = matrix
        bpy.context.view_layer.update()
    background = next((n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if background is None:
        raise ValueError('El entorno ya no es un Background simple.')
    protected_scene = [bool(scene.animation_data), scene.frame_start, scene.frame_end, scene.render.fps, scene.render.fps_base,
                       scene.view_settings.view_transform, scene.view_settings.look,
                       [[m.name, m.frame, m.camera.get(UID) if m.camera else None] for m in scene.timeline_markers],
                       graph(scene.world.node_tree, {(background.name, 'Color'), (background.name, 'Strength')})]
    return clean(dict(protegido=fingerprint([protected, material_graphs, protected_scene]),
                      elementos=elements, materiales=materials, luces=lights, tomas=shots,
                      exposicion=scene.view_settings.exposure,
                      entorno=dict(color=list(background.inputs['Color'].default_value[:3]),
                                   intensidad=background.inputs['Strength'].default_value)))


def bind(config):
    """Solo el constructor establece la referencia; nunca usar para aceptar ediciones."""
    for o in bpy.context.scene.objects:
        o[UID] = uuid.uuid4().hex
    for m in bpy.data.materials:
        m[UID] = uuid.uuid4().hex
    state = snapshot(config)
    bpy.context.scene[KEY] = json.dumps({'schema': 1, 'fuentes': config['sincronizacion'],
                                       'config': config, 'estado': state}, ensure_ascii=False)


def capturar(salida=None):
    """Llamable por execute_blender_code: captura cambios vivos, sin guardar el .blend."""
    scene = bpy.context.scene
    if KEY not in scene:
        raise ValueError('Escena sin referencia de sincronización. Reconstruye con componer antes de editar.')
    base = json.loads(scene[KEY])
    result = {'schema': 1, 'fuentes': base['fuentes'], 'base': base['estado'],
              'actual': snapshot(base['config'])}
    if salida:
        path = Path(salida).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix+'.tmp')
        tmp.write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n')
        tmp.replace(path)
    return result


def ajustar_camara(id, desplazamiento=(0, 0, 0), lente=None):
    """Traslada todas las claves de una toma; conserva orientación y recorrido."""
    scene = bpy.context.scene
    base = json.loads(scene[KEY])
    config = base['config']
    o = next(o for o in scene.objects if o.get('xixova_sync_role') == 'camara' and o.get('xixova_id') == id)
    original = scene.frame_current
    offset = 0
    try:
        for shot in config['presentacion']['tomas']:
            if shot['id'] == id:
                positions = []
                for frame in range(offset+1, offset+shot['fotogramas']+1):
                    scene.frame_set(frame)
                    positions.append((frame, o.location.copy()+Vector(desplazamiento)))
                for frame, position in positions:
                    o.location = position
                    o.keyframe_insert('location', frame=frame)
                break
            offset += shot['fotogramas']
        if lente is not None:
            o.data.lens = lente
    finally:
        scene.frame_set(original)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--salida', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    capturar(args.salida)
