# Xixova framework v1

Motor local que compone **arquitectura + interiorismo + presentación + producción**. Los datos son la fuente de verdad; Blender genera escenas y renders. Este es el único pipeline activo; el código anterior se conserva congelado en `legacy/produccion/`.

## Proyectos incluidos

- `proyectos/xixova/`: migración explícitamente aproximada de la planta histórica, ocho tomas que incluyen las zonas principales y dos variantes: `calida` y `mineral`.
- `proyectos/estudio/`: planta sintética de 6 × 5 m, esquina oblicua, pilar, tres tomas y las mismas dos variantes.

Las variantes comparten arquitectura, biblioteca y presentación; cambian acabados y la posición de la mesa. Las demos usan 12 fps, 12 fotogramas por toma, 480 × 270 y 24 muestras finales para probar el circuito completo en una GPU de 6 GB. Son recorridos breves de integración, no entregas comerciales de alta resolución.

## Preparación

Requiere `uv`, Blender 4.5, FFmpeg y FFprobe. `uv run xixova_cli.py` resuelve PyYAML, JSON Schema y Shapely usando el archivo de dependencias bloqueadas `xixova_cli.py.lock`. Editar `produccion.blender` para usar otro ejecutable. Los datos aceptan rutas relativas y variables de entorno del sistema.

Los binarios están fuera de Git. En este workspace se prepararon en `cache/framework/activos/`. Para regenerarlos desde los recursos históricos locales:

```bash
~/Aplicaciones/blender-4.5/blender --background --factory-startup --python-exit-code 1 \
  --python xixova/migrar_activos.py -- \
  --biblioteca ~/RenderCasa/biblioteca_blender/xixova_interiores_v2.blend \
  --escena legacy/produccion/trabajo/xixova_recorrido_fotorrealista_v2.blend \
  --salida cache/framework/activos
```

Copiar el contenido del catálogo generado a los `catalogo.yaml` de los proyectos después de una regeneración: JSON también es YAML válido. Los SHA-256 deben corresponder a los binarios locales. Para otras bibliotecas, `normalizar.py` exporta copias con centro XY y base Z; verificar y corregir su orientación frontal antes de incorporarlas. `migrar_activos.py` contiene las orientaciones verificadas del constructor histórico.

## Uso

```bash
uv run xixova_cli.py validar -p proyectos/estudio/proyecto.yaml
uv run xixova_cli.py catalogo -p proyectos/estudio/proyecto.yaml --categoria Sala --ancho-max 2.2
uv run xixova_cli.py arquitectura -p proyectos/estudio/proyecto.yaml
# Inspeccionar planta.svg y arquitectura_previas/ en la ruta devuelta.
uv run xixova_cli.py confirmar-arquitectura -p proyectos/estudio/proyecto.yaml \
  --revisor "Nombre" --nota "Cotas, huecos y dudas revisados"
uv run xixova_cli.py componer -p proyectos/estudio/proyecto.yaml --variante calida
uv run xixova_cli.py previas -p proyectos/estudio/proyecto.yaml --variante calida
uv run xixova_cli.py animatica -p proyectos/estudio/proyecto.yaml --variante calida
# Inspeccionar imágenes y animática antes de registrar la revisión.
uv run xixova_cli.py confirmar-visual -p proyectos/estudio/proyecto.yaml --variante calida \
  --revisor "Nombre" --nota "Encuadres, materiales y recorrido revisados"
uv run xixova_cli.py recorrido -p proyectos/estudio/proyecto.yaml --variante calida
uv run xixova_cli.py estado -p proyectos/estudio/proyecto.yaml --variante calida
uv run xixova_cli.py preflight -p proyectos/estudio/proyecto.yaml --variante calida
uv run xixova_cli.py auditar-calidad -p proyectos/estudio/proyecto.yaml --variante calida
uv run xixova_cli.py comparar -p proyectos/estudio/proyecto.yaml --variante calida \
  --anterior /ruta/a/fotogramas/anteriores --perfil previa
```

Repetir desde `componer` para `mineral`. `resolver` imprime el paquete JSON completo, con posiciones resueltas y todos los fotogramas de las cámaras. `comprobar` ejecuta la misma auditoría espacial que `validar`.

Para sesiones de IA con poco contexto, usar `contexto-agente`, `validar --compacto` y `operar`. La [guía de agentes](../docs/agentes/GUIA.md) describe el flujo incremental y las previas por toma.

Las cámaras también pueden generarse desde intención visual compacta. `planificar-camaras`
convierte un guion de estancias, protagonistas y movimientos en las tomas numéricas que ya
consume Blender:

