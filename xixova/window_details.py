"""Regenerable window dressing; never modifies the architectural mesh."""
import math
import bpy

def inside(x,y,points):
    result=False
    for a,b in zip(points,points[1:]+points[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
    return result

def build_windows(data,collection,box,material):
    config=data['presentacion'].get('detalles_ventanas',{})
    if not config.get('activo'):return
    fabric=material('Cortina/visillo',{'color':[.82,.8,.75],'rugosidad':.85})
    nodes,links=fabric.node_tree.nodes,fabric.node_tree.links
    shader=nodes.get('Principled BSDF');shader.inputs['Sheen Weight'].default_value=.3
    translucent=nodes.new('ShaderNodeBsdfTranslucent');translucent.inputs[0].default_value=(.8,.78,.73,1)
    mix=nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.55
    links.new(shader.outputs[0],mix.inputs[1]);links.new(translucent.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],nodes.get('Material Output').inputs['Surface'])
    stone=material('Alfeizar/piedra',{'color':[.62,.59,.53],'rugosidad':.35})
    arch=data['arquitectura']
    for wall in arch['paredes']:
        dx,dy=wall['b'][0]-wall['a'][0],wall['b'][1]-wall['a'][1];length=math.hypot(dx,dy);ux,uy=dx/length,dy/length
        for opening in wall['aberturas']:
            if opening['tipo']!='ventana':continue
            center=opening['distancia']+opening['ancho']/2
            x,y=wall['a'][0]+ux*center,wall['a'][1]+uy*center
            side=1 if any(r.get('cubierto',True) and inside(x-uy*.3,y+ux*.3,r['contorno']) for r in arch['espacios']) else -1
            nx,ny=-uy*side,ux*side;offset=wall['espesor']/2+.09
            sill=box(collection,opening['id']+':alfeizar',(x+nx*.04,y+ny*.04,max(.025,opening['antepecho'])),(opening['ancho']+.05,wall['espesor']+.13,.035),stone,math.atan2(dy,dx),.004)
            sill['xixova_regenerable']=True
            width=opening['ancho']*config.get('cobertura_lateral',.2)
            for edge in (-1,1):
                verts=[];faces=[];segments=max(24,round(width/.012));top=min(wall['altura']-.08,opening['alto']+opening['antepecho']+.12);bottom=.05
                for z in (bottom,top):
                    for k in range(segments+1):
                        along=opening['distancia']+(k/segments*width if edge==-1 else opening['ancho']-width+k/segments*width)
                        fold=.024*math.sin(k/segments*width/.065*2*math.pi)
                        verts.append((wall['a'][0]+ux*along+nx*(offset+fold),wall['a'][1]+uy*along+ny*(offset+fold),z))
                for k in range(segments):faces.append((k,k+1,k+segments+2,k+segments+1))
                mesh=bpy.data.meshes.new('visillo');mesh.from_pydata(verts,[],faces);mesh.update()
                uv=mesh.uv_layers.new(name='UVMap')
                row=segments+1
                for loop in mesh.loops:
                    vertex=loop.vertex_index;uv.data[loop.index].uv=((vertex%row)/segments,vertex//row)
                obj=bpy.data.objects.new(opening['id']+':cortina:'+str(edge),mesh);collection.objects.link(obj);mesh.materials.append(fabric)
                for face in mesh.polygons:face.use_smooth=True
                solid=obj.modifiers.new('Espesor textil','SOLIDIFY');solid.thickness=.0005
                obj['xixova_id']=obj.name;obj['xixova_capa']=collection.name;obj['xixova_regenerable']=True;obj['xixova_pared']=wall['id']
