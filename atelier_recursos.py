"""Recursos CC0 descargados en el equipo del usuario. No usa claves de BlenderKit."""
import json
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse, unquote, urljoin
import polyhaven_base as P

ROOT = Path(__file__).resolve().parent
P.CACHE = ROOT / 'cache'


def safe_path(root, uri):
    parsed = urlparse(uri)
    rel = PurePosixPath(unquote(parsed.path))
    if parsed.scheme or parsed.netloc or rel.is_absolute() or '..' in rel.parts or '\\' in str(rel):
        raise ValueError('Ruta externa o insegura en glTF: '+uri)
    path = (root / str(rel)).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Dependencia fuera de la carpeta del modelo')
    return path


def plant_download():
    asset = 'potted_plant_01'
    tree = P.file_tree(asset)
    desc = P.pick(tree, ['gltf'], '2k', ['gltf', 'glb'])
    root = P.CACHE / asset
    main = root / Path(urlparse(desc['url']).path).name
    P.download(desc['url'], main, desc.get('size'), desc.get('md5'))
    if main.suffix.lower() == '.glb':
        return main
    data = json.loads(main.read_text())
    include = desc.get('include', {})
    if not isinstance(include, dict):
        include = {}
    for item in data.get('buffers', []) + data.get('images', []):
        uri = item.get('uri', '')
        if not uri or uri.startswith('data:'):
            continue
        dest = safe_path(root, uri)
        meta = include.get(uri) or include.get(unquote(uri))
        if not meta:
            matches = [v for k,v in include.items() if PurePosixPath(k).name == PurePosixPath(uri).name]
            meta = matches[0] if len(matches) == 1 else {}
        if isinstance(meta, str):
            meta = {'url': meta}
        P.download(meta.get('url', urljoin(desc['url'], uri)), dest, meta.get('size'), meta.get('md5'))
    return main


def prepare(sofa, plant=None, hdri=None):
    if not sofa.is_file():
        raise RuntimeError('Falta el sofa de BlenderKit. Sigue PASO 1 de LEEME.md; guarda sofa.blend dentro de recursos_locales, o usa --sofa /ruta/modelo.blend.')
    if sofa.suffix.lower() not in ('.blend', '.glb', '.gltf'):
        raise RuntimeError('El sofa debe ser .blend, .glb o .gltf')
    plant = plant or plant_download()
    if hdri is None:
        desc = P.pick(P.file_tree('sunset_jhbcentral'), ['hdri'], '4k', ['hdr', 'exr'])
        hdri = Path(P.fetch_leaf('sunset_jhbcentral', 'entorno', desc, '4k')['archivo'])
    for path in (plant, hdri):
        if not path.is_file():
            raise RuntimeError('No existe el recurso: '+str(path))
    manifest = {
        'sofa': {'archivo':str(sofa), 'sha256':P.digest(sofa),
                 'nota':'Archivo local del usuario. Modelo recomendado: White Sofa / ibotpl; comprueba la licencia si escoges otro.',
                 'fuente_recomendada':'https://www.blendkit.com/asset-gallery-detail/c4f39c4a-099e-4d44-908d-49b60ed6d138/'},
        'planta': {'archivo':str(plant), 'sha256':P.digest(plant),
                   'fuente':'https://polyhaven.com/a/potted_plant_01', 'licencia':'CC0 si se usa la descarga automatica'},
        'hdri': {'archivo':str(hdri), 'sha256':P.digest(hdri),
                 'fuente':'https://polyhaven.com/a/sunset_jhbcentral', 'licencia':'CC0 si se usa la descarga automatica'},
        'exterior':'Fotografia envolvente conceptual; no es la vista real del XIXOVA ni tiene paralaje 3D.'}
    return manifest
