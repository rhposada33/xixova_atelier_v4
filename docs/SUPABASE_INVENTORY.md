# Inventario Escobar con Supabase

La aplicación usa `VITE_INVENTORY_PROVIDER=static` por defecto. Para el proveedor remoto configure `VITE_INVENTORY_PROVIDER=supabase`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_SUPABASE_ANON_KEY` se admite temporalmente como alias de la publishable key. URL y publishable key son públicas por diseño; nunca use una `service_role`, secret key, contraseña, access token privado o connection string en variables `VITE_*`.

## Desarrollo local

```bash
npx supabase start
npx supabase db reset
npx supabase test db
python3 -m unittest xixova.tests.test_supabase_seed -v
```

`scripts/generate_supabase_seed.py` genera el `supabase/seed.sql` versionado a partir de `xixova/data/escobar_inventory.json`. La prueba anterior falla si ambos divergen. Vercel y Supabase consumen el SQL ya generado; no ejecutan Python en producción.

## Seguridad

`anon` solo posee `EXECUTE` sobre `public.get_public_inventory(text,text,text)`. La función usa `SECURITY DEFINER`, `search_path=''`, referencias calificadas y filtros explícitos para organización activa, proyecto publicado, unidad publicada y estados públicos. `PUBLIC` no puede ejecutarla y `anon` no tiene privilegios directos sobre tablas. `authenticated` solo puede leer filas de organizaciones a las que pertenece y no recibe escritura general.

No ejecute `supabase db push` hasta revisar las migraciones, el seed, las pruebas y el diff local. Nunca use `db reset --linked`.

## Recuperación

La activación remota se revierte cambiando `VITE_INVENTORY_PROVIDER` a `static` y desplegando nuevamente. Las migraciones iniciales solo crean objetos nuevos; su reversión remota, si fuera necesaria, debe prepararse y aprobarse como una migración separada.
