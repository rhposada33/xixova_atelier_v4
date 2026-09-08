import copy, unittest
from pathlib import Path
from xixova.core import load
from xixova.realism_compiler import compile_bundle, compact_report, room_kind

REPO=Path(__file__).resolve().parents[2]
class RealismCompilerTests(unittest.TestCase):
    def setUp(self): self.bundle,_=load(REPO/'proyectos/apartamento_compacto/proyecto.yaml')
    def test_deterministic_and_architecture_immutable(self):
        architecture=copy.deepcopy(self.bundle['arquitectura']); a,ra=compile_bundle(self.bundle); b,rb=compile_bundle(self.bundle)
        self.assertEqual(ra['hash_compilado'],rb['hash_compilado']); self.assertEqual(a['arquitectura'],architecture)
    def test_all_rooms_classified(self):
        self.assertEqual(room_kind('dormitorio_principal'),'dormitorio'); self.assertEqual(room_kind('social'),'sala')
    def test_compact_report_under_four_kb(self):
        _,report=compile_bundle(self.bundle); compact=compact_report(report)
        self.assertLess(compact['bytes'],4096)
    def test_camera_ranges(self):
        compiled,_=compile_bundle(self.bundle)
        self.assertTrue(all(24<=x['lente']<=70 for x in compiled['presentacion']['tomas']))
