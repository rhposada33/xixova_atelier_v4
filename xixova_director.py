# /// script
# requires-python = ">=3.11"
# dependencies = ["fastapi>=0.115,<1", "uvicorn>=0.34,<1", "websockets>=15,<16", "pyyaml>=6,<7", "jsonschema>=4.23,<5", "shapely>=2,<3"]
# ///
import argparse
from xixova.director_server import serve
p=argparse.ArgumentParser(); p.add_argument('-p','--proyecto',required=True); p.add_argument('--variante'); p.add_argument('--port',type=int,default=8765); p.add_argument('--no-browser',action='store_true')
a=p.parse_args(); serve(a.proyecto,a.variante,port=a.port,open_browser=not a.no_browser)
