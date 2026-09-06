import copy
import json
import math
import tempfile
import unittest
from pathlib import Path
from xixova.core import camera_frames, contract, digest, load, resolve, validate
from xixova.cli import output, png_ok

REPO=Path(__file__).resolve().parents[2]

class FrameworkTests(unittest.TestCase):
    def setUp(self):
        self.b,errors=load(REPO/'proyectos/estudio/proyecto.yaml')
        for asset in self.b['catalogo']['activos']: asset['archivo']=__file__
        self.assertFalse(validate(self.b))

    def codes(self,b):return {e['codigo'] for e in validate(b)}

    def test_all_examples(self):
        for project in ('xixova','estudio'):
            for variant in ('calida','mineral'):
                b,errors=load(REPO/f'proyectos/{project}/proyecto.yaml',variant)
                for asset in b['catalogo']['activos']: asset['archivo']=__file__
                self.assertEqual(validate(b),[],(project,variant))

    def test_variants_keep_architecture_and_isolate_outputs(self):
        other,_=load(REPO/'proyectos/estudio/proyecto.yaml','mineral')
        for asset in other['catalogo']['activos']: asset['archivo']=__file__
        self.assertEqual(self.b['catalogo'],other['catalogo'])
        self.assertEqual(self.b['arquitectura_hash'],other['arquitectura_hash'])
        self.assertNotEqual(output(self.b),output(other))

    def test_changed_measure_invalidates_proposal(self):
        self.b['arquitectura']['paredes'][0]['altura']=2.8
        self.b['arquitectura_hash']=digest(self.b['arquitectura'])
        self.assertIn('ARQUITECTURA_CAMBIADA',self.codes(self.b))

    def test_unknown_asset(self):
        self.b['interiorismo']['elementos'][0]['activo']='ausente'
        self.assertIn('REFERENCIA',self.codes(self.b))

    def test_missing_resource(self):
        self.b['catalogo']['activos'][0]['archivo']='/missing/asset.blend'
        # First catalog entry is unused in this fixture; choose its used bed.
        self.b['interiorismo']['elementos'][0]['activo']=self.b['catalogo']['activos'][0]['id']
        self.assertIn('RECURSO_AUSENTE',self.codes(self.b))

    def test_opening_outside_wall(self):
        self.b['arquitectura']['paredes'][0]['aberturas'][0]['ancho']=20
        self.assertIn('ABERTURA_INVALIDA',self.codes(self.b))

    def test_crossed_polygon(self):
        self.b['arquitectura']['espacios'][0]['contorno']=[[0,0],[4,4],[0,4],[4,0]]
        self.assertIn('CONTORNO_INVALIDO',self.codes(self.b))

    def test_nonfinite_measure(self):
        self.b['arquitectura']['paredes'][0]['altura']=float('nan')
        self.assertTrue(contract(self.b['arquitectura'],'arquitectura'))

    def test_room_overlap(self):
        self.b['arquitectura']['espacios'].append({'id':'duplicate_room','contorno':[[1,1],[2,1],[2,2],[1,2]],'altura':2.7})
        self.assertIn('ESPACIOS_SUPERPUESTOS',self.codes(self.b))

    def test_negative_measure_contract(self):
        a=self.b['arquitectura']; a['paredes'][0]['espesor']=-1
        self.assertTrue(contract(a,'arquitectura'))

    def test_unsupported_geometry_contract(self):
        self.b['arquitectura']['paredes'][0]['curvatura']=2
        self.assertTrue(contract(self.b['arquitectura'],'arquitectura'))

    def test_cycle_reports_error(self):
        items=self.b['interiorismo']['elementos']; items[0]['colocacion']={'tipo':'objeto','referencia':items[1]['id'],'desplazamiento':[0,0,0]}; items[1]['colocacion']={'tipo':'objeto','referencia':items[0]['id'],'desplazamiento':[0,0,0]}
        _,errors=resolve(self.b); self.assertTrue(any(e['codigo']=='ANCLA_NO_RESUELTA' for e in errors))

    def test_wall_anchor_oblique(self):
        item=self.b['interiorismo']['elementos'][0]
        item['colocacion']={'tipo':'pared','referencia':'oblicua','distancia':.7,'lado':1,'separacion':.1}
        items,errors=resolve(self.b); self.assertFalse(errors)
        self.assertAlmostEqual(items[0]['rotacion'],135)
        self.assertTrue(all(math.isfinite(v) for v in items[0]['posicion']))

    def test_room_anchor(self):
        self.b['interiorismo']['elementos'][0]['colocacion']={'tipo':'espacio'}
        items,errors=resolve(self.b); self.assertFalse(errors)
        self.assertGreater(items[0]['posicion'][0],2)

    def test_object_anchor_rotates_local_offset(self):
        items,errors=resolve(self.b); self.assertFalse(errors)
        table=next(x for x in items if x['id']=='mesa')
        self.assertAlmostEqual(table['posicion'][1],2.4)

    def test_outside_room(self):
        self.b['interiorismo']['elementos'][0]['colocacion']['posicion']=[40,40,0]
        self.assertIn('FUERA_ESPACIO',self.codes(self.b))

    def test_furniture_overlap(self):
        items=self.b['interiorismo']['elementos']; items[0]['colocacion']=copy.deepcopy(items[1]['colocacion'])
        self.assertIn('INTERSECCION_MUEBLES',self.codes(self.b))

    def test_door_blockage(self):
        item=next(i for i in self.b['interiorismo']['elementos'] if i['id']=='mesa')
        item['colocacion']={'tipo':'explicita','posicion':[.9,4.6,0]}
        self.assertIn('PUERTA_BLOQUEADA',self.codes(self.b))

    def test_camera_checks_intermediate_frames(self):
        shot=self.b['presentacion']['tomas'][0]
        shot['puntos']=[{'posicion':[.45,1.5,.5],'objetivo':[3,2,1]}, {'posicion':[2.9,1.5,.5],'objetivo':[3,2,1]}]
        self.assertIn('CAMARA_OBSTRUIDA',self.codes(self.b))
        self.assertEqual(len(list(camera_frames(self.b['presentacion']))),36)

    def test_duplicate_ids(self):
        items=self.b['interiorismo']['elementos']; items[0]['id']=items[1]['id']
        self.assertIn('ID_DUPLICADO',self.codes(self.b))

    def test_truncated_png_not_reused(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'bad.png'; p.write_bytes(b'\x89PNG\r\n\x1a\n'+b'0'*500)
            self.assertFalse(png_ok(p,480,270))

if __name__=='__main__':unittest.main()
