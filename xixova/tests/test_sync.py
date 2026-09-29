import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import yaml
from xixova.core import camera_frames, load, resolve
from xixova.sync import prepare, synchronize

ROOT = Path(__file__).resolve().parents[2]


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        source = ROOT/'proyectos/estudio'
        for filename in source.glob('*.yaml'):
            (self.directory/filename.name).write_bytes(filename.read_bytes())
        catalog = yaml.safe_load((self.directory/'catalogo.yaml').read_text())
        for asset in catalog['activos']:
            asset['archivo'] = __file__  # Core tests do not require binary assets.
        (self.directory/'catalogo.yaml').write_text(yaml.safe_dump(catalog))
        self.path = self.directory/'proyecto.yaml'
        self.b, errors = load(self.path, 'calida')
        self.assertEqual(errors, [])
        elements, _ = resolve(self.b)
        p = self.b['presentacion']
        state = dict(protegido='unchanged',
                     elementos={v['id']: dict(posicion=v['posicion'], rotacion=v['rotacion'], escala=v.get('escala', 1)) for v in elements},
                     materiales=copy.deepcopy(self.b['interiorismo']['materiales']),
                     luces={v['id']: {k: x for k, x in v.items() if k != 'id'} for v in p['luces']},
                     tomas={}, exposicion=p['exposicion'], entorno=p['entorno'])
        for shot in p['tomas']:
            state['tomas'][shot['id']] = dict(lente=shot['lente'], puntos=[dict(posicion=pos, objetivo=target)
                for id, _, pos, target in camera_frames(p) if id == shot['id']])
        self.capture = dict(schema=1, fuentes=self.b['sincronizacion'], base=state, actual=copy.deepcopy(state))

    def test_noop_keeps_anchors_and_does_not_write(self):
        before = self.path.read_bytes()
        report = synchronize(self.path, 'calida', self.capture, True)
        self.assertTrue(report['ok'])
        self.assertFalse(report['aplicado'])
        self.assertEqual(self.path.read_bytes(), before)
        self.assertFalse((self.directory/'sincronizados').exists())

    def test_preview_does_not_write(self):
        self.capture['actual']['exposicion'] += .2
        report = synchronize(self.path, 'calida', self.capture)
        self.assertEqual(len(report['cambios']), 1)
        self.assertFalse((self.directory/'sincronizados').exists())

    def test_move_parent_keeps_unmoved_anchored_child(self):
        self.capture['actual']['elementos']['sofa']['posicion'][0] += .1
        plan, errors = prepare(self.b, self.capture)
        self.assertFalse(errors)
        resolved, _ = resolve(plan['bundle'])
        for item in resolved:
            self.assertAlmostEqual(item['posicion'][0], self.capture['actual']['elementos'][item['id']]['posicion'][0])
        table = next(x for x in plan['bundle']['interiorismo']['elementos'] if x['id']=='mesa')
        self.assertEqual(table['colocacion']['tipo'], 'explicita')

    def test_conflict_rejects_stale_capture(self):
        self.path.write_text(self.path.read_text()+'\n# concurrent edit\n')
        report = synchronize(self.path, 'calida', self.capture, True)
        self.assertFalse(report['ok'])
        self.assertEqual(report['diagnosticos'][0]['codigo'], 'SINC_CONFLICTO')

    def test_different_variant_rejected(self):
        report = synchronize(self.path, 'mineral', self.capture, True)
        self.assertFalse(report['ok'])

    def test_architecture_or_mesh_edit_rejected(self):
        self.capture['actual']['protegido'] = 'modified'
        _, errors = prepare(self.b, self.capture)
        self.assertEqual(errors[0]['codigo'], 'SINC_NO_REPRESENTABLE')

    def test_missing_element_rejected(self):
        self.capture['actual']['elementos'].pop('sofa')
        _, errors = prepare(self.b, self.capture)
        self.assertTrue(errors)

    def test_collision_prevents_publication(self):
        self.capture['actual']['elementos']['mesa']['posicion'] = [1.5, 1.5, 0]
        report = synchronize(self.path, 'calida', self.capture, True)
        self.assertFalse(report['ok'])
        self.assertFalse((self.directory/'sincronizados').exists())

    def test_material_and_camera_and_light_roundtrip_isolated(self):
        other, _ = load(self.path, 'mineral')
        architecture = (self.directory/'arquitectura.yaml').read_bytes()
        self.capture['actual']['materiales']['pared']['color'] = [.4, .5, .6]
        self.capture['actual']['tomas']['estar']['lente'] = 28
        self.capture['actual']['luces']['luz_estudio']['potencia'] = 95
        self.capture['actual']['exposicion'] = .15
        report = synchronize(self.path, 'calida', self.capture, True)
        self.assertTrue(report['ok'], report)
        self.assertTrue(report['aplicado'])
        after, errors = load(self.path, 'calida')
        self.assertFalse(errors)
        self.assertEqual(after['interiorismo']['materiales']['pared']['color'], [.4,.5,.6])
        self.assertEqual(after['presentacion']['tomas'][0]['lente'], 28)
        unchanged, _ = load(self.path, 'mineral')
        self.assertEqual(unchanged['presentacion'], other['presentacion'])
        self.assertEqual(unchanged['interiorismo'], other['interiorismo'])
        self.assertEqual(architecture, (self.directory/'arquitectura.yaml').read_bytes())
        self.assertEqual(unchanged['arquitectura_hash'], after['arquitectura_hash'])
        # The old scene cannot overwrite the new revision a second time.
        self.assertFalse(synchronize(self.path, 'calida', self.capture, True)['ok'])

    def test_interruption_before_manifest_replace_keeps_old_project(self):
        original = self.path.read_bytes()
        self.capture['actual']['exposicion'] += .1
        with patch('xixova.sync.os.replace', side_effect=OSError('disk failure')):
            with self.assertRaises(OSError):
                synchronize(self.path, 'calida', self.capture, True)
        self.assertEqual(original, self.path.read_bytes())
        current, errors = load(self.path, 'calida')
        self.assertFalse(errors)
        self.assertEqual(current['presentacion'], self.b['presentacion'])

    def test_nonfinite_value_rejected(self):
        self.capture['actual']['exposicion'] = float('nan')
        _, errors = prepare(self.b, self.capture)
        self.assertTrue(errors)

if __name__ == '__main__':
    unittest.main()
