import copy
import unittest
from pathlib import Path

from xixova.camera_planner import plan_cameras
from xixova.core import camera_frames, load
from xixova.core import read
from shapely.geometry import Point, Polygon

REPO = Path(__file__).resolve().parents[2]


class CameraPlannerTests(unittest.TestCase):
    def setUp(self):
        self.bundle, errors = load(REPO/'proyectos/estudio/proyecto.yaml', 'calida')
        self.assertFalse(errors)
        for asset in self.bundle['catalogo']['activos']:
            asset['archivo'] = __file__
        item = self.bundle['interiorismo']['elementos'][0]
        self.script = {
            'schema': 1,
            'duracion_segundos': 4,
            'estilo': 'inmobiliario_suave',
            'escenas': [{
                'id': 'principal', 'espacio': item['espacio'], 'mostrar': [item['id']],
                'movimiento': 'desplazamiento_lateral'
            }]
        }

    def test_plan_is_deterministic_and_uses_requested_duration(self):
        first = plan_cameras(self.bundle, self.script)
        second = plan_cameras(self.bundle, copy.deepcopy(self.script))
        self.assertEqual(first, second)
        shots, report, issues = first
        self.assertFalse(issues)
        self.assertEqual(shots[0]['fotogramas'], 4*self.bundle['proyecto']['produccion']['fps'])
        self.assertEqual(shots[0]['interpolacion'], 'suave')
        self.assertEqual(shots[0]['foco'], self.script['escenas'][0]['mostrar'][0])
        self.assertEqual(shots[0]['apertura_f'], 7.1)
        self.assertGreaterEqual(shots[0]['lente'], 28)
        self.assertGreater(report[0]['candidatos_validos'], 0)

    def test_unknown_subject_is_structured_diagnostic(self):
        self.script['escenas'][0]['mostrar'] = ['inexistente']
        _, _, issues = plan_cameras(self.bundle, self.script)
        self.assertEqual(issues[0]['codigo'], 'REFERENCIA')

    def test_smooth_interpolation_preserves_endpoints(self):
        shots, _, issues = plan_cameras(self.bundle, self.script)
        self.assertFalse(issues)
        frames = list(camera_frames({'tomas': shots}))
        self.assertEqual(frames[0][2], shots[0]['puntos'][0]['posicion'])
        self.assertEqual(frames[-1][2], shots[0]['puntos'][-1]['posicion'])

    def test_access_mode_can_place_camera_in_adjacent_room(self):
        bundle,errors=load(REPO/'proyectos/apartamento_compacto/proyecto.yaml','natural_lila')
        self.assertFalse(errors)
        script=read(REPO/'proyectos/apartamento_compacto/guion_camara.yaml')
        shots,_,issues=plan_cameras(bundle,script); self.assertFalse(issues)
        shot=next(x for x in shots if x['id']=='dormitorio_derecho')
        room=Polygon(next(x['contorno'] for x in bundle['arquitectura']['espacios'] if x['id']=='dormitorio_derecho'))
        self.assertFalse(room.covers(Point(shot['puntos'][0]['posicion'][:2])))


if __name__ == '__main__':
    unittest.main()
