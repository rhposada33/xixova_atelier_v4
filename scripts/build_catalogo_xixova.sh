#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$REPO_ROOT/xixova/maquette_web"
OUTPUT_DIR="$REPO_ROOT/publicaciones/catalogo_xixova"
EXPECTED_OUTPUT="$REPO_ROOT/publicaciones/catalogo_xixova"

if [[ "$OUTPUT_DIR" != "$EXPECTED_OUTPUT" || "$OUTPUT_DIR" == "/" ]]; then
  echo "Ruta de publicación inesperada; se cancela el build." >&2
  exit 1
fi

: "${VITE_INVENTORY_PROVIDER:?Define VITE_INVENTORY_PROVIDER para el build}"
: "${VITE_SUPABASE_URL:?Define VITE_SUPABASE_URL para el build}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?Define VITE_SUPABASE_PUBLISHABLE_KEY para el build}"

if [[ "$VITE_INVENTORY_PROVIDER" != "supabase" ]]; then
  echo "VITE_INVENTORY_PROVIDER debe ser supabase para la publicación." >&2
  exit 1
fi

cd "$WEB_DIR"
npm ci
npm run build

cd "$REPO_ROOT"
uv run xixova_cli.py exportar-catalogo \
  --catalogo-config catalogo.yaml \
  --salida "$OUTPUT_DIR" \
  --perfil premium

# El exportador aporta catálogo/inventario; estos modelos mantenidos por la web
# complementan el artefacto sin duplicarlos dentro del código fuente.
install -m 0644 "$WEB_DIR/public/building/xixova-building-visual-v2.glb" "$OUTPUT_DIR/building/xixova-building-visual-v2.glb"
install -m 0644 "$WEB_DIR/public/building/xixova-building-visual-v2-asset-statistics.json" "$OUTPUT_DIR/building/xixova-building-visual-v2-asset-statistics.json"

install -m 0644 "$REPO_ROOT/vercel.json" "$OUTPUT_DIR/vercel.json"

test -s "$OUTPUT_DIR/index.html"
test -s "$OUTPUT_DIR/vercel.json"
find "$OUTPUT_DIR/assets" -maxdepth 1 -type f -name 'PortalApp-*.js' -print -quit | grep -q .

echo "Artefacto preparado en $OUTPUT_DIR"
