import importlib.util
import json
import os
import struct
import tempfile
import unittest
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('pipeline',Path(__file__).parents[1]/'pipeline.py')
pipeline=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(pipeline)


class PipelineTests(unittest.TestCase):
    def test_expand_default_and_environment(self):
        os.environ.pop('XVA_TEST',None)
        self.assertTrue(pipeline.expand('${XVA_TEST:-~/demo}').endswith('/demo'))
        os.environ['XVA_TEST']='/tmp/custom'
        self.assertEqual(pipeline.expand('${XVA_TEST:-~/demo}'),'/tmp/custom')

    def test_current_yaml_has_contiguous_shots(self):
        config=pipeline.load(Path(__file__).parents[1]/'proyecto.yaml')
        errors,_=pipeline.validate(config)
        self.assertEqual(errors,[])
        self.assertEqual((config['tomas'][0]['inicio'],config['tomas'][-1]['fin']),(1,840))

    def test_png_validation(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'x.png'
            header=b'\x89PNG\r\n\x1a\n'+b'\0'*8+struct.pack('>II',746,420)
            p.write_bytes(header+b'0'*1100)
            self.assertTrue(pipeline.png_ok(p,746,420))
            self.assertFalse(pipeline.png_ok(p,1920,1080))

    def test_ffmpeg_command_is_h264_and_even_profile(self):
        args=pipeline.ffmpeg_args(Path('/tmp/frames'),Path('/tmp/out.mp4'),24,'final')
        self.assertIn('libx264',args)
        self.assertIn('yuv420p',args)
        self.assertEqual(args[args.index('-framerate')+1],'24')
        self.assertEqual(args[args.index('-crf')+1],'18')

    def test_catalog_has_unique_ids_and_licenses(self):
        data=json.loads((Path(__file__).parents[1]/'catalogo_activos_v3.json').read_text())
        ids=[x['id'] for x in data['activos']]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertTrue(all(x.get('licencia') for x in data['activos']))
        self.assertEqual(data['schema'],3)
        self.assertTrue(all(x['archivo'].startswith('${XIXOVA_LIBRARY_DIR}') for x in data['activos']))
        required={'triangulos','memoria_estimada_mb','miniatura','validado','hash_receta_sha256'}
        self.assertTrue(all(required.issubset(x) for x in data['activos']))
        quality={'quality_tier','lod_variants','mapas_pbr','densidad_texel_px_m','uv_validado','normales_validadas','estado_visual','tomas'}
        self.assertTrue(all(quality.issubset(x) for x in data['activos']))
        self.assertGreater(sum(x['triangulos'] for x in data['activos']),40000)


if __name__=='__main__': unittest.main()
