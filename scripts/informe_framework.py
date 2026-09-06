# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml>=6,<7", "jsonschema>=4.23,<5", "shapely>=2,<3"]
# ///
"""Informe local de comparación, a partir de entregas completas y verificadas."""
import argparse
import html
import json
import os
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from xixova.core import load
from xixova.cli import output

p=argparse.ArgumentParser();p.add_argument('proyectos',nargs='+',type=Path);p.add_argument('--salida',type=Path,default=Path('resultados/framework/index.html'));a=p.parse_args()
a.salida=a.salida.resolve();a.salida.parent.mkdir(parents=True,exist_ok=True)
sections=[]; evidence=[]
for project in a.proyectos:
 first,errors=load(project)
 if errors:raise SystemExit(errors)
 cards=[];reports=[];base_root=None
 for variant in first['proyecto']['variantes']:
  b,errors=load(project,variant)
  if errors:raise SystemExit(errors)
  root=output(b);reports.append(json.loads((root/'escena.informe.json').read_text()))
  if base_root is None:base_root=root
  for required in ('final/recorrido.mp4','final/ffprobe.json','revision_visual.json','escena.blend'):
   if not (root/required).is_file():raise SystemExit('Entrega incompleta: '+str(root/required))
  def link(path):return html.escape(os.path.relpath(root/path,a.salida.parent))
  poster='final/frame_0049.png' if b['proyecto']['id']=='xixova' else 'final/frame_0001.png'
  cards.append(f'<article><h3>{html.escape(variant.capitalize())}</h3><video controls preload="metadata" poster="{link(poster)}"><source src="{link("final/recorrido.mp4")}" type="video/mp4"></video><p><a href="{link("escena.blend")}">Escena Blender</a> · <a href="{link("escena.informe.json")}">Informe de geometría</a> · <a href="{link("resuelto.json")}">Proyecto resuelto</a></p></article>')
  evidence.append({'proyecto':b['proyecto']['id'],'variante':variant,'salida':str(root),'informe':reports[-1],'video':json.loads((root/'final/ffprobe.json').read_text())})
 assert len({r['geometria_hash'] for r in reports})==1,'La arquitectura difiere entre variantes'
 plan=base_root/'planta.svg';planlink=f'<a href="{html.escape(os.path.relpath(plan,a.salida.parent))}">Planta acotada</a>' if plan.exists() else ''
 sections.append(f'<section><h2>{html.escape(first["proyecto"]["id"].upper())}</h2><p>Arquitectura idéntica en ambas propuestas. {planlink}</p><button onclick="compare(this)">Reproducir ambas desde el inicio</button><div class="grid">{"".join(cards)}</div></section>')
page='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xixova · arquitectura e interiorismo</title><style>
body{font:16px/1.55 system-ui,sans-serif;margin:0;background:#eeeae2;color:#263128}main{max-width:1180px;margin:auto;padding:40px 24px}h1{font-size:clamp(28px,4vw,46px);line-height:1.15;max-width:850px}h2{font-size:22px;margin-bottom:0}section{margin-top:48px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{min-width:0}video{width:100%;background:#18221c;border-radius:8px}a{color:#365d48}button{background:#274433;color:#fff;border:0;border-radius:6px;padding:12px 18px;cursor:pointer}small{display:block;max-width:800px}code{font-size:13px}footer{margin-top:44px;border-top:1px solid #c5c9bc;padding-top:20px}@media(max-width:700px){.grid{grid-template-columns:1fr}}
</style><main><p>XIXOVÁ / FRAMEWORK V1</p><h1>Una arquitectura. Dos propuestas de interiorismo.</h1><p>Escenas construidas desde datos, con las mismas cámaras e iluminación para comparar cada variante.</p><small>Demostración económica: 480 × 270, 12 fps, Cycles CUDA. XIXOVÁ es una migración aproximada; el estudio es sintético. Los acabados y el entorno están simplificados. Estas imágenes prueban el flujo reproducible y no certifican fidelidad al inmueble ni calidad comercial.</small>'''+''.join(sections)+'''<footer><p>Pruebas: 21 del núcleo + 5 del pipeline histórico. Auditoría de las cuatro escenas, arquitectura idéntica entre variantes y reanudación tras interrupción verificada.</p><a href="evidencia.json">Datos de esta entrega</a></footer></main><script>function compare(button){const videos=button.parentElement.querySelectorAll('video');for(const video of videos){video.currentTime=0;video.play().catch(()=>{});}}</script></html>'''
a.salida.write_text(page);(a.salida.parent/'evidencia.json').write_text(json.dumps(evidence,indent=2,ensure_ascii=False)+'\n');print(a.salida)
