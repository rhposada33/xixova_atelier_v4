#!/usr/bin/env bash
set -euo pipefail
ATELIER_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ATELIER_BLENDER="${BLENDER_BIN:-$HOME/Aplicaciones/blender-4.5/blender}"
if [[ ! -x "$ATELIER_BLENDER" ]]; then
  if command -v blender >/dev/null 2>&1; then ATELIER_BLENDER="$(command -v blender)";
  else echo 'No encuentro Blender. Indica BLENDER_BIN=/ruta/blender bash ejecutar.sh'; exit 1; fi
fi
exec "$ATELIER_BLENDER" --background --factory-startup --python-exit-code 1 --python "$ATELIER_DIR/atelier.py" -- "$@"
