import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from xixova.core import contract, load
from xixova.production import compare_frames, ffmpeg_args, render_progress


REPO = Path(__file__).resolve().parents[2]


class ProductionTests(unittest.TestCase):
    def test_profiles_accept_legacy_quality_controls(self):
        bundle, errors = load(REPO/'proyectos/estudio/proyecto.yaml')
        self.assertFalse(errors)
        profile = bundle['proyecto']['produccion']['perfiles']['animatica']
        profile.update({'motor':'BLENDER_WORKBENCH','denoise':False,'umbral_adaptativo':.03,'crf':20,'preset':'medium'})
        self.assertFalse(contract(bundle['proyecto'],'proyecto'))

    def test_ffmpeg_profile_is_h264_and_configurable(self):
        command = ffmpeg_args('/tmp/frames','/tmp/out.mp4',24,{'motor':'BLENDER_WORKBENCH','preset':'medium','crf':20})
        self.assertIn('libx264',command); self.assertEqual(command[command.index('-crf')+1],'20')
        self.assertEqual(command[command.index('-preset')+1],'medium')

    def test_progress_reports_eta_from_recent_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); folder=root/'previa'; folder.mkdir()
            (folder/'render.jsonl').write_text('\n'.join(json.dumps({'estado':'ok','segundos':2}) for _ in range(3)))
            progress=render_progress(root,{'previa':{'resolucion':[10,10]}},{'previa':[1,2,3,4,5]},lambda path,w,h:path.name in {'frame_0001.png','frame_0002.png'})
            self.assertEqual(progress['previa']['completos'],2)
            self.assertEqual(progress['previa']['eta_segundos'],6)

    def test_comparison_reports_missing_and_available_pairs(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); old=root/'old'; new=root/'new'; old.mkdir(); new.mkdir()
            (old/'frame_0001.png').write_bytes(b'x'); (new/'frame_0001.png').write_bytes(b'x')
            with patch('xixova.production.subprocess.run') as run:
                report=compare_frames(old,new,root/'out',[1,2],20,10)
            self.assertEqual([row['estado'] for row in report['comparaciones']],['ok','ausente'])
            run.assert_called_once()
            self.assertTrue((root/'out'/'informe.json').is_file())


if __name__=='__main__': unittest.main()
