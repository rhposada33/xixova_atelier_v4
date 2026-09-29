# Promoven Leads — Supabase aislado

Este directorio es un proyecto Supabase independiente para la captación comercial de Promoven. No comparte migraciones, project ref, seed, Auth, RLS ni datos con `../../supabase/`, que pertenece a Escobar.

## Alcance B1

La migración crea exclusivamente el esquema privado de persistencia: leads, idempotencia, rate limit, grants, RLS y la RPC transaccional de entrada. No contiene una Function, frontend, proveedor de correo ni configuración remota.

## Desarrollo local

Con la CLI de Supabase instalada, desde este directorio:

```bash
supabase start
supabase db reset
supabase test db
```

Para el test de concurrencia, instalar únicamente la dependencia de prueba local y usar la URL de la base local que expone `supabase status`:

```bash
npm install
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55322/postgres' node supabase/tests/concurrent_idempotency.mjs
```

No ejecutar `supabase link`, `supabase db push`, `supabase secrets set` ni comandos remotos durante B1. `config.toml` usa el identificador local `promoven_leads_local` y no declara ningún project ref ni credencial.

## Contrato server-side futuro

La RPC `public.accept_commercial_lead(...)` acepta datos ya validados y normalizados por un endpoint server-side. Sus hashes de idempotencia, payload y rate limit deben ser HMAC-SHA-256 producidos por ese runtime con un secreto privado. Nunca se deben derivar en el navegador ni enviar una IP en claro.

La RPC solo tiene `EXECUTE` para `service_role`. Esta credencial tiene privilegios amplios en Supabase y debe existir únicamente en el runtime server-side; jamás en una variable `VITE_*`, bundle, navegador, log o repositorio.

La operación toma locks transaccionales por hash de idempotencia y de rate limit. El primer envío inserta un lead; una repetición vigente con igual payload devuelve `accepted` sin UUID; una repetición con payload distinto devuelve `idempotency_conflict`; al superar cinco envíos en 15 minutos devuelve `rate_limited`. Una clave expirada se reemplaza por una nueva aceptación. Los hashes y límites son calculados en la base, no aceptados como límites del cliente.

## Retención propuesta — pendiente LGPD

- Leads no calificados: revisión y eliminación a los 180 días.
- Leads activos: mientras exista relación comercial y obligación aplicable.
- Idempotencia y rate-limit: 24 horas.
- Solicitudes de eliminación: proceso manual documentado antes de producción.

No se implementa borrado automático hasta validar estos plazos y la base legal aplicable. `consent_at` registra el consentimiento de contacto comercial; `privacy_notice_accepted_at` registra separadamente la aceptación del aviso. La calificación jurídica LGPD definitiva queda pendiente de revisión legal.

## Rollback local

Después de validar la migración, aplicar `supabase/rollback/20260918000000_drop_commercial_leads.sql` solamente contra la base local de este proyecto y confirmar que las relaciones `commercial_*` no existen. El script no referencia objetos de Escobar.
