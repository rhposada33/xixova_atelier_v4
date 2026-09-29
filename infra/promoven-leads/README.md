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

## B2 — recepción y avisos comerciales

Las funciones `submit-commercial-lead` y `send-commercial-notifications` pertenecen **solo** a este proyecto aislado. `submit-commercial-lead` es pública para el formulario, valida y normaliza en servidor, calcula HMAC de idempotencia, payload y contacto, y llama a `accept_commercial_lead`. Responde `202` únicamente después de guardar; `400`, `409`, `429` y `503` no incluyen datos personales. La limitación de cinco solicitudes por 15 minutos se aplica por contacto normalizado. No se escribe IP en la base.

La nueva migración `20260929000000_notification_dispatch.sql` da únicamente a `service_role` acceso a las RPC limitadas para reclamar y marcar avisos. El worker usa Resend con `Idempotency-Key` basada en el UUID del lead. Un fallo de correo deja el lead guardado y vuelve a poner el aviso en cola después de cinco minutos. El navegador nunca recibe credenciales privadas.

Secrets de las Edge Functions, configurados en el proyecto aislado (nunca en `VITE_*`):

- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` del proyecto Promoven.
- `LEAD_HMAC_SECRET`: valor aleatorio privado de al menos 32 bytes.
- `PRIVACY_POLICY_VERSION`: versión aprobada del aviso.
- `ALLOWED_ORIGINS`: orígenes exactos separados por comas, por ejemplo staging y `https://www.promoven.online`.
- `NOTIFICATION_JOB_SECRET`: secreto diferente del HMAC para invocar el worker.
- `RESEND_API_KEY`, `RESEND_FROM` (dominio verificado) y `COMMERCIAL_TO` (buzón comercial). `RESEND_API_URL` se admite solo para pruebas locales con un servidor de correo simulado; dejarlo sin configurar en staging y producción.

Configurar `verify_jwt = false` solo en estas funciones: el endpoint público comprueba CORS, valida el payload y usa las protecciones de la RPC; el worker exige su secreto de trabajo. CORS no sustituye la limitación de solicitudes. Programar `send-commercial-notifications` cada minuto con Supabase Cron y enviar `Authorization: Bearer <NOTIFICATION_JOB_SECRET>` desde un secreto almacenado en Vault; no guardar ese valor literal en SQL. Revisar ejecuciones fallidas y avisos con estado `failed` en el proyecto aislado.

### Staging y activación

En el build web de staging, configurar `VITE_APP_ENV=staging`, `VITE_PROMOVEN_LEADS_ENABLED=true` y `VITE_PROMOVEN_LEADS_ENDPOINT` con la URL pública de la función. Usar solo contactos sintéticos en staging y verificar un lead, un email, el reenvío idempotente y un fallo de Resend. El estado por defecto de la web permanece sin formulario.

Producción exige además `VITE_PROMOVEN_LEGAL_ENTITY`, `VITE_PROMOVEN_CNPJ`, `VITE_PROMOVEN_ADDRESS`, `VITE_PROMOVEN_PRIVACY_CONTACT`, `VITE_PROMOVEN_PRIVACY_APPROVED=true` y una URL HTTPS para el endpoint. Estos datos aún no están confirmados; **no habilitar producción** hasta revisar el aviso, confirmar retención/proveedores, configurar Resend y probar staging. Luego activar `VITE_PROMOVEN_LEADS_ENABLED=true` en un nuevo build. El buzón y el dominio remitente se guardan solo como secrets del servidor.

Las pruebas locales de base se ejecutan con `npx supabase start`, `npx supabase db reset` y `npx supabase test db` desde este directorio. No vincular ni empujar a un proyecto remoto durante la validación local.
