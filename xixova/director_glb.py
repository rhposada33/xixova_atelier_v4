"""Exportador GLB mínimo para el visor proxy, sin dependencias 3D externas."""
import json, struct

def _pad(data,byte=b' '): return data+byte*((4-len(data)%4)%4)
def make_glb(scene):
    vertices=[]; indices=[]
    def box(center,dims):
        base=len(vertices); x,y,z=center; w,d,h=dims; x0,x1=x-w/2,x+w/2; y0,y1=y-d/2,y+d/2; z0,z1=z-h/2,z+h/2
        vertices.extend([(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)])
        indices.extend(base+i for i in (0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0))
    for wall in scene['paredes']:
        ax,ay=wall['a']; bx,by=wall['b']; length=((bx-ax)**2+(by-ay)**2)**.5
        # Proxy axis-aligned conservador; el frontend dibuja la orientación exacta.
        box(((ax+bx)/2,(ay+by)/2,wall['altura']/2),(max(abs(bx-ax),wall['espesor']),max(abs(by-ay),wall['espesor']),wall['altura']))
    for item in scene['elementos']: box((item['posicion'][0],item['posicion'][1],item['posicion'][2]+item['dimensiones'][2]/2),item['dimensiones'])
    flat=[v for point in vertices for v in point]; vb=struct.pack('<'+'f'*len(flat),*flat); ib=struct.pack('<'+'I'*len(indices),*indices); binary=_pad(vb,b'\0')+_pad(ib,b'\0')
    doc={'asset':{'version':'2.0','generator':'Xixova Director'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],
      'buffers':[{'byteLength':len(binary)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(vb),'target':34962},{'buffer':0,'byteOffset':len(_pad(vb,b'\0')),'byteLength':len(ib),'target':34963}],
      'accessors':[{'bufferView':0,'componentType':5126,'count':len(vertices),'type':'VEC3','min':[min(v[i] for v in vertices) for i in range(3)],'max':[max(v[i] for v in vertices) for i in range(3)]},{'bufferView':1,'componentType':5125,'count':len(indices),'type':'SCALAR'}],
      'materials':[{'pbrMetallicRoughness':{'baseColorFactor':[.72,.68,.6,1],'roughnessFactor':.72}}],
      'meshes':[{'primitives':[{'attributes':{'POSITION':0},'indices':1,'material':0}]}]}
    js=_pad(json.dumps(doc,separators=(',',':')).encode()); total=12+8+len(js)+8+len(binary)
    return struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
