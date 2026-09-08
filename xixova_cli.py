# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml>=6,<7", "jsonschema>=4.23,<5", "shapely>=2,<3", "fastapi>=0.115,<1", "uvicorn>=0.34,<1", "websockets>=15,<16"]
# ///
from xixova.cli import main
if __name__ == '__main__':
    raise SystemExit(main())
