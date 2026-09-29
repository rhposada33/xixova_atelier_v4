"""Exporta activos web con materiales glTF, LOD y auditoría reproducible."""
import argparse,json,sys,shutil,re
from pathlib import Path
import bpy

LEVELS={
 'mobile':{'faces':70000,'texture':160,'ratio':.32},
 'standard':{'faces':140000,'texture':320,'ratio':.68},
 'premium':{'faces':450000,'texture':700,'ratio':1.0},
}

def image_missing(image):
 if not image or image.source!='FILE' or image.packed_file:return False
 try:return not Path(bpy.path.abspath(image.filepath)).is_file()
 except Exception:return True

def main(data_path,output,level):
 data=json.loads(Path(data_path).read_text());assets={x['id']:x for x in data['catalogo']['activos']};spec=LEVELS[level]
 direct={item['id'] for item in data['resueltos'] if assets[item['activo']]['licencia'] in {'propia','CC0'}}
 proxy=sorted(item['id'] for item in data['resueltos'] if item['id'] not in direct)
 for scene in bpy.data.scenes:
  for key in list(scene.keys()):del scene[key]
 bpy.ops.object.select_all(action='DESELECT');selected=[];meshes=[];seen=set()
 for root in bpy.context.scene.objects:
  architectural=root.get('xixova_capa') in {'ARQUITECTURA','ENRIQUECIMIENTO'}
  if architectural and str(root.get('xixova_id','')).endswith(':techo'):continue
  if not architectural and (root.get('xixova_sync_role')!='elemento' or root.get('xixova_id') not in direct):continue
  for obj in ([root] if architectural else [root,*root.children_recursive]):
   if obj.name in seen:continue
   seen.add(obj.name);identifier=obj.get('xixova_id',root.get('xixova_id'));obj.hide_viewport=False;obj.hide_render=False;obj.select_set(True);selected.append(obj)
   for key in list(obj.keys()):
    if not str(key).startswith('xixova_'):del obj[key]
   obj['xixova_id']=identifier;obj['xixova_web_level']=level
   if obj.type=='MESH':meshes.append(obj)
 source_faces=sum(len(obj.data.polygons) for obj in meshes);ratio=min(spec['ratio'],spec['faces']/max(1,source_faces));issues=[];issue_keys=set();material_count=0;image_count=set();resized={};canonical_by_image={};texture_dir=Path(output).parent/f'.texturas-{level}';texture_dir.mkdir(parents=True,exist_ok=True)
 for obj in meshes:
  obj.data=obj.data.copy()
  if not obj.data.materials:issues.append({'codigo':'WEB_MATERIAL_AUSENTE','gravedad':'error','elemento':obj.get('xixova_id',obj.name),'explicacion':'Malla sin material.'})
  if not obj.data.uv_layers:issues.append({'codigo':'WEB_UV_AUSENTE','gravedad':'aviso','elemento':obj.get('xixova_id',obj.name),'explicacion':'Malla sin UV; sólo podrá usar materiales uniformes.'})
  material_count+=len(obj.data.materials)
  for material in obj.data.materials:
   if not material:continue
   material.use_nodes=True
   for node in material.node_tree.nodes:
    if node.type=='TEX_IMAGE' and node.image:
     source=node.image
     source_key=canonical_by_image.get(source.name) or (Path(source.filepath).name if source.filepath else re.sub(r'\.\d{3}$','',source.name),tuple(source.size),source.colorspace_settings.name)
     canonical_by_image[source.name]=source_key
     image_count.add(str(source_key))
     if image_missing(node.image):
      key=(obj.get('xixova_id',obj.name),node.image.filepath)
      if key not in issue_keys:issues.append({'codigo':'WEB_TEXTURA_AUSENTE','gravedad':'error','elemento':key[0],'explicacion':key[1]});issue_keys.add(key)
     elif source_key not in resized:
      clean=source.copy();scale=min(1,spec['texture']/max(clean.size));clean.scale(max(1,int(clean.size[0]*scale)),max(1,int(clean.size[1]*scale)))
      colorspace=source.colorspace_settings.name;clean.file_format='PNG';clean.filepath_raw=str(texture_dir/(str(len(resized))+'.png'));clean.save();clean=bpy.data.images.load(clean.filepath_raw,check_existing=False);clean.colorspace_settings.name=colorspace;clean.pack();resized[source_key]=clean;canonical_by_image[clean.name]=source_key
     if source_key in resized:node.image=resized[source_key]
  if ratio<.98 and len(obj.data.polygons)>250:
   modifier=obj.modifiers.new('Xixova_Web_'+level,'DECIMATE');modifier.ratio=max(.05,ratio)
 output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
 if selected:
  bpy.context.view_layer.objects.active=next((x for x in selected if x.type=='MESH'),selected[0])
  meshopt=bool(shutil.which('gltfpack'))
  if not meshopt:issues.append({'codigo':'WEB_MESHOPT_NO_DISPONIBLE','gravedad':'aviso','elemento':'exportador','explicacion':'gltfpack no está instalado; se exporta GLB optimizado sin compresión Meshopt.'})
  bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_apply=True,export_yup=False,export_cameras=False,export_lights=False,export_extras=True,export_materials='EXPORT',export_image_format='AUTO',export_image_add_webp=True,export_image_webp_fallback=False,export_image_quality=82,export_use_gltfpack=meshopt,export_gltfpack_tc=False,export_gltfpack_tq=8,export_texture_dir='textures')
 report={'schema':2,'nivel':level,'arquitectura':True,'compresion_geometria':'meshopt' if meshopt else 'sin_meshopt','texturas':'webp','activos':sorted(direct),'proxies':proxy,'caras_fuente':source_faces,'ratio':ratio,'materiales':material_count,'imagenes':len(image_count),'diagnosticos':issues,'archivo':output.name if output.is_file() else None,'bytes':output.stat().st_size if output.is_file() else 0}
 shutil.rmtree(texture_dir,ignore_errors=True)
 output.with_suffix('.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('MAQUETA_WEB='+json.dumps(report,ensure_ascii=False))
 if any(x['gravedad']=='error' for x in issues):raise RuntimeError('La auditoría web encontró materiales o texturas inválidos.')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--datos',required=True);parser.add_argument('--salida',required=True);parser.add_argument('--nivel',choices=LEVELS,default='premium');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);main(args.datos,args.salida,args.nivel)
