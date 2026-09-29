# Informe de auditoría del código y funcionalidades

**Proyecto:** XIXOVÁ Atelier v4  
**Fecha de revisión:** 2026-09-19  
**Alcance:** código versionado del repositorio, documentación, proyectos de ejemplo, pruebas y builds disponibles localmente.

## 1. Resumen ejecutivo

El repositorio contiene un framework local funcional para transformar proyectos arquitectónicos declarativos en escenas 3D, maquetas web y recorridos renderizados. La arquitectura está razonablemente separada por capas: arquitectura, interiorismo, presentación y producción. También existe una aplicación web de maquetas/interior y un módulo de captación de leads comerciales con Supabase.

La parte más madura es el núcleo Python y la aplicación `maquette_web`: tras corregir el entorno de importación, el conjunto Python ejecuta **88 pruebas correctas** y la aplicación web ejecuta **79 pruebas correctas y 4 omitidas**. El build de `maquette_web` también termina correctamente. El principal problema inmediato de reproducibilidad es que `pytest` sin configuración adicional no encuentra el paquete `xixova`, y `director_web` no tiene sus dependencias instaladas en el workspace (`tsc: not found`).

La calidad general es **media-alta para un framework experimental/productivo local**, pero todavía no es una base plenamente endurecida para despliegue: faltan una configuración de test Python explícita, cobertura homogénea de las dos aplicaciones web, verificación de builds reproducible, observabilidad/errores más uniformes y separación más clara entre código activo, prototipos y `legacy`.

## 2. Estado del repositorio

El árbol ya contenía cambios locales antes de la auditoría. Además, la ejecución del build de `maquette_web` regeneró artefactos dentro de `dist/` y de la preview de `proyectos/garden_house`, por lo que esos cambios generados aparecen ahora en `git status`.

- Modificado: `AGENTS.md`.
- Modificados: `xixova/maquette_web/src/building/BuildingApp.tsx`, `xixova/maquette_web/src/building/building.css` y `xixova/maquette_web/src/marketing/MarketingLanding.tsx`.
- Nuevos previos: `docs/APARTMENT_PRODUCTION_LESSONS.md` y `docs/apartamentos/`.
- Generados durante la verificación: cambios/nuevos archivos dentro de `xixova/maquette_web/dist/` y `proyectos/garden_house/.director/lujo_contemporaneo/maqueta_preview/`.

Todos esos cambios se han conservado; no se ejecutaron comandos destructivos ni se limpiaron artefactos. El presente informe es el único archivo documental nuevo creado durante la revisión.

## 3. Funcionalidades implementadas

### 3.1. Núcleo de proyectos y contratos

- Carga de proyectos y variantes desde YAML.
- Contratos JSON Schema para proyecto, arquitectura, interiorismo, catálogo, presentación, biblioteca, operaciones, guion de cámara y guion de dirección.
- Hashes/digests de arquitectura e interiorismo para evitar aplicar propuestas sobre una base obsoleta.
- Diagnósticos estructurados con código, gravedad, elemento y explicación.
- Resolución de referencias entre espacios, paredes, objetos y activos.
- Validación de geometría, habitaciones, paredes, huecos, pilares, colisiones, cámaras y referencias circulares.
- Operaciones declarativas simulables y publicables: mover, cambiar activo, añadir, eliminar, aplicar acabado, ajustar luz, ajustar toma y crear variante.
- Contexto compacto para agentes y cálculo de diferencias por fingerprint.

### 3.2. Arquitectura y generación 3D

- Representación métrica en metros con coordenadas XY y altura Z.
- Generación de planta/SVG y escena Blender.
- Construcción de muros, losas, pilares, huecos, ventanas y elementos arquitectónicos.
- Exportación y preparación para GLB/glTF, con perfiles `mobile`, `standard` y `premium`.
- Inventario de edificio y catálogo exportable para el visor.
- Sincronización Blender ↔ datos declarativos mediante captura, fingerprint y aplicación controlada de cambios.
- Preflight y auditorías específicas de escena, materiales, biblioteca y visibilidad.

### 3.3. Biblioteca de activos

- Inicialización de biblioteca y manifiesto.
- Búsqueda/registro de candidatos.
- Estados `candidato`, `aceptado`, `publicado` y `rechazado`.
- Registro de descargas, hashes, procedencia, licencia, autor y archivos.
- Auditoría de activos y reconstrucción del catálogo público.
- Normalización de escala, origen, orientación y dimensiones de recursos Blender.
- Descarga de recursos PBR y migración desde bibliotecas históricas.

### 3.4. Interiorismo y realismo

- Asignación de activos a variantes.
- Acabados y materiales por superficies estables.
- Resolución automática de niveles de luz, iluminación según ventanas y exposición.
- Compilación de realismo y correcciones de exposición.
- Auditorías de realismo, materiales, iluminación, visibilidad y fotografía.
- Preflight de producción y generación de informes visuales.

