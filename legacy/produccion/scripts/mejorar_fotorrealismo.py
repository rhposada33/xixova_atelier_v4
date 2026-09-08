"""Ajustes reproducibles de realismo sobre la copia de producción existente."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.1.0-realismo'
SHOT_TARGETS = {
    'T01_COMEDOR_GENERAL': (2.82, 2.58, 1.29),
    'T02_MESA_DETALLE': (2.86, 3.08, .90),
    'T03_TERRAZA': (2.76, 1.22, 1.24),
    'T04_BIBLIOTECA': (5.14, 5.72, 1.43),
}


def args():
    p = argparse.ArgumentParser()
    p.add_argument('--informe', type=Path, default=ROOT/'salidas/fotorrealismo/auditoria.json')
    return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def principled(material):
    if not material or not material.use_nodes:
        return None
    return next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def set_input(node, name, value):
    socket = node.inputs.get(name) if node else None
    if socket is not None:
        socket.default_value = value


def micro_roughness(material, scale=7.0, amount=.07):
    """Añade variación de roughness idempotente a materiales simples."""
    if not material or not material.use_nodes or material.node_tree.nodes.get('XIXOVA Micro Roughness'):
        return False
    bsdf = principled(material)
    rough = bsdf.inputs.get('Roughness') if bsdf else None
    if not rough or rough.is_linked:
        return False
    nodes, links = material.node_tree.nodes, material.node_tree.links
    tex = nodes.new('ShaderNodeTexNoise'); tex.name = 'XIXOVA Micro Roughness'
    tex.label = 'Variación superficial a escala real'
    tex.inputs['Scale'].default_value = scale
    tex.inputs['Detail'].default_value = 2.0
    tex.inputs['Roughness'].default_value = .65
    ramp = nodes.new('ShaderNodeValToRGB'); ramp.name = 'XIXOVA Roughness Range'
    base = float(rough.default_value)
    ramp.color_ramp.elements[0].color = (max(.02, base-amount),)*3+(1,)
    ramp.color_ramp.elements[1].color = (min(.98, base+amount),)*3+(1,)
    links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], rough)
    return True


def add_bevel(obj, width, segments=2):
    if obj.type != 'MESH' or obj.modifiers.get('XIXOVA Microbisel'):
        return False
    if min(obj.dimensions) < width*3:
        return False
    mod = obj.modifiers.new('XIXOVA Microbisel', 'BEVEL')
    mod.width, mod.segments = width, segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(30)
    return True


def bbox_contains(obj, point, margin=.04):
    p = obj.matrix_world.inverted_safe() @ Vector(point)
    lo = Vector(tuple(min(c[i] for c in obj.bound_box) for i in range(3)))
    hi = Vector(tuple(max(c[i] for c in obj.bound_box) for i in range(3)))
    return all(lo[i]-margin <= p[i] <= hi[i]+margin for i in range(3))


def area_light(col, name, location, target, energy, size, color):
    obj = bpy.data.objects.get(name)
    if obj is None:
        data = bpy.data.lights.new(name, 'AREA')
        obj = bpy.data.objects.new(name, data); col.objects.link(obj)
    obj.data.energy, obj.data.shape = energy, 'RECTANGLE'
    if hasattr(obj.data, 'specular_factor'): obj.data.specular_factor = 0.0
    obj.data.size, obj.data.size_y = size[0], size[1]
    obj.data.color = color; obj.location = location
    if hasattr(obj, 'visible_camera'): obj.visible_camera = False
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


def main():
    a = args(); scene = bpy.context.scene
    if bpy.app.version[:2] != (4, 5):
        raise RuntimeError('Se requiere Blender 4.5 LTS')
    if '/produccion/originales/' in bpy.data.filepath.replace('\\', '/'):
        raise RuntimeError('Se niega a modificar un original')
    if not bpy.data.filepath.endswith('xixova_fotorrealista.blend'):
        raise RuntimeError('Abre xixova_fotorrealista.blend antes de ejecutar mejoras')

    report = {'version': VERSION, 'archivo': bpy.data.filepath, 'cambios': {}, 'avisos': []}
    # Reaplica de forma verificable la orientación/posición del recurso importado desde Sketchfab.
    straight = next((o for o in scene.objects if o.name.startswith('SOFA_RECTO_SKETCHFAB / Sketchfab_model')), None)
    if straight:
        straight.rotation_mode = 'QUATERNION'
        original = Quaternion((.7071067690849304, -.7071067690849304, 0, 0))
        straight.rotation_quaternion = Quaternion((0, 0, 1), math.radians(90)) @ original
        bpy.context.view_layer.update()
        meshes = [o for o in [straight]+list(straight.children_recursive) if o.type == 'MESH']
        points = [o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
        lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
        hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
        straight.location += Vector((5.75-(lo.x+hi.x)/2, 5.405-(lo.y+hi.y)/2, .012-lo.z))
        bpy.context.view_layer.update()
        points = [o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
        lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
        hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
        dims = hi-lo
        valid = 2.0 <= dims.x <= 2.2 and .75 <= dims.y <= .95 and .75 <= dims.z <= .95
        report['cambios']['sofa_recto'] = {'estado':'VALIDADO' if valid else 'FUERA_DE_RANGO',
            'dimensiones_m':[round(v,4) for v in dims], 'uid':straight.get('sketchfab_uid'),
            'autor':straight.get('sketchfab_author'), 'licencia':straight.get('sketchfab_license'),
            'escala_uniforme':straight.get('xixova_uniform_scale'), 'giro_z_grados':90}
        if not valid: straight.hide_render = True
    # Conservar el recurso inválido, pero fuera del render.
    sofas = [o for o in scene.objects if 'atelier sofa' in o.name.lower()]
    for obj in sofas:
        obj.hide_render = True
        obj['xixova_estado'] = 'CHAISLONGUE_NO_VALIDADO_CONSERVADO'
    report['cambios']['sofa_oculto'] = len(sofas)
    if not straight: report['avisos'].append('Falta importar sofá recto validado desde Sketchfab.')

    # Microbiseles solo en arquitectura/mobiliario visible, no en suelo fragmentado ni recursos externos.
    architectural = ('fondo','lateral','division','dintel','antepecho','zocalo','marco','paspartu')
    furniture = ('mesa comedor','libreria','consola','banco terraza','tv')
    beveled = []
    for obj in scene.objects:
        low = obj.name.lower()
        if any(k in low for k in architectural):
            if add_bevel(obj, .003): beveled.append(obj.name)
        elif any(k in low for k in furniture):
            if add_bevel(obj, .002): beveled.append(obj.name)
    report['cambios']['microbiseles_nuevos'] = beveled
    report['cambios']['microbiseles_totales'] = [o.name for o in scene.objects if o.modifiers.get('XIXOVA Microbisel')]

    tuned = []
    for name, scale, amount in [
        ('Atelier ceramica', 8, .055), ('Atelier terracota', 6, .08),
        ('Atelier papel', 11, .045), ('Atelier tinta', 9, .05), ('Techo', 5, .035)]:
        if micro_roughness(bpy.data.materials.get(name), scale, amount): tuned.append(name)
    glass = bpy.data.materials.get('Vidrio'); g = principled(glass)
    if g:
        set_input(g, 'Roughness', .055); set_input(g, 'IOR', 1.45)
        set_input(g, 'Transmission Weight', 1.0)
        set_input(g, 'Coat Weight', .12); set_input(g, 'Coat Roughness', .08)
        tuned.append('Vidrio')
    # Mapas de datos nunca deben interpretarse como color.
    for image in bpy.data.images:
        low = image.name.lower()
        if any(k in low for k in ('rough','normal','height','nor_gl')):
            try: image.colorspace_settings.name = 'Non-Color'
            except TypeError: pass
    report['cambios']['materiales_ajustados_ahora'] = tuned
    report['cambios']['materiales_micro_roughness'] = [m.name for m in bpy.data.materials
        if m.use_nodes and m.node_tree.nodes.get('XIXOVA Micro Roughness')]

    # Luz natural amplia desde terraza + rebote interior neutro; se evita iluminar sin fuente plausible.
    col = collection('PRODUCCION / REALISMO')
    window_light = area_light(col, 'XIXOVA Luz ventana', (3.10, 1.82, 2.05), (3.05, 3.20, 1.05), 0, (2.1, 1.2), (.72, .82, 1.0))
    bounce_light = area_light(col, 'XIXOVA Rebote comedor', (3.05, 4.75, 2.52), (3.00, 3.15, 1.10), 0, (1.3, .7), (1.0, .78, .56))
    window_light.hide_render = True; bounce_light.hide_render = True
    if scene.world and scene.world.use_nodes:
        mapping = next((n for n in scene.world.node_tree.nodes if n.type == 'MAPPING'), None)
        if mapping: mapping.inputs['Rotation'].default_value[2] = math.radians(250)
        bg = next((n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'), None)
        if bg: bg.inputs['Strength'].default_value = .28
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = .25
    report['cambios']['iluminacion'] = ['HDRI 250 grados', 'luces auxiliares descartadas por reflejo en vidrio']

    # DOF discreto; el target fijo evita bombeo de foco durante el movimiento.
    dof = []
    for name, target in SHOT_TARGETS.items():
        cam = bpy.data.objects.get(name)
        if not cam: continue
        focus_name = 'FOCO_'+name
        focus = bpy.data.objects.get(focus_name)
        if focus is None:
            focus = bpy.data.objects.new(focus_name, None); col.objects.link(focus)
        focus.location = target; focus.hide_render = True
        cam.data.dof.use_dof = True; cam.data.dof.focus_object = focus
        cam.data.dof.aperture_fstop = 7.1 if name != 'T02_MESA_DETALLE' else 5.6
        dof.append(name)
    if hasattr(scene.render, 'use_motion_blur'):
        scene.render.use_motion_blur = True
    report['cambios']['camaras_dof'] = dof

    scene.render.resolution_x, scene.render.resolution_y = 746, 420
    scene.cycles.samples = 32; scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = .02; scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8; scene.cycles.volume_bounces = 0
    scene['xixova_pipeline'] = VERSION
    scene['xixova_exterior'] = 'Conceptual; no representa vista real del inmueble.'

    missing = []
    for image in bpy.data.images:
        if image.source == 'FILE' and not image.packed_file:
            path = Path(bpy.path.abspath(image.filepath))
            if not path.is_file(): missing.append({'imagen':image.name,'ruta':str(path)})
    review_frames = [1,60,120,121,180,240,241,300,360,361,420,480]
    solids = [o for o in scene.objects if o.type == 'MESH' and any(k in o.name.lower() for k in
              ('fondo','lateral','division','dintel','techo','mesa','silla','consola','libreria','banco','sofa'))]
    camera_collisions = []
    for frame in review_frames:
        scene.frame_set(frame)
        cam = scene.camera
        hits = [o.name for o in solids if bbox_contains(o, cam.matrix_world.translation)] if cam else ['SIN_CAMARA']
        if hits: camera_collisions.append({'fotograma':frame,'objetos':hits})
    report['auditoria'] = {'objetos':len(scene.objects),'materiales':len(bpy.data.materials),
                           'imagenes':len(bpy.data.images),'imagenes_ausentes':missing,
                           'recursos_empacados':all(i.packed_file or i.source != 'FILE' for i in bpy.data.images),
                           'fotogramas_revision':review_frames,'colisiones_camara_bbox':camera_collisions}
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 1
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    a.informe.parent.mkdir(parents=True, exist_ok=True)
    a.informe.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('REALISMO='+str(a.informe), flush=True)


if __name__ == '__main__': main()
