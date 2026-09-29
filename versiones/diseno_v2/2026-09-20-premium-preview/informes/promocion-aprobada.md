# Promoción local aprobada

Fecha: 2026-09-20

El usuario aprobó sustituir el visor fuente por la mejora V2. Se promovieron
únicamente los cambios de presentación de interiores:

- `src/InteriorApp.tsx`
- `src/garden.ts`
- `src/editorial.ts`
- `src/solar/light.ts`
- `src/terrazaPremiumV2.ts` (nuevo)
- `src/premium-v2.css` (nuevo)

La copia recuperable anterior está en
`../rollback/originales-antes-de-aprobacion/`. No se sustituyeron GLB, YAML,
manifiestos de catálogo ni activos publicados. Tampoco se desplegó nada.

## Validación

- `npm run build`: correcto.
- `npm run test:unit`: 79 aprobadas, 4 omitidas.
- `npm run lint`: correcto.
- `git diff --check`: correcto.

Los cambios ya presentes del usuario en `BuildingApp.tsx`, `building.css`,
`MarketingLanding.tsx` y artefactos ajenos no forman parte de esta promoción.