### 3.5. Cámaras, dirección y recorridos

- Propuesta de recorrido por áreas y orden natural.
- Planificación automática de cámaras desde un guion semántico.
- Movimientos estáticos, aproximación, retroceso, desplazamiento lateral, órbita suave y revelado desde puerta.
- Detección de obstrucciones, transitabilidad y visibilidad del sujeto.
- Director Python con guion de dirección, pistas, marcadores, muestras interpoladas y presets.
- Servidor HTTP/WebSocket del director y exportación de una escena GLB de dirección.

### 3.6. Producción y vídeo

- Composición de escenas Blender.
- Previews, animática y recorrido final.
- Render por fotogramas PNG, reanudable y con validación de dimensiones/integridad.
- Monitor de progreso y estado.
- Comparación entre salidas.
- Montaje FFmpeg con perfiles de calidad, FPS, resolución y muestras.
- Perfiles documentados: previa, animática, final, piloto fotográfico, piloto temporal y 1080p fotográfico.

### 3.7. Aplicación web `maquette_web`

- Visor 3D Three.js para modelos de edificio e interior.
- Carga de GLB y Draco.
- Variantes de calidad y selección de activos/modelos.
- Maqueta visual de edificio Promoven.
- Landing/marketing, demo y página de privacidad.
- Portal administrativo y páginas estructurales.
- Integración Supabase en el cliente.
- Sistema de iluminación solar y simulación temporal.
- Inventario, disponibilidad de unidades y datos de catálogo.
- E2E con Playwright para maqueta, marketing, portal y edificio.
- Tests unitarios Vitest.

### 3.8. Aplicación `director_web`

- Cliente Vite/React/Three.js orientado a revisión y dirección de escenas.
- Configuración de Playwright.
- La presencia de `main.tsx`, evaluador, estilos y configuración indica una interfaz separada del visor de maqueta; su build local no quedó verificable porque faltan dependencias instaladas.

### 3.9. Captación comercial `infra/promoven-leads`

- Migración Supabase para leads comerciales.
- Estados de lead: nuevo, contactado, cualificado, reunión, propuesta, ganado y perdido.
- Validación SQL de nombre, empresa, contacto, ciudad, volumen, ventana de lanzamiento, estado del modelo 3D y consentimiento.
- RLS activado y permisos revocados por defecto.
- Función `accept_commercial_lead` con `security definer`.
- Idempotencia durante 24 horas mediante hash de solicitud/payload.
- Rate limiting de cinco solicitudes por ventana de 15 minutos y bloqueo transaccional con advisory locks.
- Estado de notificación pendiente/enviada/fallida/no configurada.
- Tests SQL y de concurrencia.

### 3.10. Proyectos y activos incluidos

Hay datos de ejemplo o trabajo para `xixova`, `estudio`, `garden_house`, `garden_house_18`, `garden_ampliada`, `terraza_luz` y `apartamento_compacto`, además de catálogos, solicitudes de búsqueda, GLB, Blend y texturas. `legacy/produccion` conserva el pipeline histórico y sus scripts de producción.

## 4. Organización técnica

| Área | Ubicación | Responsabilidad |
|---|---|---|
| CLI | `xixova_cli.py`, `xixova/cli.py` | Entrada operativa y comandos del framework |
| Dominio | `xixova/core.py`, `agent.py`, `catalog.py` | Carga, contratos, resolución y operaciones |
| 3D/Blender | `blender_build.py`, `maquette.py`, `blender_sync.py` | Escena, exportación, sincronización y visor |
| Producción | `production.py`, `render.py`, `render_monitor.py` | Frames, vídeo, progreso y comparación |
| Dirección | `director.py`, `director_server.py`, `director_glb.py`, `camera_planner.py` | Cámaras, guiones y API |
| Calidad | `quality_audit.py`, `realism_*`, `photography_audit.py`, `preflight.py` | Auditorías y preflight |
| Web | `xixova/maquette_web`, `xixova/director_web` | Visores, portal, marketing y dirección |
| Datos | `proyectos/`, `biblioteca/`, `xixova/schemas/` | Fuente declarativa y catálogos |
| Backend | `infra/promoven-leads/supabase` | Persistencia y protección de leads |
| Histórico | `legacy/produccion` | Pipeline anterior congelado |

## 5. Calidad del código

### Fortalezas

- Buena separación conceptual entre datos, dominio, Blender, render y web.
- Contratos explícitos y `additionalProperties: false` en los documentos estructurales principales.
- Uso consistente de hashes, manifiestos, estados y salidas aisladas para reducir mezclas entre ejecuciones.
- Pruebas unitarias Python cubren core, agente, biblioteca, director, maquette, materiales, producción, cámaras y sincronización.
- Pruebas web cubren rutas y componentes importantes.
- SQL con restricciones de dominio, RLS, mínimos privilegios, idempotencia y control de concurrencia.
- Documentación operativa detallada sobre los fallos reales del flujo Blender → GLB → visor.

