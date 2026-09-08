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
