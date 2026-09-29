# Jequitibá — Interior Final 03

## Alcance

Interior ilustrativo compartido por las 60 unidades Jequitibá (Finales 01–03): 127,84 m², 3 suites y 2 plazas. No modifica Escobar, Garden House ni Terraza Luz.

## Entregables

- GLB público: `xixova/maquette_web/public/building/jequitiba-final-03.glb`
- Fuente reproducible: `resultados/jequitiba_final_03/jequitiba-final-03.blend`
- Catálogo: `publicaciones/catalogo_xixova/projects/jequitiba-final-03/data/scene.json`
- SHA-256 GLB: `bf46016dca2ca11b5da045664bff46b4c28520c77c79e512c3a2db30f402e372`

## Auditoría

- 60 objetos mesh, 18 materiales, 656 triángulos.
- Sin transformaciones inválidas ni referencias externas de textura.
- GLB de 117 KB, adecuado para carga inicial móvil.
- Geometría, mobiliario y materiales son propios. Blendkit no se utilizó: la integración disponible no expuso una procedencia/licencia verificable para importación.
- Perfil premium Jequitibá: ACES/SRGB, sombras suaves, direccional 2048², HDRI Poly Haven CC0, `RenderPass → SSAOPass → SMAAPass → OutputPass`.
- Perfil móvil: composición y HDR conservados; oclusión de contacto reducida para evitar penalizar el recorrido.
- El cargador reusable glTF/Draco valida metadatos de licencia y activa sombras en cada malla importada.

## Licencias

- `public/interior/jequitiba/forest-slope-1k.hdr`: Poly Haven Forest Slope, CC0 1.0. La atribución, origen y licencia se conservan junto al archivo en `LICENSE.md`.

## Uso y rollback

Cada unidad Jequitibá tiene `interiorProjectId: jequitiba-final-03`. El retorno al edificio conserva el deep link. Para rollback, quitar ese vínculo y la entrada del catálogo; los recursos de Escobar quedan sin tocar.

## Nota comercial

El recorrido muestra permanentemente que la tipología, mobiliario, acabados y distribución son ilustrativos, compartidos entre unidades y no contractuales.

## Dream Loop

Referencia, objetivo y capturas locales se reservan en `.dream-loop/jequitiba-final-03/`. Se completaron tres rondas de composición, materiales y render. Las capturas desktop, móvil y de las rondas intermedias se validaron con Chromium local.