### Riesgos y deuda técnica

1. **Test Python no reproducible desde la raíz.** `pytest -q` falla con `ModuleNotFoundError: xixova`; solo pasa con `PYTHONPATH=.`. Debe añadirse configuración explícita (`pyproject.toml`, `pytest.ini` o instalación editable).
2. **Dependencias web inconsistentes.** `maquette_web` tiene dependencias instaladas; `director_web` no, por lo que su build falla con `tsc: not found`. Conviene instalar y bloquear dependencias de forma verificable en CI.
3. **Chunks grandes en la web.** El build advierte bundles minificados superiores a 500 kB, incluyendo Three.js de unos 800 kB. Conviene aplicar carga diferida por rutas y separar Three.js/Draco cuando el rendimiento de producción sea prioritario.
4. **Advertencia de Vite.** La configuración usa `__dirname` con el cargador nativo futuro. No rompe hoy, pero debe migrarse a `import.meta.dirname` o fijar explícitamente la estrategia del cargador.
5. **Manejo de excepciones amplio.** Hay varios `except Exception` y `except: pass`, principalmente en integración Blender, render, sincronización y compatibilidad legacy. Esto facilita continuidad, pero puede ocultar fallos y dificultar diagnóstico.
6. **Superficie grande y heterogénea.** El repositorio mezcla framework activo, demos, scripts auxiliares, archivos generados, recursos binarios y legacy. Falta una frontera más clara de paquetes mantenidos y una política de build por artefactos.
7. **Diferencia entre documentación y prueba visual.** La documentación correctamente advierte que un render terminado no demuestra fidelidad, pero no existe una automatización equivalente para comparar capturas, materiales, orientación y visibilidad en todos los proyectos.
8. **Dependencia fuerte de Blender y entorno local.** Parte importante del comportamiento depende de ejecutable Blender, archivos binarios fuera de Git, GPU, texturas y rutas locales. Hace falta un preflight de CI más explícito para separar “no ejecutable por entorno” de “fallo de código”.
9. **Cobertura de seguridad web incompleta.** El SQL está bien restringido, pero no se observó en esta auditoría una matriz completa de pruebas de autenticación, autorización y abuso de todos los endpoints del portal.
10. **Versionado de dependencias del director.** `director_web` usa varias dependencias `latest`, lo que reduce la reproducibilidad frente a `maquette_web`, que tiene versiones fijadas en su manifiesto/lock.

## 6. Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| `PYTHONPATH=. pytest -q` | **88 passed**, 2 warnings, 49.70 s |
| `pytest -q` | Falla en colección: no encuentra `xixova` |
| `npm run test:unit` en `xixova/maquette_web` | **79 passed**, 4 skipped |
| `npm run build` en `xixova/maquette_web` | Correcto; warnings de Vite y chunks grandes |
| `npm run build` en `xixova/director_web` | No ejecutable en el estado actual: `tsc: not found` |
| Estado Git | Hay modificaciones locales y archivos no versionados previos a esta revisión |

No se ejecutaron renders Blender completos, despliegues, pruebas contra Supabase remoto ni navegación E2E completa, porque requieren binarios/servicios y validación visual que no forman parte de una comprobación segura de solo lectura.

## 7. Recomendaciones priorizadas

### Prioridad alta

- Añadir configuración de descubrimiento Python y un comando único de test reproducible.
- Instalar/validar `director_web` y fijar sus dependencias; incorporar build de ambas apps a CI.
- Crear un `Makefile` o scripts equivalentes para `test`, `build`, `lint`, `validate` y `preflight`.
- Documentar qué directorios son fuente, cuáles son generados y cuáles son históricos.
- Mantener una matriz de compatibilidad Blender/Blender Python/FFmpeg/Node.

### Prioridad media

- Sustituir excepciones silenciosas por errores tipados, logs estructurados y diagnósticos con contexto.
- Dividir bundles web mediante `import()` y rutas diferidas.
- Añadir tests de integración para GLB real, orientación, materiales, recursos embebidos y selección de calidad.
- Añadir pruebas E2E reproducibles para portal, autenticación, envío de lead y permisos.
- Automatizar inventario de artefactos y hashes en cada build.

### Prioridad baja

- Unificar nombres de comandos/documentación entre pipeline actual y legacy.
- Extraer utilidades repetidas de scripts y auditorías.
- Añadir métricas de complejidad/cobertura y revisar módulos de mayor tamaño antes de nuevas funcionalidades.

## 8. Conclusión

El proyecto ya no es un simple prototipo aislado: existe un flujo completo desde datos arquitectónicos hasta escena 3D, web, recorrido y captación comercial. El núcleo tiene una cobertura de pruebas significativa y la documentación recoge aprendizajes operativos valiosos. El siguiente salto de calidad no requiere ampliar funcionalidades inmediatamente; requiere hacer reproducible el entorno, integrar builds/tests en CI, endurecer errores y separar con claridad el producto activo de demos y legado.
