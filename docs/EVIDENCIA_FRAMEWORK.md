# Evidencia del framework v1

Verificado el 6 de septiembre de 2026 con Blender 4.5.13 LTS y Cycles CUDA en GTX 1060 de 6 GB.

- 21 pruebas del núcleo y 5 del pipeline histórico correctas.
- Cuatro escenas auditadas dentro de Blender: pertenencia por capa, dimensiones, origen, posiciones y cada fotograma de cámara.
- Reconstrucción sin duplicados: 67 objetos de interiorismo en el estudio; la variante vecina permanece intacta.
- Interrupción real con SIGTERM del proceso de prueba: 35 fotogramas conservados y un pendiente regenerado; MP4 completo tras reanudar.
- Hash geométrico arquitectónico idéntico entre las dos variantes de cada proyecto.
- Cuatro MP4 H.264: 480 × 270, 12 fps, 24 muestras. Estudio: 36 fotogramas / 3 s; XIXOVÁ: 96 fotogramas / 8 s. Total: 264 fotogramas finales.

## Entregas

[Comparación local con vídeos, plantas y escenas](../resultados/framework/index.html). Los binarios y las revisiones locales no entran en Git.

| Proyecto | Variante | Geometría de arquitectura |
|---|---|---|
| estudio | calida | `94acb858a4a868a6` |
| estudio | mineral | `94acb858a4a868a6` |
| xixova | calida | `74de5ffd64003b09` |
| xixova | mineral | `74de5ffd64003b09` |

## Alcance visual y dimensional

Los fotogramas representativos de previas y animáticas se inspeccionaron visualmente. Se corrigieron orientaciones de camas, sofá y baños, y se desplazó el comedor fuera del paso de la corredera. Las demos conservan materiales PBR de activos existentes, pero usan acabados de superficies y entorno simplificados; no se presentan como una entrega comercial fotorrealista.

XIXOVÁ migra una geometría histórica aproximada. El cierre sur del baño principal se añadió por inferencia, registrada en el documento arquitectónico. Las medidas necesitan contrastarse con un plano real. El segundo apartamento es sintético. Las revisiones de ambos son técnicas y están identificadas como tales.

El motor recibe archivos estructurados elaborados por el agente que interpreta el plano; no incluye reconocimiento automático de planos, servicio de chat, CAD/BIM ni resolución de normativa. Las limitaciones geométricas y los comandos están descritos en la [guía de agentes](agentes/GUIA.md).
