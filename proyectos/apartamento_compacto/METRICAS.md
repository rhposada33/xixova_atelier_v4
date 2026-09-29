# Métricas de la prueba

## Entrega

- Arquitectura: 6 espacios, escala provisional basada en cama de 1,60 m.
- Interiorismo: 9 elementos del catálogo local.
- Presentación: 6 tomas de 80 fotogramas.
- Previas Cycles: 18/18 controles.
- Animática: H.264, 480×270, 24 fps, 480 fotogramas, 20 segundos.
- Preflight: correcto en Blender 4.5.13 LTS y NVIDIA GeForce GTX 1060.
- Blender MCP: escena, capas, IDs, cámaras, hash y variante comprobados.

## Ahorro de contexto

| Salida | Bytes | Tokens aproximados (bytes/4) |
| --- | ---: | ---: |
| `resolver` completo | 144.738 | 36.184 |
| `contexto-agente` | 6.276 | 1.569 |
| Diferencia evitada por carga | 138.462 | 34.616 |

Reducción medida: **95,66 %**. La aproximación de tokens sirve para comparar formatos; no representa el contador exacto del proveedor del modelo.

Además, 682.476 bytes de logs de Blender quedaron en archivos y no entraron en el contexto conversacional. La corrección del dormitorio izquierdo se verificó primero con 3 fotogramas selectivos frente a los 18 de una revisión completa, una reducción puntual de **83,33 %**.

No existe una API local que exponga el total exacto de tokens de toda la conversación. Ese valor debe tomarse del indicador de uso de la aplicación y compararse con estas métricas técnicas.
