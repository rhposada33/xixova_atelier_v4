import copy
import json
import unittest
import shutil
import tempfile
from pathlib import Path

from xixova.core import load
from xixova.director import apply_command, compile_script, context, import_legacy, sample, validate_script
from xixova.director_server import DirectorSession
from xixova.tour import PRESETS, propose_tour


ROOT=Path(__file__).resolve().parents[2]


class DirectorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle,errors=load(ROOT/'proyectos/apartamento_compacto/proyecto.yaml','natural_lila')
        assert not errors, errors

    def test_legacy_import_is_deterministic_and_valid(self):
        first=import_legacy(self.bundle); second=import_legacy(self.bundle)
        self.assertEqual(first,second)
        self.assertEqual(validate_script(first,self.bundle),[])

    def test_interpolation_and_compilation(self):
        script=import_legacy(self.bundle); track=script['pistas'][0]
        middle=(track['claves'][0]['tiempo']+track['claves'][-1]['tiempo'])/2
        self.assertEqual(len(sample(track,middle)),3)
        compiled=compile_script(self.bundle,script)
        self.assertEqual(sum(x['fotogramas'] for x in compiled['presentacion']['tomas']),round(script['duracion']*script['fps']))
        self.assertEqual(compiled['arquitectura_hash'],self.bundle['arquitectura_hash'])

    def test_compact_context_and_command_scope(self):
        script=import_legacy(self.bundle); before=copy.deepcopy(self.bundle['arquitectura'])
        updated=apply_command(script,{'accion':'change_lens','camara':script['tomas'][0]['camara'],'lente':40,'tiempo':0})
        self.assertEqual(before,self.bundle['arquitectura'])
        value=context(self.bundle,updated)
        self.assertLess(len(json.dumps(value).encode()),4096)

    def test_unknown_target_is_rejected(self):
        script=import_legacy(self.bundle); script['pistas'][0]['objetivo']='no_existe'
        self.assertTrue(any(x['codigo']=='DIRECTOR_REFERENCIA' for x in validate_script(script,self.bundle)))

    def test_script_library_lifecycle(self):
        source=ROOT/'proyectos/apartamento_compacto'
        with tempfile.TemporaryDirectory(dir=ROOT/'proyectos') as folder:
            target=Path(folder)
            for path in source.glob('*.yaml'):shutil.copy2(path,target/path.name)
            session=DirectorSession(target/'proyecto.yaml','natural_lila')
            self.assertIn('legacy_camara',{x['id'] for x in session.library()})
            identifier=session.create_script('Recorrido alternativo')
            self.assertTrue(session.draft_path(identifier).is_file())
            session.activate(identifier); self.assertEqual(session.active_id,identifier)
            session.publish(); self.assertTrue(session.script_path(identifier).is_file())
            self.assertFalse(session.dirty)
            copy_id=session.create_script('Otra versión',session.script)
            session.archive(copy_id)
            self.assertTrue((session.director_root/'archivados'/f'{copy_id}.yaml').is_file())

    def test_automatic_tour_is_deterministic_and_complete(self):
        first=propose_tour(self.bundle); second=propose_tour(self.bundle)
        self.assertEqual(first,second)
        self.assertTrue(first['ok'])
        self.assertEqual(first['areas'][0],'circulacion')
        self.assertEqual(set(first['areas']),{x['id'] for x in self.bundle['arquitectura']['espacios']})
        self.assertEqual(len(first['areas']),len(first['guion']['tomas']))
        self.assertTrue(all(3<=x['duracion']<=5 for x in first['informe']))

    def test_tour_presets_filter_areas(self):
        social=propose_tour(self.bundle,preset='zona_social')
        private=propose_tour(self.bundle,preset='zona_privada')
        self.assertEqual(social['areas'],['social'])
        self.assertNotIn('social',private['areas'])
        self.assertEqual(set(social['areas'])|set(private['areas']),{x['id'] for x in self.bundle['arquitectura']['espacios']})


if __name__=='__main__':unittest.main()
