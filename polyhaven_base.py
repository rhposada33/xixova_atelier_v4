"""Descargas cacheadas para la sala. Biblioteca estandar; no requiere pip.
Powered by Poly Haven — https://polyhaven.com
Los archivos se obtienen en la computadora que ejecuta el script.
"""
import hashlib
import json
import struct
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / 'recursos'
UA = 'Rafael-Xixova-Archviz/2.0 (personal Blender project; Powered by Poly Haven)'
PH = 'https://api.polyhaven.com'
GH = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models'
TEXTURES = {
    'roble': ('white_oak_veneer', 0.50),
    'piedra': ('marble_01', 1.00),
    'pared': ('beige_wall_001', 2.00),
    'tejido': ('cotton_jersey', 0.30),
}


def digest(path, algorithm='sha256'):
    h=hashlib.new(algorithm)
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()


def download(url, dest, expected=None, md5=None):
    dest=Path(dest);dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.is_file() and dest.stat().st_size>0:
        good=not expected or dest.stat().st_size==int(expected)
        if md5:good=good and digest(dest,'md5')==md5
        if good:return dest
    host=(urlparse(url).hostname or '').lower()
    if urlparse(url).scheme!='https' or not (
        host.endswith('.polyhaven.com') or host.endswith('.polyhaven.org') or
        host in ('raw.githubusercontent.com','api.polyhaven.com')):
        raise RuntimeError('Dominio de recurso no reconocido: '+host)
    temp=dest.with_suffix(dest.suffix+'.part')
    for attempt in range(2):
        try:
            print('Descargando '+dest.name,flush=True)
            req=Request(url,headers={'User-Agent':UA})
            with urlopen(req,timeout=45) as response, temp.open('wb') as out:
                total=int(response.headers.get('Content-Length','0') or 0);written=0;last=time.monotonic()
                while True:
                    chunk=response.read(1024*1024)
                    if not chunk:break
                    out.write(chunk);written+=len(chunk)
                    if time.monotonic()-last>8:
                        print(f'  {written/1048576:.1f} MB'+(f' / {total/1048576:.1f} MB' if total else ''),flush=True)
                        last=time.monotonic()
            if expected and temp.stat().st_size!=int(expected):raise ValueError('Tamano incompleto')
            if md5 and digest(temp,'md5')!=md5:raise ValueError('Checksum incorrecto')
            temp.replace(dest);return dest
        except Exception as e:
            temp.unlink(missing_ok=True)
            if attempt:
                raise RuntimeError('No se pudo descargar '+url+'\n'+str(e)+
                    '\nRepite el comando cuando tengas conexion. Lo ya descargado se conserva.') from e
    return dest


def file_tree(asset):
    path=CACHE/'metadata'/(asset+'.json')
    download(PH+'/files/'+asset,path)
    try:return json.loads(path.read_text(encoding='utf-8'))
    except (UnicodeError,json.JSONDecodeError) as e:
        path.unlink(missing_ok=True)
        raise RuntimeError('Metadata incompleta de '+asset+'. Repite el comando para descargarla otra vez.') from e


def leaves(tree, path=()):
    if isinstance(tree,dict):
        if isinstance(tree.get('url'),str):yield path,tree
        else:
            for k,v in tree.items():yield from leaves(v,path+(str(k),))


def pick(tree, aliases, resolution, formats):
    candidates=[]
    for path,desc in leaves(tree):
        keys=[s.lower() for s in path]
        if resolution not in keys:continue
        if not any(key in aliases for key in keys):continue
        extension=Path(urlparse(desc['url']).path).suffix.lower().lstrip('.')
        if extension not in formats:continue
        candidates.append((formats.index(extension),path,desc))
    if not candidates:raise RuntimeError(f'No hay mapa {aliases} en {resolution}. Revisa metadata del recurso.')
    return min(candidates,key=lambda t:t[0])[2]


def fetch_leaf(asset,role,desc,res):
    ext=Path(urlparse(desc['url']).path).suffix
    path=CACHE/asset/(role+'_'+res+ext)
    download(desc['url'],path,desc.get('size'),desc.get('md5'))
    return {'archivo':str(path),'url':desc['url'],'sha256':digest(path)}