```bash
uv run xixova_cli.py planificar-camaras -p proyectos/mi_apto/proyecto.yaml --guion proyectos/mi_apto/guion_camara.yaml
uv run xixova_cli.py planificar-camaras -p proyectos/mi_apto/proyecto.yaml --guion proyectos/mi_apto/guion_camara.yaml --aplicar
```

El flujo fotográfico valida recursos y encuadres antes de comprometer un render 1080p:

```bash
uv run xixova_cli.py preparar-realismo -p proyectos/mi_apto/proyecto.yaml
uv run xixova_cli.py pilotos-fotograficos -p proyectos/mi_apto/proyecto.yaml
uv run xixova_cli.py auditar-fotografia -p proyectos/mi_apto/proyecto.yaml
uv run xixova_cli.py piloto-temporal -p proyectos/mi_apto/proyecto.yaml
uv run xixova_cli.py recorrido -p proyectos/mi_apto/proyecto.yaml --perfil fotografico_1080p
```

`presentacion.yaml` puede declarar HDRI, sol físico, temperatura de luces, gestión de
color, exposición por toma y postproducción. Los materiales admiten mapas de color,
roughness, normal y height con escala métrica. El descargador reproducible
`xixova/descargar_recursos_pbr.py` conserva procedencia, licencia y SHA-256 de los mapas CC0.

Cada perfil acepta opcionalmente `motor` (`CYCLES` o `BLENDER_WORKBENCH`), `denoise`, `umbral_adaptativo`, `crf` y `preset`. Los valores ausentes conservan el comportamiento anterior. La [evidencia de consolidación](../docs/CONSOLIDACION_PRODUCCION.md) relaciona las funciones migradas con el pipeline archivado.

## Garantías de separación y reanudación

Las colecciones Blender son `ARQUITECTURA`, `INTERIORISMO` y `PRESENTACION`; cada objeto tiene propiedades de pertenencia. Los informes contienen un hash geométrico arquitectónico independiente de materiales. Las construcciones parten de una escena vacía y se guardan por variante, sin duplicar objetos ni editar bibliotecas de origen.

Las salidas se aíslan por proyecto, versión de arquitectura, variante y hash de datos, recursos declarados y código del motor. Las revisiones arquitectónicas se vinculan al hash completo de arquitectura. Una modificación externa del `.blend` impide renderizarlo hasta reconstruirlo. El bloqueo por variante evita operaciones simultáneas sobre la misma salida.

Los PNG se escriben en temporales y se renombran al terminar; se comprueban dimensiones y marcador de cierre antes de reutilizarlos. El MP4 se monta únicamente con la secuencia completa y se verifica con FFprobe. Repetir `animatica` o `recorrido` reanuda los fotogramas pendientes.

Los valores de RAM/VRAM son presupuestos declarados del proyecto, no límites duros del proceso Blender. La selección CUDA cae a CPU si no hay dispositivo disponible. No se garantiza encaje en memoria para bibliotecas nuevas: probar primero las previas.

## Pruebas

```bash
uv run --with pyyaml --with jsonschema --with shapely python -m unittest discover -s xixova/tests -v
```

Contratos: `xixova/schemas/`. Instrucciones para interpretar planos y corregir proyectos: [guía de agentes](../docs/agentes/GUIA.md). Crédito del sofá importado: `CREDITOS.md`; el catálogo conserva autor y licencia. No se han descargado activos nuevos.

## Biblioteca curada

La biblioteca global conserva originales de BlenderKit localmente y publica copias normalizadas `hero`, `standard` y `proxy`. El flujo habitual es:

```bash
uv run xixova_cli.py biblioteca buscar --consulta "luxury editorial sofa" --categoria asientos
uv run xixova_cli.py biblioteca candidatos --entrada resultados_blenderkit.json
uv run xixova_cli.py biblioteca descargar --id ID --archivo /ruta/descarga.blend
uv run xixova_cli.py biblioteca evaluar --id ID --entrada auditoria.json --puntuacion-materiales 8 --puntuacion-geometria 8
uv run xixova_cli.py biblioteca aceptar --id ID
uv run xixova_cli.py biblioteca publicar --id ID
uv run xixova_cli.py biblioteca auditar
```

`XIXOVA_BIBLIOTECA` cambia la raíz (por defecto `biblioteca/`) y `XIXOVA_BLENDER` indica el ejecutable usado al crear niveles. Los resultados extensos de Blender se guardan en archivos; el catálogo común sólo contiene metadatos y hashes.

## Compilador fotográfico

Todos los proyectos pueden usar el perfil `lujo_editorial_golden_hour` y el flujo completo con un único comando:

