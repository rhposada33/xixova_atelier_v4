# Catálogo web multi-maqueta

`catalogo.yaml` es la lista editable de proyectos. Cada maqueta conserva su propia fuente YAML y se publica mediante el mismo pipeline YAML → Blender → GLB. El frontend consume únicamente el `catalog.json` generado.

## Construcción reproducible

Desde la raíz del repositorio, con las variables públicas de producción cargadas
en el entorno:

```bash
VITE_INVENTORY_PROVIDER=supabase \
VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
bash scripts/build_catalogo_xixova.sh
```

La exportación se realiza en un directorio temporal y reemplaza la publicación anterior al terminar. Así desaparecen automáticamente los bundles con hash de compilaciones previas.
El script valida la ruta de salida, conserva el vínculo local `.vercel`, copia el
fallback SPA y falla si no se generó el chunk diferido del portal. Las variables
`VITE_*` se incorporan al JavaScript durante la compilación, no durante la
ejecución del navegador ni al subir un artefacto ya construido.

## Servir localmente

```bash
uv run xixova_cli.py servir-catalogo \
  --salida publicaciones/catalogo_xixova \
  --port 8765
```

Abra `http://127.0.0.1:8765`. Las selecciones compartibles usan `?maqueta=<id>&piso=<n>&unidad=<id>&area=<id>`.

Los comandos `exportar-maqueta` y `servir-maqueta` continúan disponibles para inspeccionar un solo proyecto. `dist/` y `publicaciones/` son artefactos regenerables y no deben versionarse.

## Pruebas

```bash
PYTHONPATH=. uv run --with pytest --with pyyaml --with jsonschema --with shapely \
  pytest -q xixova/tests/test_catalog.py
cd xixova/maquette_web
npm run test:unit
npm run test:e2e
```
