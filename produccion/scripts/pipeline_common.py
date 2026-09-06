"""Utilidades sin dependencias para scripts ejecutados dentro de Blender."""
import json
from pathlib import Path


def load_config(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def review_frames(config):
    result=[]
    for shot in config['tomas']:
        a,b=int(shot['inicio']),int(shot['fin'])
        result.extend((a,(a+b)//2,b))
    return sorted(set(result))


def assert_working_copy(filepath):
    normalized=str(Path(filepath).resolve())
    if '/originales/' in normalized:
        raise RuntimeError('Se prohíbe modificar una escena de originales')
