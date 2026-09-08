import copy
import json
import tempfile
import unittest
from pathlib import Path

from xixova.agent import agent_context, apply_operations, context_delta, publish_operations
from xixova.core import load, validate


REPO = Path(__file__).resolve().parents[2]


class AgentInterfaceTests(unittest.TestCase):
    def setUp(self):
        self.bundle, errors = load(REPO/'proyectos/estudio/proyecto.yaml', 'calida')
        self.assertFalse(errors)
        for asset in self.bundle['catalogo']['activos']:
            asset['archivo'] = __file__

    def request(self, operation):
        return {'schema': 1, 'arquitectura_hash': self.bundle['arquitectura_hash'],
                'operaciones': [operation]}

    def test_context_is_compact_and_has_no_expanded_frames(self):
        context = agent_context(self.bundle, [], Path('/tmp/result'))
        encoded = json.dumps(context, ensure_ascii=False)
        self.assertLess(len(encoded.encode()), 8192)
        self.assertNotIn('fotogramas_resueltos', encoded)
        self.assertNotIn('resueltos', context)
        self.assertEqual(context['arquitectura']['hash'], self.bundle['arquitectura_hash'])

    def test_context_delta_omits_unchanged_sections(self):
        context = agent_context(self.bundle, [], Path('/tmp/result'))
        delta = context_delta(context, context)
        self.assertEqual(delta['cambios'], [])
        self.assertNotIn('arquitectura', delta)
        self.assertNotIn('interiorismo', delta)

    def test_move_changes_only_interior_design(self):
        before_presentation = copy.deepcopy(self.bundle['presentacion'])
        updated, changes, layers, issues, variant = apply_operations(self.bundle, self.request({
            'accion': 'mover_elemento', 'elemento': 'sofa',
            'colocacion': {'tipo': 'explicita', 'posicion': [1.55, 1.5, 0], 'rotacion': 0}}))
        self.assertFalse(issues)
        self.assertEqual(layers, ['interiorismo'])
        self.assertEqual(updated['presentacion'], before_presentation)
        self.assertEqual(changes[0]['elemento'], 'sofa')
        self.assertIsNone(variant)

    def test_light_changes_only_presentation(self):
        before_interior = copy.deepcopy(self.bundle['interiorismo'])
        light = self.bundle['presentacion']['luces'][0]
        updated, _, layers, issues, _ = apply_operations(self.bundle, self.request({
            'accion': 'ajustar_luz', 'luz': light['id'], 'cambios': {'potencia': light['potencia']+1}}))
        self.assertFalse(issues)
        self.assertEqual(layers, ['presentacion'])
        self.assertEqual(updated['interiorismo'], before_interior)

    def test_publication_writes_only_responsible_document(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('proyecto.yaml', 'calida.yaml', 'presentacion.yaml'):
                (root/name).write_bytes((REPO/'proyectos/estudio'/name).read_bytes())
            bundle = copy.deepcopy(self.bundle); bundle['archivo'] = str(root/'proyecto.yaml')
            bundle['sincronizacion']['variante'] = 'calida'
            project_before = (root/'proyecto.yaml').read_bytes(); presentation_before = (root/'presentacion.yaml').read_bytes()
            updated, _, layers, issues, _ = apply_operations(bundle, self.request({
                'accion': 'mover_elemento', 'elemento': 'sofa',
                'colocacion': {'tipo': 'explicita', 'posicion': [1.55, 1.5, 0], 'rotacion': 0}}))
            self.assertFalse(issues)
            self.assertEqual(publish_operations(bundle, updated, layers), [str((root/'calida.yaml').resolve())])
            self.assertEqual((root/'proyecto.yaml').read_bytes(), project_before)
            self.assertEqual((root/'presentacion.yaml').read_bytes(), presentation_before)

    def test_stale_hash_and_unknown_ids_are_rejected(self):
        stale = self.request({'accion': 'eliminar_elemento', 'elemento': 'sofa'})
        stale['arquitectura_hash'] = '0'*64
        with self.assertRaisesRegex(ValueError, 'desactualizado'):
            apply_operations(self.bundle, stale)
        with self.assertRaisesRegex(ValueError, 'inexistente'):
            apply_operations(self.bundle, self.request({'accion': 'eliminar_elemento', 'elemento': 'ausente'}))

    def test_collision_prevents_publication(self):
        updated, _, _, issues, _ = apply_operations(self.bundle, self.request({
            'accion': 'mover_elemento', 'elemento': 'sofa',
            'colocacion': copy.deepcopy(self.bundle['interiorismo']['elementos'][0]['colocacion'])}))
        self.assertIn('INTERSECCION_MUEBLES', {issue['codigo'] for issue in issues})

    def test_create_variant_writes_new_file_and_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for source in (REPO/'proyectos/estudio').glob('*.yaml'):
                (root/source.name).write_bytes(source.read_bytes())
            bundle, errors = load(root/'proyecto.yaml', 'calida')
            self.assertIsNotNone(bundle)
            self.assertEqual({error['codigo'] for error in errors}, {'RECURSO_AUSENTE'})
            for asset in bundle['catalogo']['activos']: asset['archivo'] = __file__
            updated, _, layers, issues, variant = apply_operations(bundle, {
                'schema': 1, 'arquitectura_hash': bundle['arquitectura_hash'],
                'operaciones': [{'accion': 'crear_variante', 'id': 'nueva'}]})
            self.assertFalse(issues)
            written = publish_operations(bundle, updated, layers, variant)
            self.assertEqual(len(written), 2)
            created, _ = load(root/'proyecto.yaml', 'nueva')
            self.assertEqual(created['interiorismo']['id'], 'nueva')


if __name__ == '__main__':
    unittest.main()
