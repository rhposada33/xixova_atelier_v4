"""Produce el nivel web de activos redistribuibles desde una escena Xixova."""
import argparse
import colorsys
import json
import sys
from pathlib import Path

import bpy


def color(identifier):
    hue=(sum(ord(c) for c in identifier)%360)/360
    return (*colorsys.hsv_to_rgb(hue,.22,.72),1)


def main(data_path, output):
    data=json.loads(Path(data_path).read_text()); assets={x['id']:x for x in data['catalogo']['activos']}
    direct={item['id'] for item in data['resueltos'] if assets[item['activo']]['licencia'] in {'propia','CC0'}}
    # Scene synchronization metadata contains absolute local paths and must never
    # cross the publication boundary.
    for scene in bpy.data.scenes:
        for key in list(scene.keys()):del scene[key]
    bpy.ops.object.select_all(action='DESELECT'); selected=[]; meshes=[]
    for root in bpy.context.scene.objects:
        if root.get('xixova_sync_role')!='elemento' or root.get('xixova_id') not in direct:continue
        family=[root,*root.children_recursive]
        for obj in family:
            identifier=obj.get('xixova_id',root.get('xixova_id'))
            for key in list(obj.keys()):del obj[key]
            obj['xixova_id']=identifier
            obj.hide_viewport=False; obj.hide_render=False; obj.select_set(True); selected.append(obj)
            if obj.type=='MESH':meshes.append(obj)
    source_faces=sum(len(obj.data.polygons) for obj in meshes); ratio=min(1,180000/max(1,source_faces))
    materials={}
    for obj in meshes:
        identifier=obj.get('xixova_id','activo'); mat=materials.get(identifier)
        if mat is None:
            mat=bpy.data.materials.new('WEB_'+identifier);mat.diffuse_color=color(identifier);mat.roughness=.72;mat.metallic=0;materials[identifier]=mat
        obj.data=obj.data.copy();obj.data.materials.clear();obj.data.materials.append(mat)
        if ratio<.98 and len(obj.data.polygons)>200:
            modifier=obj.modifiers.new('Xixova_Web_LOD','DECIMATE');modifier.ratio=max(.03,ratio)
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    if selected:
        bpy.context.view_layer.objects.active=next((x for x in selected if x.type=='MESH'),selected[0])
        bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_apply=True,export_yup=False,export_cameras=False,export_lights=False,export_extras=True,export_materials='EXPORT',export_image_format='NONE')
    report={'activos':sorted(direct),'caras_fuente':source_faces,'ratio':ratio,'archivo':output.name if output.is_file() else None,'bytes':output.stat().st_size if output.is_file() else 0}
    output.with_suffix('.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('MAQUETA_WEB='+json.dumps(report,ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--datos',required=True);parser.add_argument('--salida',required=True);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);main(args.datos,args.salida)
