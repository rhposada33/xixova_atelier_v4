#!/usr/bin/env python3
"""Descarga únicamente mapas CC0 1K de Poly Haven y deja un manifiesto verificable."""
import argparse, hashlib, json, urllib.request
from pathlib import Path

ASSETS={
    'rough_linen': {'autor':'Rico Cilliers / colormass','escala_m':.30},
    'marble_01': {'autor':'Rob Tuytel / Poly Haven contributors','escala_m':1.50},
    'wood_floor': {'autor':'Poly Haven contributors','escala_m':2.00},
}
WANTED={'diff':'base_color','rough':'roughness','nor_gl':'normal'}

def pick(files, token):
    candidates=[]
    def walk(value):
        if isinstance(value,dict):
            if 'url' in value and token in value['url'] and ('/1k/' in value['url']): candidates.append(value)
            for child in value.values(): walk(child)
        elif isinstance(value,list):
            for child in value: walk(child)
    walk(files)
    candidates.sort(key=lambda x:(not x['url'].lower().endswith(('.jpg','.png')),len(x['url'])))
    return candidates[0] if candidates else None

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--destino',type=Path,required=True); a=ap.parse_args()
    a.destino.mkdir(parents=True,exist_ok=True); manifest={'schema':1,'licencia':'CC0','fuente':'https://polyhaven.com','recursos':[]}
    for asset,meta in ASSETS.items():
        request=urllib.request.Request(f'https://api.polyhaven.com/files/{asset}',headers={'User-Agent':'XIXOVA-Atelier/3.0 (+local Blender pipeline)'})
        files=json.load(urllib.request.urlopen(request,timeout=60))
        entry={'id':asset,'url':f'https://polyhaven.com/a/{asset}',**meta,'mapas':{}}
        folder=a.destino/asset; folder.mkdir(exist_ok=True)
        for token,role in WANTED.items():
            src=pick(files,token)
            if not src: continue
            suffix=Path(src['url']).suffix; target=folder/f'{asset}_{role}_1k{suffix}'
            if not target.exists():
                download=urllib.request.Request(src['url'],headers={'User-Agent':'XIXOVA-Atelier/3.0'})
                with urllib.request.urlopen(download,timeout=120) as response, target.open('wb') as handle: handle.write(response.read())
            digest=hashlib.sha256(target.read_bytes()).hexdigest()
            entry['mapas'][role]={'archivo':str(target.relative_to(a.destino)),'sha256':digest,'bytes':target.stat().st_size}
        manifest['recursos'].append(entry)
    (a.destino/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
    print(a.destino/'manifest.json')
if __name__=='__main__': main()
