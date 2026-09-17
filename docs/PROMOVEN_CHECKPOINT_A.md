# Promoven — Checkpoint A

## Alcance realizado

- Landing pública con CTA de agenda hacia `#contato` y acceso a `/demo`.
- Formulario de evaluación local: valida campos y conserva sus datos en el navegador; no transmite, persiste ni registra leads.
- WhatsApp y calendario son opcionales mediante `VITE_PROMOVEN_WHATSAPP_NUMBER` y `VITE_PROMOVEN_CALENDAR_URL`. Ambas variables son públicas y no deben contener secretos.
- Política inicial en `/privacidade`, `robots.txt`, sitemap público y entradas HTML con metadata para `/demo` y `/privacidade`.

## Variables pendientes antes de producción

- `VITE_PROMOVEN_WHATSAPP_NUMBER`: número comercial en formato internacional; habilita el canal alternativo y el contacto LGPD.
- `VITE_PROMOVEN_CALENDAR_URL`: URL real de agenda; no se muestra si falta.
- Validación legal: responsable, CNPJ, domicilio, canal LGPD definitivo, retención y proveedores de tratamiento.
- Backend aislado para leads: no se ha evaluado ni modificado Supabase en este checkpoint.

## Validación local

- ESLint y TypeScript: correctos.
- Unitarias: 69 correctas, 4 omitidas.
- E2E: 47 correctas; cubren landing, demo, Garden House, Terraza Luz, portal y deep links.
- Build: correcto. Shell principal: 240,89 kB minificado / 75,16 kB gzip; base anterior: 230,68 kB / 72,20 kB gzip. Three.js permanece diferido en su propio chunk.

No se hicieron commits, despliegues, migraciones, escrituras remotas ni cambios a modelos 3D, inventario, Auth o RLS.
