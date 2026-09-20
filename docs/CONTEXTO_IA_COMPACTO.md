# Contexto compacto para IA — XIXOVÁ Atelier v4

**Propósito:** entregar a una IA el contexto mínimo para trabajar en este repositorio sin releer todo el proyecto.

## Identidad del proyecto

XIXOVÁ es un framework local que convierte datos arquitectónicos YAML en:

`arquitectura → interiorismo → presentación → escena Blender → GLB/maqueta web → renders/vídeo`.

La fuente de verdad son los YAML y contratos; Blender genera escenas y salidas. El pipeline activo está en `xixova/`. `legacy/produccion/` es histórico y no debe mezclarse con el flujo actual.

## Reglas obligatorias

1. Antes de editar: ejecutar `git status --short` y conservar cambios existentes.
2. Para proyectos estructurados: leer `docs/agentes/GUIA.md` y los schemas de `xixova/schemas/`.
3. Para apartamentos 3D: leer `docs/APARTMENT_PRODUCTION_LESSONS.md`.
4. Para vídeo: leer `docs/VIDEO_PRODUCTION_LESSONS.md`.
5. No mover paredes para encajar muebles.
6. No inventar medidas, puertas, accesos o fidelidad visual.
7. No modificar arquitectura desde una variante decorativa.
8. No usar `resolver` como contexto normal: devuelve demasiado contenido. Usar `contexto-agente` y `validar --compacto`.
9. Las operaciones deben simularse antes de publicarse; usar `--aplicar` solo después de validar.
10. No afirmar que un render es comercial/fotorrealista sin inspección visual y métricas.
11. No limpiar, borrar o revertir artefactos del usuario sin autorización.

## Mapa de archivos

| Necesidad | Archivo/directorio |
|---|---|
| Carga, contratos, resolución y validación | `xixova/core.py` |
| CLI | `xixova_cli.py`, `xixova/cli.py` |
| Operaciones para agentes | `xixova/agent.py`, `xixova/schemas/operaciones.json` |
| Escena Blender | `xixova/blender_build.py`, `xixova/maquette_blender_export.py` |
| Maqueta/GLB | `xixova/maquette.py`, `xixova/catalog.py` |
| Cámaras y recorridos | `xixova/camera_planner.py`, `xixova/tour.py` |
| Director de escenas | `xixova/director.py`, `xixova/director_server.py`, `xixova/director_glb.py` |
| Render/vídeo | `xixova/render.py`, `xixova/production.py`, `xixova/render_monitor.py` |
| Realismo/fotografía | `xixova/realism_compiler.py`, `xixova/photography_audit.py` |
| Biblioteca de activos | `xixova/library.py`, `xixova/normalizar.py` |
| Visor web principal | `xixova/maquette_web/` |
| Director web | `xixova/director_web/` |
| Leads comerciales | `infra/promoven-leads/supabase/` |
| Proyectos | `proyectos/*/` |
| Catálogos | `biblioteca/`, `catalogo.yaml`, `proyectos/*/catalogo.yaml` |

## Flujo mínimo para un proyecto

```bash
# 1. Estado y validación
git status --short
uv run xixova_cli.py validar -p proyectos/<id>/proyecto.yaml --compacto

# 2. Arquitectura
uv run xixova_cli.py arquitectura -p proyectos/<id>/proyecto.yaml
# revisar planta.svg y previas antes de confirmar arquitectura

# 3. Interiorismo y escena
uv run xixova_cli.py componer -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py previas -p proyectos/<id>/proyecto.yaml --variante <variante>

# 4. Revisión visual y vídeo
uv run xixova_cli.py animatica -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py estado -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py recorrido -p proyectos/<id>/proyecto.yaml --variante <variante>
```

Para calidad fotográfica:

```bash
uv run xixova_cli.py preparar-realismo -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py pilotos-fotograficos -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py auditar-fotografia -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py piloto-temporal -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py recorrido -p proyectos/<id>/proyecto.yaml --variante <variante> --perfil fotografico_1080p
```

## Contexto incremental para IA

Generar un resumen persistente:

```bash
uv run xixova_cli.py contexto-agente \
  -p proyectos/<id>/proyecto.yaml \
  --variante <variante>
```

En el siguiente turno usar el archivo generado con `--desde`. Solo secciones cuyo fingerprint cambió deberían volver al contexto.

Para cambios declarativos:

```bash
uv run xixova_cli.py operar \
  -p proyectos/<id>/proyecto.yaml \
  --variante <variante> \
  --operaciones operaciones.yaml
```

Si el resultado es correcto, repetir con `--aplicar`. No mezclar en una misma operación interiorismo y presentación. Cada solicitud debe incluir el hash vigente de arquitectura cuando el contrato lo requiera.

## Contratos conceptuales

- **Arquitectura:** geometría, muros, huecos, ventanas, pilares e instalaciones.
- **Interiorismo:** activos, posiciones, escalas, materiales y variantes.
- **Presentación:** cámaras, luz, entorno, exposición y guion.
- **Producción:** biblioteca, perfil, FPS, muestras, equipo y salidas.

Un cambio de arquitectura exige nueva versión/hash y revisión de todas las propuestas vinculadas. Un GLB editado manualmente no actualiza los YAML. Una escena Blender editada se conserva mediante `capturar` → `sincronizar` → validar → `--aplicar`.

## Comandos de diagnóstico

```bash
uv run xixova_cli.py validar -p proyectos/<id>/proyecto.yaml --compacto
uv run xixova_cli.py comprobar -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py preflight -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py auditar-calidad -p proyectos/<id>/proyecto.yaml --variante <variante>
uv run xixova_cli.py estado -p proyectos/<id>/proyecto.yaml --variante <variante>
```

Los diagnósticos tienen `codigo`, `gravedad`, `elemento` y `explicacion`. Un comando fallido termina con código distinto de cero. Los logs extensos de Blender se guardan en `logs/`.

## Pruebas conocidas

```bash
PYTHONPATH=. pytest -q
cd xixova/maquette_web && npm run test:unit && npm run build
cd xixova/director_web && npm run build
```

Estado comprobado el 2026-09-19:

- Python: 88 pruebas correctas usando `PYTHONPATH=.`.
- `maquette_web`: 79 pruebas correctas, 4 omitidas; build correcto con advertencias de chunks grandes.
- `director_web`: build no comprobado porque faltaba `tsc`/instalación local de dependencias.
- `pytest -q` sin `PYTHONPATH` falla por configuración de importación; no interpretar ese fallo como fallo funcional.

## Estado local importante

Hay cambios locales y artefactos generados en `AGENTS.md`, `xixova/maquette_web/`, `proyectos/garden_house/.director/`, `docs/APARTMENT_PRODUCTION_LESSONS.md`, `docs/apartamentos/` y el informe de auditoría. Antes de modificar cualquiera de ellos, inspeccionar el diff y no sobrescribirlo.

## Respuesta esperada de una IA

Responder de forma breve y accionable:

1. indicar qué archivo/proyecto se revisó;
2. declarar supuestos;
3. ejecutar la validación mínima relevante;
4. separar hechos verificados de inferencias;
5. listar archivos modificados y pendientes;
6. no volver a explicar todo el framework si no es necesario.

Cuando falte contexto, pedir solo el dato mínimo: proyecto, variante, archivo fuente, objetivo visual o autorización de publicación.

