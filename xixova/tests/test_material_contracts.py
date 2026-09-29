import copy
from pathlib import Path
from xixova.core import load, validate, contract

ROOT=Path(__file__).resolve().parents[2]
def bundle():
    b,e=load(ROOT/'proyectos/garden_house/proyecto.yaml','lujo_contemporaneo')
    assert not e
    return b

def test_unknown_material_part_rejected():
    b=bundle();b['interiorismo']['elementos'][0]['materiales_partes']={'inexistente':'nogal'}
    assert any(e['codigo']=='PARTE_MATERIAL' for e in validate(b))

def test_global_and_selective_are_ambiguous():
    b=bundle();item=next(x for x in b['interiorismo']['elementos'] if x.get('materiales_partes'));item['material']='nogal'
    assert any(e['codigo']=='MATERIAL_AMBIGUO' for e in validate(b))

def test_tangent_normal_requires_uv():
    b=bundle();b['interiorismo']['materiales']['nogal']['proyeccion']='triplanar'
    assert any(e['codigo']=='NORMAL_PROYECCION' for e in validate(b))

def test_migrated_projects_preserve_originals():
    for project,variant in [('garden_house','lujo_contemporaneo'),('apartamento_compacto','natural_lila')]:
        b,e=load(ROOT/'proyectos'/project/'proyecto.yaml',variant)
        assert not e
        assert all('material' not in x for x in b['interiorismo']['elementos'])
        assert contract(b['interiorismo'],'interiorismo')==[]

def test_sun_direction_is_independent_of_wall_order():
    from xixova.realism_compiler import window_summary
    a={'espacios':[{'contorno':[[0,0],[4,0],[4,4],[0,4]],'cubierto':True}], 'paredes':[{'id':'north','a':[0,4],'b':[4,4],'aberturas':[{'id':'win','tipo':'ventana','distancia':1,'ancho':2,'alto':1}]}]}
    first=window_summary(a)[0]['direccion']
    a['paredes'][0]['a'],a['paredes'][0]['b']=a['paredes'][0]['b'],a['paredes'][0]['a']
    assert window_summary(a)[0]['direccion']==first==[0,1]
