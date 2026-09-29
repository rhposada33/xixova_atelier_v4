#!/usr/bin/env python3
"""Genera el apartamento compacto inferido del plano aportado por el usuario."""
import hashlib
import json
from pathlib import Path

import yaml

ROOT=Path(__file__).resolve().parents[1]; DEST=ROOT/'proyectos'/'apartamento_compacto'; ASSETS=ROOT/'cache'/'framework'/'activos'

def save(name,value):
    DEST.mkdir(parents=True,exist_ok=True); (DEST/name).write_text(yaml.safe_dump(value,sort_keys=False,allow_unicode=True),encoding='utf-8')
def room(identifier,x0,y0,x1,y1): return {'id':identifier,'contorno':[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],'altura':2.7}
def opening(identifier,kind,distance,width,height=2.15,sill=0): return {'id':identifier,'tipo':kind,'distancia':distance,'ancho':width,'alto':height,'antepecho':sill}
def wall(identifier,a,b,openings=(),thickness=.12): return {'id':identifier,'a':a,'b':b,'espesor':thickness,'altura':2.7,'aberturas':list(openings)}
def item(identifier,asset,space,position,rotation=0,scale=1): return {'id':identifier,'activo':asset,'espacio':space,'colocacion':{'tipo':'explicita','posicion':position,'rotacion':rotation},'escala':scale}
def shot(identifier,lens,start,target,end,target_end=None): return {'id':identifier,'lente':lens,'fotogramas':80,'puntos':[{'posicion':start,'objetivo':target},{'posicion':end,'objetivo':target_end or target}]}

