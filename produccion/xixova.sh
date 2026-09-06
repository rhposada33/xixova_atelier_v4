#!/usr/bin/env bash
set -euo pipefail
PROD_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BLENDER_BIN="${BLENDER_BIN:-$HOME/Aplicaciones/blender-4.5/blender}"
BLEND="$PROD_DIR/trabajo/xixova_produccion.blend"
case "${1:-}" in
  copia)
    mkdir -p "$PROD_DIR/trabajo"
    cp --update=none "$PROD_DIR/originales/xixova_atelier.blend" "$BLEND"
    echo "Copia de trabajo: $BLEND"
    ;;
  configurar)
    exec "$BLENDER_BIN" --background "$BLEND" --factory-startup --python-exit-code 1 --python "$PROD_DIR/scripts/configurar_produccion.py"
    ;;
  revisar)
    exec "$BLENDER_BIN" --background "$BLEND" --factory-startup --python-exit-code 1 --python "$PROD_DIR/scripts/renderizar.py" -- --modo previa --frames "1,60,120,121,180,240,241,300,360,361,420,480"
    ;;
  animatica)
    exec "$BLENDER_BIN" --background "$BLEND" --factory-startup --python-exit-code 1 --python "$PROD_DIR/scripts/renderizar.py" -- --modo animatica
    ;;
  mp4-animatica)
    exec ffmpeg -y -framerate 24 -i "$PROD_DIR/salidas/animatica/frames/frame_%04d.png" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart "$PROD_DIR/salidas/animatica/xixova_animatica.mp4"
    ;;
  final)
    exec "$BLENDER_BIN" --background "$BLEND" --factory-startup --python-exit-code 1 --python "$PROD_DIR/scripts/renderizar.py" -- --modo final
    ;;
  mp4-final)
    exec ffmpeg -y -framerate 24 -i "$PROD_DIR/salidas/final_frames/frame_%04d.png" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart "$PROD_DIR/salidas/xixova_final.mp4"
    ;;
  *) echo "Uso: $0 {copia|configurar|revisar|animatica|mp4-animatica|final|mp4-final}"; exit 2;;
esac
