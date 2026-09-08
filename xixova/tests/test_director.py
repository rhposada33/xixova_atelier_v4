import copy
import json
import unittest
from pathlib import Path

from xixova.core import load
from xixova.director import apply_command, compile_script, context, import_legacy, sample, validate_script


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


if __name__=='__main__':unittest.main()