def main():
    catalog=json.loads((ASSETS/'catalogo.json').read_text(encoding='utf-8'))
    for asset in catalog['activos']: asset['archivo']=str((ASSETS/(asset['id']+'.blend')).resolve())
    save('catalogo.yaml',catalog)
    architecture={
      'schema':1,'id':'apartamento_compacto','version':'0.1-borrador','unidades':'m',
      'fuentes':[{'archivo':'plano_usuario_2026-09-07.png','descripcion':'Planta amueblada sin cotas; referencia visual aportada en conversación.'}],
      'cota_referencia':{'valor_m':1.6,'descripcion':'Ancho de la cama derecha confirmado por el usuario como 1,60 m.','fiable':True},
      'dudas':['Medidas y espesores inferidos de una imagen en perspectiva; requieren una segunda cota para precisión constructiva.','Puertas, ventanas y aparatos sanitarios se simplifican como huecos rectangulares y activos compuestos.','La pieza curva de la esquina superior derecha se interpreta como mobiliario fijo y no como geometría arquitectónica.'],
      'espacios':[room('bano_social',0,0,2.4,2.15),room('dormitorio_izquierdo',0,2.15,2.4,6.15),room('circulacion',2.4,0,4.1,3.3),room('bano_central',4.1,1.4,7.55,3.3),room('social',2.4,3.3,7.55,7.5),room('dormitorio_derecho',7.55,3.3,10.75,6.15)],
      'paredes':[
        wall('fachada_oeste',[0,0],[0,6.15]),wall('fachada_sur',[0,0],[4.1,0],[opening('entrada','puerta',3.18,.82)]),
        wall('fachada_norte_izq',[0,6.15],[2.4,6.15],[opening('ventana_dorm_izq','ventana',.45,1.5,1.25,1.0)]),
        wall('eje_izquierdo',[2.4,0],[2.4,7.5],[opening('puerta_bano_social','puerta',1.05,.75),opening('puerta_dorm_izq','puerta',2.55,.8)]),
        wall('division_izquierda',[0,2.15],[2.4,2.15]),wall('fachada_norte_social',[2.4,7.5],[7.55,7.5],[opening('ventana_social_1','ventana',.9,1.1,1.25,1.0),opening('ventana_social_2','ventana',2.8,1.1,1.25,1.0)]),
        wall('bano_central_sur',[4.1,1.4],[7.55,1.4]),wall('bano_central_oeste',[4.1,1.4],[4.1,3.3],[opening('puerta_bano_central','puerta',.45,.75)]),
        wall('bano_central_norte',[4.1,3.3],[7.55,3.3]),wall('bano_central_este',[7.55,1.4],[7.55,3.3]),
        wall('separacion_social_derecha',[7.55,3.3],[7.55,7.5],[opening('puerta_dorm_derecho','puerta',.35,.82)]),
        wall('fachada_dorm_derecho_sur',[7.55,3.3],[10.75,3.3]),wall('fachada_dorm_derecho_este',[10.75,3.3],[10.75,6.15]),
        wall('fachada_dorm_derecho_norte',[7.55,6.15],[10.75,6.15],[opening('ventana_dorm_der','ventana',.8,1.55,1.25,1.0)]),
        wall('fachada_social_este',[7.55,6.15],[7.55,7.5]),wall('circulacion_este',[4.1,0],[4.1,1.4])],
      'pilares':[],
      'instalaciones':[{'id':'agua_bano_social','tipo':'agua','posicion':[1.3,.7,.5]},{'id':'agua_bano_central','tipo':'agua','posicion':[5.5,1.6,.5]},{'id':'agua_cocina','tipo':'agua','posicion':[7.35,6.4,.6]}]}
    save('arquitectura.yaml',architecture); architecture_hash=hashlib.sha256(json.dumps(architecture,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    furniture=[item('cama_izquierda','XVA3_Cama_doble','dormitorio_izquierdo',[1.2,4.55,0],0,.94),item('cama_derecha','XVA3_Cama_doble','dormitorio_derecho',[9.18,4.65,0],0,.96),item('mesita_derecha','XVA3_Mesita_L','dormitorio_derecho',[8.05,5.45,0],0,.9),item('sofa_social','sofa_recto','social',[4.55,5.55,0],90,.95),item('mesa_social','mesa_centro','social',[3.55,5.65,0],0,.95),item('comedor_social','comedor','social',[5.8,5.55,0],90,.62),item('cocina_lineal','XVA3_Cocina_premium','social',[7.08,6.0,0],90,.62),item('bano_social_equipo','XVA3_Bano_principal','bano_social',[1.2,1.05,0],0,.82),item('bano_central_equipo','XVA3_Bano_principal','bano_central',[5.75,2.25,0],90,.82)]
    materials={'pared_lino':{'color':[.72,.68,.65],'rugosidad':.75},'roble_claro':{'color':[.55,.38,.2],'rugosidad':.48},'baldosa':{'color':[.72,.72,.7],'rugosidad':.42},'techo':{'color':[.84,.83,.8],'rugosidad':.82}}
    finishes={wall_spec['id']:'pared_lino' for wall_spec in architecture['paredes']}
    for value in architecture['espacios']:
        finishes[value['id']+':piso']='baldosa' if value['id'].startswith('bano') else 'roble_claro'; finishes[value['id']+':techo']='techo'
    save('natural_lila.yaml',{'schema':1,'id':'natural_lila','arquitectura':{'id':architecture['id'],'version':architecture['version'],'hash':architecture_hash},'materiales':materials,'acabados':finishes,'elementos':furniture})
    presentation={'schema':1,'exposicion':.15,'entorno':{'color':[.64,.76,.9],'intensidad':.65},'luces':[
      {'id':'luz_social','posicion':[4.8,5.8,2.55],'objetivo':[4.8,5.6,.8],'potencia':520,'tamano':1.8,'color':[1,.88,.74]},
      {'id':'luz_dorm_izq','posicion':[1.2,4.5,2.5],'objetivo':[1.2,4.5,.7],'potencia':260,'tamano':1.1,'color':[1,.86,.72]},
      {'id':'luz_dorm_der','posicion':[9.1,4.7,2.5],'objetivo':[9.1,4.7,.7],'potencia':280,'tamano':1.1,'color':[1,.86,.72]},
      {'id':'luz_banos','posicion':[4.0,2.0,2.5],'objetivo':[3.5,1.5,.7],'potencia':300,'tamano':1.3,'color':[1,.9,.8]}],
      'tomas':[shot('sala',26,[2.75,4.0,1.55],[4.55,5.55,.85],[6.8,4.0,1.58]),shot('cocina_comedor',27,[5.0,6.95,1.58],[6.55,5.85,.9],[3.0,6.9,1.55]),shot('dormitorio_derecho',25,[7.85,4.0,1.52],[9.2,4.75,.82],[8.0,5.8,1.55]),shot('dormitorio_izquierdo',25,[2.05,5.82,1.52],[1.2,4.55,.8],[.35,5.82,1.55]),shot('bano_central',24,[4.42,1.55,1.5],[5.75,2.25,.8],[7.2,1.55,1.5]),shot('acceso',27,[3.55,.38,1.55],[3.25,3.65,1.0],[2.72,2.9,1.55]) ]}
    save('presentacion.yaml',presentation)
    project={'schema':1,'id':'apartamento_compacto','arquitectura':'arquitectura.yaml','variantes':{'natural_lila':'natural_lila.yaml'},'presentacion':'presentacion.yaml','produccion':{'catalogo':'catalogo.yaml','blender':'~/Aplicaciones/blender-4.5/blender','salidas':'../../resultados/framework','fps':24,'gpu_vram_gb':6,'ram_gb':16,'licencias_permitidas':['propia','CC0','CC Attribution'],'perfiles':{'previa':{'resolucion':[640,360],'muestras':12,'motor':'CYCLES','denoise':True},'animatica':{'resolucion':[480,270],'muestras':1,'motor':'BLENDER_WORKBENCH','denoise':False,'crf':20,'preset':'medium'},'final':{'resolucion':[746,420],'muestras':32,'motor':'CYCLES','denoise':True,'crf':18,'preset':'slow'}}}}
    save('proyecto.yaml',project)

if __name__=='__main__': main()
