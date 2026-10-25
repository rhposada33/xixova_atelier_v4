#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$REPO_ROOT/xixova/maquette_web"
OUTPUT_DIR="$REPO_ROOT/publicaciones/catalogo_xixova_staging"
EXPECTED_OUTPUT="$REPO_ROOT/publicaciones/catalogo_xixova_staging"
ENV_FILE="${ESCOBAR_STAGING_ENV_FILE:-$REPO_ROOT/.env.staging.local}"
STAGING_REF="kihyogedhwvzmewceqjg"
STAGING_URL="https://$STAGING_REF.supabase.co"
PRODUCTION_REFS=("fdguwfmrpvemxqutyupn" "fdquwfmrpvemxqutyupn")

if [[ $# -ne 0 ]]; then
  echo "Este pipeline no acepta argumentos ni opciones de producción." >&2
  exit 1
fi
if [[ "$OUTPUT_DIR" != "$EXPECTED_OUTPUT" || "$OUTPUT_DIR" == "/" || "$OUTPUT_DIR" == "$REPO_ROOT" ]]; then
  echo "Ruta de staging inesperada; se cancela el build." >&2
  exit 1
fi
if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
  echo "El pipeline de staging exige un árbol Git limpio." >&2
  exit 1
fi

tracked_index_backup="$(mktemp)"
cp "$WEB_DIR/dist/index.html" "$tracked_index_backup"
restore_tracked_index() {
  cp "$tracked_index_backup" "$WEB_DIR/dist/index.html"
  rm -f "$tracked_index_backup"
}
trap restore_tracked_index EXIT

"$REPO_ROOT/scripts/assert-supabase-target" staging "$STAGING_REF"

if [[ -f "$ENV_FILE" ]]; then
  while IFS='=' read -r name value; do
    [[ -z "$name" || "$name" == \#* ]] && continue
    case "$name" in
      VITE_INVENTORY_PROVIDER|VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY|VITE_APP_ENV) export "$name=$value" ;;
      *) echo "Variable no permitida en el archivo de staging: $name" >&2; exit 1 ;;
    esac
  done < "$ENV_FILE"
fi

: "${VITE_INVENTORY_PROVIDER:?Falta VITE_INVENTORY_PROVIDER}"
: "${VITE_SUPABASE_URL:?Falta VITE_SUPABASE_URL}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?Falta VITE_SUPABASE_PUBLISHABLE_KEY}"
: "${VITE_APP_ENV:?Falta VITE_APP_ENV}"
[[ "$VITE_INVENTORY_PROVIDER" == "supabase" ]] || { echo "El proveedor debe ser supabase." >&2; exit 1; }
[[ "$VITE_APP_ENV" == "staging" ]] || { echo "VITE_APP_ENV debe ser staging." >&2; exit 1; }
[[ "$VITE_SUPABASE_URL" == "$STAGING_URL" ]] || { echo "La URL de Supabase no pertenece al staging autorizado." >&2; exit 1; }
[[ "$VITE_SUPABASE_PUBLISHABLE_KEY" == sb_publishable_* || "$VITE_SUPABASE_PUBLISHABLE_KEY" == eyJ* ]] || { echo "La clave pública no tiene un formato reconocido." >&2; exit 1; }
for blocked_ref in "${PRODUCTION_REFS[@]}"; do
  [[ "$VITE_SUPABASE_URL" != *"$blocked_ref"* ]] || { echo "Referencia de producción bloqueada." >&2; exit 1; }
done

cd "$WEB_DIR"
PYTHONPATH="$REPO_ROOT" python3 "$REPO_ROOT/scripts/check_demo_buildings.py"
npm ci
npm run test:unit
npm run lint
VITE_E2E_PUBLIC_DIR="$WEB_DIR/public" npm run build

cd "$REPO_ROOT"
uv run xixova_cli.py exportar-catalogo --catalogo-config catalogo.yaml --salida "$OUTPUT_DIR" --perfil premium
install -m 0644 "$REPO_ROOT/vercel.json" "$OUTPUT_DIR/vercel.json"

test -s "$OUTPUT_DIR/index.html"
test -s "$OUTPUT_DIR/vercel.json"
test -s "$OUTPUT_DIR/building/xixova-building.glb"
test -s "$OUTPUT_DIR/projects/garden_house_18/manifest.json"
test -s "$OUTPUT_DIR/projects/terraza_luz/manifest.json"
find "$OUTPUT_DIR/assets" -maxdepth 1 -type f -name 'PortalApp-*.js' -print -quit | grep -q .
if find "$OUTPUT_DIR" -type f \( -name '.env*' -o -name '*.sql' -o -name '*.map' -o -name '*test*' \) -print -quit | grep -q .; then
  echo "El artefacto contiene archivos excluidos." >&2; exit 1
fi
if rg -l --hidden --glob '!*.png' --glob '!*.jpg' --glob '!*.glb' 'fdguwfmrpvemxqutyupn|fdquwfmrpvemxqutyupn|service_role|sb_secret_|postgres(ql)?://|/home/rafa|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' "$OUTPUT_DIR" | grep -q .; then
  echo "El artefacto contiene una referencia bloqueada o un posible secreto." >&2; exit 1
fi
rg -l "$STAGING_REF" "$OUTPUT_DIR/assets"/*.js >/dev/null

MANIFEST_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/escobar-backups/manifests"
mkdir -p "$MANIFEST_DIR"
chmod 700 "$MANIFEST_DIR"
MANIFEST_FILE="$MANIFEST_DIR/catalogo_xixova_staging-manifest.json"
commit="$(git -C "$REPO_ROOT" rev-parse HEAD)"
built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
index_hash="$(sha256sum "$OUTPUT_DIR/index.html" | cut -d' ' -f1)"
glb_hash="$(sha256sum "$OUTPUT_DIR/building/xixova-building.glb" | cut -d' ' -f1)"
file_count="$(find "$OUTPUT_DIR" -type f | wc -l | tr -d ' ')"
total_bytes="$(du -sb "$OUTPUT_DIR" | cut -f1)"
bundles="$(find "$OUTPUT_DIR/assets" -maxdepth 1 -type f \( -name '*.js' -o -name '*.css' \) -print0 | sort -z | xargs -0 sha256sum | jq -Rn '[inputs | capture("^(?<sha256>[0-9a-f]+)  (?<path>.+)$") | {file:(.path|split("/")|last),sha256}]')"
jq -n --arg commit "$commit" --arg builtAt "$built_at" --arg ref "$STAGING_REF" --arg indexHash "$index_hash" --arg glbHash "$glb_hash" --argjson fileCount "$file_count" --argjson totalBytes "$total_bytes" --argjson bundles "$bundles" '{schema:1,environment:"staging",projectRef:$ref,commit:$commit,gitClean:true,builtAtUtc:$builtAt,indexSha256:$indexHash,buildingGlbSha256:$glbHash,fileCount:$fileCount,totalBytes:$totalBytes,bundles:$bundles}' > "$MANIFEST_FILE"
chmod 600 "$MANIFEST_FILE"
test -s "$MANIFEST_FILE"
echo "Artefacto staging preparado en $OUTPUT_DIR"
echo "Manifiesto privado preparado en $MANIFEST_FILE"
