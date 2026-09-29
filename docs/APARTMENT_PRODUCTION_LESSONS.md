# Apartamentos 3D: guía operativa compacta

Aprendizajes de Terraza Luz, 2026-09-19. Leer este documento antes de crear, mejorar o integrar otro apartamento. Es un procedimiento reutilizable, no una autorización de despliegue ni una garantía del estado actual. Las instrucciones vigentes del usuario prevalecen.

## Ruta corta

1. **Inspeccionar y proteger.** Comprobar `git status`, fuentes YAML, maestro Blender y archivos realmente solicitados por el visor. Guardar primero cualquier sesión Blender sin guardar en un archivo independiente y verificarlo. Trabajar sobre una copia versionada; registrar hashes de fuentes y archivos ajenos.
2. **Fijar arquitectura y comparación.** Distinguir dimensiones verificadas de inferidas. Guardar tres cámaras: comparable al visor, axonométrica y superior ortográfica, con resolución hasta 1280 px. Renderizar tres baseline y reutilizar los encuadres.
3. **Resolver accesos.** Clasificar vanos como puertas confirmadas, pasos abiertos o dudas. Añadir hojas/marcos/herrajes solo donde corresponda, con IDs deterministas y colección propia. Revisar pose, barrido y circulación; no desplazar paredes para encajar muebles.
4. **Ambientar.** Reutilizar activos antes de descargar. Priorizar proporción, materiales, sombras de contacto y recorridos. Registrar procedencia y licencia. Mantener el límite de ciclos acordado; en Terraza Luz fueron dos: accesos y ambientación.
5. **Preparar web por separado.** Conservar maestro métrico Z-up y texturas empaquetadas. Optimizar una copia independiente, exportar glTF estándar Y-up y comprobar materiales, recursos embebidos y orientación.
6. **Integrar cuando esté autorizado.** Verificar cargador, nivel de calidad, ejes, IDs, objetos ocultos y decoración procedural. Revisar la página real, además de la comparación aislada.
7. **Publicar cuando esté autorizado.** Construir el artefacto completo con sus variables públicas y rutas; probar la URL exacta, el modelo visible y su hash remoto. Conservar una versión recuperable anterior.

Para proyectos estructurados, consultar [GUIA.md](agentes/GUIA.md) y los contratos de `xixova/schemas/` antes de editar datos. Para sincronización desde Blender, seguir [BLENDER_MCP.md](agentes/BLENDER_MCP.md). Un GLB modificado manualmente no actualiza automáticamente los YAML.

## Ahorro de contexto y trabajo

- Leer primero esta guía y el estado compacto de la ejecución. Evitar volcar `scene.json`, listas completas de nodos, catálogos o logs extensos al chat. Extraer campos y conteos necesarios.
- Usar `contexto-agente`, después `--desde` con el resumen anterior, y `validar --compacto`, según la guía de agentes. Confirmar la sintaxis disponible antes de ejecutar comandos antiguos.
- Guardar scripts reproducibles e idempotentes por etapa, con comprobación del archivo de destino; no repetir grandes bloques de Python en cada llamada MCP. Mantener su modo seguro y respetar sus restricciones.
- Agrupar lecturas independientes. Tras un cambio, comprobar solo lo afectado; ampliar pruebas cuando aparezca una regresión o duda concreta.
- Guardar cámaras, hashes y métricas en archivos. Revisar tres imágenes por etapa; no generar nuevas variantes sin propósito ni exceder los ciclos acordados.
- Si se autorizan agentes, reutilizar un trabajador y pasarle rutas, estado y diferencias. Modelo, esfuerzo y número de agentes son decisiones de cada encargo, no requisitos universales.

Estado mínimo sugerido por ejecución:

```text
proyecto / variante / fuentes y hashes / dudas arquitectónicas
sesión protegida / maestro / copia web / GLB y hash
etapa y ciclos completados / cámaras fijas / scripts ejecutados
licencias y sustituciones / métricas / validaciones y limitaciones
aprobación vigente / integrado o no / despliegue y URL si corresponde
```

## Fallos que conviene evitar

