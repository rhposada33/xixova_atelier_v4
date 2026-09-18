re# Lecciones para producir vídeo en XIXOVÁ

Guía de recuperación rápida para futuras tareas de vídeo. Resume lo comprobado en el pipeline actual y en las pruebas históricas; no sustituye a los YAML, al estado de la escena ni a una revisión visual. No describe la landing Promoven ni afirma que haya un vídeo nuevo publicado con ella.

## Ruta corta antes de renderizar

1. Identificar `proyecto.yaml`, variante, presentación, guion de cámara y perfil de producción. Revisar `git status` y ejecutar `validar --compacto` y `estado`; no reutilizar una salida de otra versión de escena o perfil.
2. Confirmar arquitectura y escala fiable; no convertir cotas inferidas de píxeles en medidas reales. Ejecutar `componer` y comprobar el hash de `escena.blend` contra `escena.manifest.json` antes de renderizar.
3. Inspeccionar tres fotogramas por toma (inicio, medio y fin) con `previas --toma <id>`; corregir encuadre, oclusiones, interiores y continuidad antes de gastar tiempo en el recorrido completo. La hoja `contacto.jpg` permite revisar las tomas rápidamente.
4. Para calidad fotográfica, pasar por `preparar-realismo`, `pilotos-fotograficos`, `auditar-fotografia` y `piloto-temporal` (48 fotogramas consecutivos). Revisar sombras, reflejos, parpadeo, altas luces y movimiento; la auditoría automática no sustituye la inspección humana.
5. Generar la animática completa e inspeccionarla antes de `confirmar-visual`. Solo después iniciar `recorrido --perfil fotografico_1080p` u otro perfil final declarado en el proyecto. No presentar el MP4 como final si la revisión visual o las medidas siguen pendientes.

Ejemplo de comandos, adaptando proyecto y variante:

```bash
uv run xixova_cli.py validar -p proyectos/estudio/proyecto.yaml --variante calida --compacto
uv run xixova_cli.py estado -p proyectos/estudio/proyecto.yaml --variante calida
uv run xixova_cli.py previas -p proyectos/estudio/proyecto.yaml --variante calida --toma estar
uv run xixova_cli.py animatica -p proyectos/estudio/proyecto.yaml --variante calida
```

La secuencia completa, revisiones obligatorias y sintaxis de aprobación están en [la guía de agentes](agentes/GUIA.md). Para las herramientas y salidas del pipeline histórico, consultar [producción legacy](../legacy/produccion/LEEME_PRODUCCION.md); no mezclar sus carpetas de fotogramas con las del pipeline actual.

## Lo que evitó trabajo perdido

- Renderizar a PNG por fotograma, no directamente a MP4. `xixova/render.py` valida dimensiones e integridad, omite PNG completos al reanudar, escribe cada fotograma mediante un temporal y registra tiempos en `render.jsonl`. Se verificó una interrupción real y una reanudación que conservó 35 fotogramas válidos ([evidencia](EVIDENCIA_FRAMEWORK.md)).
- Mantener salidas aisladas por identidad de datos, perfil y código de render. Si `dependencias.json` no coincide, crear otra salida; no mezclar fotogramas anteriores con una escena modificada. La escena compilada tiene su propio manifiesto SHA-256.
- Ejecutar `estado` para progreso y estimación, y leer `logs/` si Blender falla. No asumir que un proceso largo terminó porque produjo algunos PNG.
- Montar el MP4 solo después de validar la secuencia completa. El pipeline usa H.264, `yuv420p` y `+faststart`, verifica resolución y número de fotogramas con `ffprobe` y publica el archivo final mediante reemplazo atómico. Conservar los PNG hasta aprobar el vídeo.
- Comparar fotogramas equivalentes al cambiar materiales, luz o cámara; `comparar` y las hojas de contacto reducen revisiones subjetivas y permiten detectar regresiones antes del render final.

## Límites y puntos de control

- Un render técnicamente correcto no garantiza una cámara sin oclusiones ni un acabado comercial. Revisar inicio/medio/final de cada toma y un tramo temporal consecutivo; corregir antes de subir resolución o muestras.
- Los ejemplos históricos de [evidencia del framework](EVIDENCIA_FRAMEWORK.md) son demos económicas de 480 × 270, 12 fps y 24 muestras, no una referencia de calidad final. El recorrido legacy documentado tiene 840 fotogramas a 24 fps; esas cifras pertenecen a aquel proyecto y no deben copiarse a uno nuevo sin revisar su YAML.
- No modificar una escena de usuario sin guardar una copia. Para ajustes mediante Blender MCP, usar el flujo de [captura y sincronización](agentes/BLENDER_MCP.md); una copia `.blend` editada fuera del contrato no sustituye automáticamente los documentos fuente.
- Registrar en cada entrega: proyecto/variante y hash, perfil y resolución, fps, número esperado y real de fotogramas, ruta de PNG/MP4, resultado de `ffprobe`, estado de revisión visual, licencias de activos y dudas pendientes.

Actualizar esta guía solo cuando una nueva producción confirme otra lección. Poner parámetros y resultados específicos de cada vídeo en su informe propio, no en `AGENTS.md`.
