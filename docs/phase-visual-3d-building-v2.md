# Escobar Visual 3D V2 — Checkpoint A

Fecha de auditoría: 2026-09-15. Este checkpoint crea una base aislada y
reversible. No cambia el GLB usado por producción, inventario, Supabase ni las
experiencias interiores.

## Baseline y rollback

El activo público que continúa sirviendo el visor es
`xixova/maquette_web/public/building/xixova-building.glb`.

| Medida | Baseline |
| --- | ---: |
| SHA-256 | `07e390ac4c481d5689f6e078ec1cfd3c8913475e09c7d8f0a2dd837840f6b8a8` |
| Tamaño | 3,036,292 bytes |
| Triángulos | 56,504 |
| Mallas / materiales / proxies | 99 / 16 / 72 |

Rollback es inmediato: no hay cambio de referencia del visor y basta con no
activar la variante. El GLB V2 tiene un hash distinto por ser una exportación
nueva, no por alterar el baseline.

## Base V2 generada

La fuente canónica es `xixova/maquette_web/building_model.py`; no se encontró
un `.blend` original en el repositorio ni en `/home/rafa/RenderCasa`.
La regeneración se ejecutó mediante Blender MCP (fallback de ejecución directa
con Blender 4.5.13 LTS, pues el handshake legado no respondió).

Salidas ignoradas por Git y aisladas:

- `resultados/building_visual_v2/xixova-building-visual-v2.blend`
- `xixova/maquette_web/public/building/xixova-building-visual-v2.glb`

Auditoría de la exportación V2:

| Medida | Resultado |
| --- | ---: |
| SHA-256 / tamaño | `003ab678af116360552ef355e76130d3cc63292c22b3dde60bff49da181ade9c` / 3,035,784 bytes |
| Triángulos / objetos / mallas | 56,504 / 123 / 99 |
| Materiales / texturas externas | 16 / 0 |
| Cámaras / luces exportadas | 0 / 0 |
| Proxies válidos | 72 de 72 |
| Bounding box (m) | min `[-20,-20.06,-0.55]`, max `[20,20.06,64.39]` |
| Normales degeneradas / referencias locales | 0 / 0 |

Los 72 nodos conservan exactamente el patrón `UNIT_<código>_PROXY`, los
metadatos `xixova_unit_code`, `xixova_floor`, `xixova_proxy` y transforms
finitos. No se unieron a la fachada ni se reutilizaron sus materiales.

## Regeneración y validación reproducibles

`building_model.py` admite variables de entorno para no sobrescribir la
versión pública. Ejecutar en una instancia limpia de Blender:

```bash
XIXOVA_BUILDING_OUT=/home/rafa/RenderCasa/xixova_atelier_v4/xixova/maquette_web/public/building \
XIXOVA_BUILDING_BLEND_OUT=/home/rafa/RenderCasa/xixova_atelier_v4/resultados/building_visual_v2 \
XIXOVA_BUILDING_STEM=xixova-building-visual-v2 \
XIXOVA_BUILDING_SCENE=XIXOVA_BUILDING_VISUAL_V2 \
/home/rafa/Aplicaciones/blender-4.5/blender --background --python xixova/maquette_web/building_model.py

/home/rafa/Aplicaciones/blender-4.5/blender --background \
  resultados/building_visual_v2/xixova-building-visual-v2.blend \
  --python xixova/maquette_web/building_visual_v2_validate.py
```

El validador bloquea proxies inexistentes, duplicados o renombrados,
metadatos/transformaciones inválidos, objetos de trabajo, cámaras, luces,
normales degeneradas y referencias locales. Guarda el reporte ignorado en
`resultados/building_visual_v2/xixova-building-visual-v2-audit.json`, con hash
y comparación del baseline.

## Presupuesto y riesgos

La base V2 conserva el presupuesto actual: 56,504 triángulos, 16 materiales y
sin texturas, por lo que aún hay margen para mejoras selectivas, aunque los
bevels, paisaje y emisivos de la fase siguiente deberán medirse antes de subir
el peso del GLB. La regeneración final se ejecutó en Blender limpio y el
archivo de trabajo contiene la escena `XIXOVA_BUILDING_VISUAL_V2` sin objetos
archivados.

No se descargaron assets ni se incorporaron licencias nuevas. La ambientación
futura se tratará como ilustrativa, con la etiqueta permanente y discreta
`Ambientação ilustrativa`; no representará una ciudad, costa o entorno real.

## Checkpoint B — presentación V2 (2026-09-15)

V2 es ahora la presentación predeterminada, tanto local como en producción.
El rollback explícito y reversible permanece disponible mediante
`?vista=edificio&unidad=1203&visual=original`, que carga la escena y controles
anteriores con el GLB baseline.

La variante carga exclusivamente `xixova-building-visual-v2.glb`, conserva el
binding de unidades y sus 72 proxies, y aplica una iluminación comercial
separada de los módulos de estudio solar. Incluye un encuadre hero que conserva
coronación, acceso y paneles en escritorio y móvil; materiales cálidos de
concreto, bronce, vidrio y vegetación; controles de día/entardecer, selección,
zoom y restauración. La ambientación se genera exclusivamente en Three.js con
cielo procedural, bruma ligera, explanada arquitectónica, vegetación
instanciada y horizonte abstracto: no contiene fotografía, HDRI ni una
afirmación sobre ubicación. El agua es una capacidad configurable, pero queda
desactivada por falta de datos confiables de dirección, distancia y altura. Se
mantiene el aviso visible permanente `Ambientação ilustrativa`.

Dream Loop guardó target, baseline y candidatos de escritorio/móvil bajo
`.dream-loop/` (ignorado). Se realizaron tres pasadas de composición y
controles. Validaciones ejecutadas: lint, build, 58 pruebas unitarias aprobadas
(4 omitidas), validación Blender/GLB del checkpoint A y carga real de V2 en
escritorio y móvil sin error. La primera prueba E2E pública de edificio pasó;
una ejecución posterior quedó impedida por un puerto temporal de Playwright ya
reservado, no por una falla de la aplicación.
