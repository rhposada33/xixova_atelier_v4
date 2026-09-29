# Ilustração de iluminação Promoven — arquivada

## Estado

El 18 de septiembre de 2026 la experiencia D1/D1.2 fue retirada de la landing
por decisión de producto. Su implementación permanece conservada, pero
`MarketingLanding.tsx` ya no la importa ni monta: no existe `#experiencia`, no
hay enlaces hacia esa sección y la ruta `/` no descarga el GLB, Three.js, HDRI
ni recursos de iluminación.

Esto no elimina ni altera `/demo`. El visor de las demostraciones conserva su
carga diferida e interacción independiente.

## Implementación preservada

- `xixova/maquette_web/src/marketing/HeroBuildingPreview.tsx`: preview WebGL
  aislado, controles, ciclo de vida y degradación de rendimiento.
- `xixova/maquette_web/src/marketing/lightingTimeline.ts` y
  `lightingAutoplay.ts`: línea temporal y reglas de reproducción.
- `xixova/maquette_web/src/marketing/nightPattern.ts`: patrón determinista de
  120 paneles interiores.
- `xixova/maquette_web/src/marketing/nightAtmosphere.ts` y
  `lightingPanoramas.ts`: iluminación de acceso, suelo, neblina y contrato de
  fondos panorámicos opcionales.
- Sus pruebas unitarias `lightingTimeline.test.ts`, `lightingAutoplay.test.ts`
  y `nightPattern.test.ts`.
- Los estilos correspondientes continúan inactivos en
  `xixova/maquette_web/src/marketing/marketing.css` para conservar la
  presentación aprobada sin afectar la landing.

El GLB original sigue siendo `/building/promoven-building-v2.glb`; no fue
modificado. La experiencia es una **ilustración de iluminación**, no una
simulación solar técnica ni una representación de orientación, ubicación,
fecha o estación.

## Reactivación futura

1. Restaurar la importación de `HeroBuildingPreview` y una sección explícita
   en `MarketingLanding.tsx`; no reutilizar fragmentos de interfaces antiguas
   sin revisar su accesibilidad y copy.
2. Restaurar solo si se desea los enlaces de navegación a esa nueva sección.
3. Confirmar que el preview mantenga el GLB, cámara, escala y controles
   documentados en `PROMOVEN_D1_LIGHTING.md`.
4. Ejecutar pruebas unitarias de iluminación, E2E de preview y las pruebas de
   regresión de `/demo` antes de publicar.
5. Verificar que la landing vuelve a descargar el GLB únicamente cuando la
   nueva sección se acerque al viewport, y que `/demo` no solicita recursos
   del renderer de marketing.

Mientras este archivo sea la fuente de estado, la prueba E2E de la landing
debe afirmar la ausencia de la sección y de sus solicitudes de red.