```bash
uv run xixova_cli.py mejorar-realismo -p proyectos/apartamento_compacto/proyecto.yaml --variante natural_lila
uv run xixova_cli.py auditar-realismo -p proyectos/apartamento_compacto/proyecto.yaml --compacto
```

Los comandos `enriquecer-arquitectura`, `asignar-activos`, `resolver-iluminacion`, `resolver-camaras`, `corregir-realismo`, `informe-visual` y `aprobar-realismo` permiten ejecutar cada etapa por separado. El ensamblador conserva la arquitectura confirmada y crea los detalles en `ENRIQUECIMIENTO`. Las correcciones deterministas usan hasta dos rondas; sólo los diagnósticos restantes pasan al agente.

## Xixova Director

El Director abre un editor local WebGL con planta sincronizada, árbol de escena,
reproducción desde la cámara activa, gizmos y timeline de cámaras, objetos, puertas,
luces y materiales. La vista libre usa controles tipo Blender: botón central para
orbitar, `Shift` + botón central para desplazar, rueda para zoom, `F` para encuadrar
la selección y `Home` para ver el proyecto completo:

```bash
uv run xixova_cli.py director -p proyectos/apartamento_compacto/proyecto.yaml \
  --variante natural_lila
```

Los guiones publicados se guardan en `.director/VARIANTE/guiones/` y sus autosaves
en `.director/VARIANTE/borradores/`. El selector superior permite crear, abrir,
duplicar, renombrar, archivar e importar una copia del antiguo `guion_camara.yaml`,
que permanece intacto. Director rechaza cambios si un YAML del proyecto cambió
desde que se abrió. `Vista rápida`, `Validar toma`, la animática y el render
construyen una escena aislada por el hash completo del guion.

La interfaz pública incluye `/api/project`, `/api/scene.glb`, `/api/script`,
`/api/scripts`, `/api/commands`, `/api/validate`, `/api/preview/frame`,
`/api/preview/shot`, `/api/animatic`, `/api/render` y el WebSocket `/api/jobs`.
`/api/context` devuelve el contexto compacto para una IA, normalmente muy por
debajo de 4 KB.

## Informe de las entregas

Después de producir los cuatro recorridos, se puede regenerar la comparación local:

```bash
uv run scripts/informe_framework.py proyectos/estudio/proyecto.yaml proyectos/xixova/proyecto.yaml
```

Abre `resultados/framework/index.html`. Incluye vídeos sincronizables por proyecto, plantas, escenas y los hashes geométricos comparados. Los informes y binarios generados permanecen fuera de Git.

La auditoría de integración se puede ejecutar con Blender sobre una escena generada:

```bash
~/Aplicaciones/blender-4.5/blender --background --factory-startup --disable-autoexec RUTA/escena.blend \
  --python-exit-code 1 --python xixova/tests/auditar_blender.py -- --datos RUTA/resuelto.json
```

`xixova/tests/probar_reanudacion.py` comprueba una interrupción real sobre una animática ya generada: conserva todos salvo el último fotograma, interrumpe su propio proceso y verifica que al reanudar se regeneró el pendiente sin tocar los anteriores. Usar únicamente sobre salidas de prueba.

## Ajustes con Blender MCP → YAML

Las escenas nuevas incluyen una referencia de sincronización. Ahora pueden conservarse cambios de muebles, materiales simples, luces, cámaras y exposición realizados en Blender. El modo seguro de MCP usa una copia `.blend` guardada, seguida de `capturar` y `sincronizar`; no requiere importar módulos externos dentro de MCP.

```bash
uv run xixova_cli.py capturar -p proyectos/estudio/proyecto.yaml --variante calida \
  --escena /ruta/ajustes_mcp.blend --captura cache/ajustes.json
uv run xixova_cli.py sincronizar -p proyectos/estudio/proyecto.yaml --variante calida \
  --captura cache/ajustes.json
# Publicar los cambios validados:
uv run xixova_cli.py sincronizar -p proyectos/estudio/proyecto.yaml --variante calida \
  --captura cache/ajustes.json --aplicar
uv run xixova_cli.py componer -p proyectos/estudio/proyecto.yaml --variante calida
```

Se publican nuevos YAML y se actualiza el manifiesto al final. Las otras variantes y la arquitectura permanecen intactas. Se rechazan capturas desactualizadas, colisiones y cambios que el contrato no puede representar. Las escenas antiguas deben reconstruirse antes de iniciar una edición sincronizable.

Consulta el [flujo completo de Blender MCP](../docs/agentes/BLENDER_MCP.md), incluidas las claves de cámara y la conservación de anclajes.