| Señal | Causa observada o comprobación | Acción |
|---|---|---|
| El GLB nuevo existe pero la escena no cambia | El visor puede cargar `mobile`; declarar `premium` no activa una promoción pendiente | Inspeccionar solicitudes de red y `data-quality`; probar la carga real |
| Modelo tumbado o desplazado | Blender y el visor usan Z-up; glTF estándar usa Y-up | Aplicar la adaptación en el contenedor del visor cuando corresponda; validar puntos arquitectónicos y evitar doble conversión |
| Camas ausentes o muebles duplicados | Reglas por proyecto ocultan nodos o el demo añade decoración propia | Revisar `xixova_id`, `xixova_capa`, proxies y `editorialDetails`; comparar el conjunto visible |
| El material no cambia | Un slot `OBJECT` puede prevalecer sobre el material de la malla | Resolver overrides en la copia web y revisar Base Color, normales y rugosidad |
| Exportación pesada o texturas viejas | Escalar una imagen no garantiza actualizar su buffer empaquetado | Guardar la versión reducida, recargarla y empaquetarla; medir el GLB resultante |
| Material distinto en glTF | Cadenas Bump/MixRGB no se traducen necesariamente como en Cycles | Simplificar solo la copia web y verificar en navegador; no asumir equivalencia de render |
| Blender se cierra al cambiar visibilidad | Se observó al recorrer una colección mientras se modificaba | Tomar una lista estable de objetos antes de mutar y guardar checkpoints |
| Un render ignora la cámara elegida | Marcadores de cámara del timeline pueden sobreescribirla | Revisar bindings antes de renderizar vistas fijas |
| `/demo` devuelve 404 aunque `/` funciona | Artefacto incompleto o reglas de rutas no corresponden a sus HTML | Comprobar `demo.html`, configuración efectiva y URL completa; no culpar al DNS sin evidencia |
| Un build devuelve el apartamento anterior | `publicaciones/` es regenerable y puede sobrescribirse | Conservar el activo aprobado como fuente e incorporarlo explícitamente al build |
| Build aislado falla por archivos ausentes | Texturas usadas por imports pueden estar ignoradas por Git | Inventariar dependencias y preparar el entorno aislado sin modificar trabajo ajeno |

No generalizar los parches de Terraza Luz: su cargador selecciona directamente `premium` y aplica +90° sobre X. Otros proyectos y GLB antiguos pueden tener otra convención. Primero inspeccionar el contrato real.

## Puertas, activos y rendimiento

- Un ventanal con antepecho no confirma acceso a terraza. Registrar la duda; no inventar huecos. Colisiones nulas en la pose final no demuestran barrido libre ni cumplimiento normativo.
- Antes de descargar: comprobar dimensiones, licencia, geometría y texturas. Manifestar autor, ID del activo, licencia, ambiente, uso en maestro y sustituto web. Aplicar la política de distribución del proyecto; en Terraza Luz se usaron proxies propios para los activos Royalty Free.
- Conservar IDs estables y separar arquitectura, interiorismo y presentación. Ocultar techos para un corte visual no equivale a eliminarlos del maestro.
- Medir bytes, triángulos únicos y con repeticiones, primitivas, materiales, imágenes y memoria estimada. Menos MB no garantiza más FPS. Compartir mallas no demuestra instancing GPU; solicitar una extensión tampoco demuestra que se exportó.
- Considerar las pasadas de sombras y transmisión al interpretar draw calls. Identificar estimaciones de memoria como tales; no presentarlas como mediciones GPU.
- Acordar presupuestos por proyecto. En Terraza Luz: objetivo GLB ≤19,48 MB, hasta ~25 MB con justificación; 60 MB era el techo del paquete web acordado, no del GLB. Definir qué archivos componen ese paquete y medirlos explícitamente.

## Validación mínima de entrega e integración

**Maestro:** apertura limpia, texturas empaquetadas, arquitectura preservada, puertas y colisiones básicas, capturas de los encuadres acordados. Si no se simuló el barrido completo, declararlo.

**GLB:** carga sin errores, sin recursos externos involuntarios, IDs conservados, materiales compatibles, orientación comprobada con pisos/esquinas y métricas registradas.

**Visor real:** dos vistas desktop, nivel y URL del modelo correctos, muebles visibles sin duplicaciones detectables, controles afectados comprobados. Una comparación aislada no valida la integración con el demo.

**Publicación:** seguir [CATALOGO_WEB.md](CATALOGO_WEB.md), identificar proyecto Vercel por ID y nombre remoto vigente, construir con variables públicas sin mostrarlas, conservar HTML/rutas/activos. Validar la URL exacta y sus parámetros, con y sin `www` si se usan ambos. Comprobar HTTP, consola, captura y SHA-256 del GLB servido. Un estado `READY` solo confirma que terminó el despliegue.

**Persistencia:** guardar el modelo fuente aprobado y su integración en el build. Revisar metadatos de tamaño, niveles y manifiestos para que no describan archivos anteriores. Actualizar el estado de entrega tras aprobación/publicación; conservar informes previos identificados como históricos.

Detalles y resultados concretos: [caso Terraza Luz](apartamentos/TERRAZA_LUZ_2026-09-19.md). No abrirlo salvo que se necesiten rutas, métricas o antecedentes de esta ejecución.
