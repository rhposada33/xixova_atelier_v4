# Preview aislada de staging

El pipeline de staging genera un catálogo desplegable separado de producción.
No ejecuta Vercel, no modifica Auth y no configura redirects o CORS remotos.

## Preparación local

Copiar `config/env.staging.example` a `.env.staging.local` y completar únicamente
la publishable key del proyecto staging. El archivo local está ignorado por Git.

Variables admitidas:

- `VITE_INVENTORY_PROVIDER=supabase`
- `VITE_SUPABASE_URL=https://kihyogedhwvzmewceqjg.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_ENV=staging`

Ejecutar desde la raíz:

```bash
scripts/build_catalogo_xixova_staging.sh
```

La salida se reemplaza atómicamente en
`publicaciones/catalogo_xixova_staging`. El manifiesto de hashes se conserva
fuera del artefacto en
`${XDG_DATA_HOME:-$HOME/.local/share}/escobar-backups/manifests/catalogo_xixova_staging-manifest.json`.

## Validación local

```bash
cd xixova/maquette_web
npx vite preview --config vite.config.ts --host 127.0.0.1 --port 4173 \
  --outDir ../../publicaciones/catalogo_xixova_staging
```

Comprobar `/`, `/login`, rutas protegidas, refresh y deep links. Las pruebas
autenticadas se realizan manualmente; nunca se guardan contraseñas en Playwright.

## Preview futura

Solo después de aprobar el artefacto:

```bash
vercel --cwd publicaciones/catalogo_xixova_staging
```

No usar `--prod`. La URL exacta obtenida debe aprobarse antes de cambiar Site
URL, redirects, `ALLOWED_ORIGINS` o cualquier configuración remota.
