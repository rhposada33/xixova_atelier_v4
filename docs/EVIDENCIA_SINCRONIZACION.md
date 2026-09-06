# Sincronización Blender MCP → proyecto

Verificación realizada sobre una copia de prueba del estudio. Los proyectos y variantes de las entregas anteriores no se editaron.

## Prueba real mediante MCP en modo seguro

1. Construcción de la escena con identificadores y referencia de sincronización.
2. Apertura mediante `bpy.ops.wm.open_mainfile`, sin ejecutar scripts del archivo.
3. Edición mediante MCP: sofá desplazado 10 cm, giro de 0,08 radianes y escala 1,01; color de pared; luz de 95 W; exposición 0,15; lente de 28 mm y traslado de 4 cm de las doce claves de la primera toma.
4. Copia guardada con `bpy.ops.wm.save_as_mainfile(copy=True)`, operación permitida por el modo seguro.
5. Captura, revisión de seis cambios y publicación de los YAML; reconstrucción desde esos documentos.
6. Comparación de todos los campos sincronizables entre la escena editada y la reconstruida: iguales dentro de una tolerancia de 0,00001. Hash geométrico arquitectónico idéntico. Datos de la variante mineral idénticos.
7. Apertura de la escena reconstruida mediante MCP y comprobación de los valores persistidos. Quedó abierta la demo reconstruida.

La mesa no se movió en Blender. Como estaba anclada al sofá que sí se desplazó, su colocación pasó a explícita para conservar su posición visual. El informe de cambios registra esa decisión.

- [Proyecto de la prueba](../cache/sync/demo/proyecto.yaml)
- [Cambios publicados](../cache/sync/demo/aplicacion.json)
- [Resultado de la comparación](../cache/sync/demo/verificacion.json)
- [Conflicto de captura antigua rechazado](../cache/sync/demo/conflicto.json)

Los artefactos de prueba están en caché, fuera de Git. Los cambios de proyectos reales se publican bajo su propia carpeta `sincronizados/` y deben versionarse junto con el manifiesto.

## Pruebas automatizadas

- 32 pruebas del núcleo/framework, incluidas 11 nuevas de sincronización, correctas.
- 5 pruebas del pipeline histórico correctas.
- Prueba adicional dentro de Blender: detecta desplazamiento arquitectónico, edición de vértices, escala no uniforme y cámara modificada sin insertar clave; restaura el cambio vivo al rechazar la captura.
- Captura de una escena sin cambios: cero cambios propuestos y ninguna publicación.
- Captura antigua después de publicar: `SINC_CONFLICTO`, sin escritura.
- Fallo simulado antes del reemplazo final del manifiesto: el proyecto anterior sigue siendo válido.

Ver el [flujo y sus límites](agentes/BLENDER_MCP.md). No se desactivó el modo seguro del MCP. La importación directa de módulos fue rechazada y se utilizó el flujo permitido de copia de escena más CLI.
