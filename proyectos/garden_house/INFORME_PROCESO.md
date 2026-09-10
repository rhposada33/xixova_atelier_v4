# Garden House — informe de digitalización

## Resultado

- Arquitectura `0.1-borrador` construida desde datos y confirmada contra la cota fiable de 10,05 m.
- Variante `lujo_contemporaneo` regenerada en Blender 4.5.13 LTS con Cycles y GTX 1060.
- Guion Director de 20 segundos, 24 fps y cinco tomas de cuatro segundos.
- Animática completa: 480 fotogramas, 480 × 270, 20,000 segundos.
- Pilotos fotográficos: 15 imágenes, 960 × 540 y 64 muestras.
- El perfil final 1920 × 1080, 128 muestras, permanece preparado y sin renderizar.

## Mediciones

| Etapa | Resultado | Tiempo medido |
|---|---:|---:|
| Animática definitiva | 480/480 fotogramas | 228,98 s |
| Pilotos Cycles | 15/15 imágenes | 197,37 s |
| Piloto Cycles medio | 960 × 540, 64 muestras | 13,16 s/imagen |
| Contexto Director | 5 tomas, hash y diagnósticos | 659 bytes |
| Contexto agente general | arquitectura, elementos y presentación | 8.024 bytes |

El contexto de Director reduce aproximadamente 92 % los bytes entregados a una IA para editar el guion. Una proyección conservadora del vídeo final, escalando por píxeles y muestras, es de unas 14 horas; debe medirse primero con 24–48 fotogramas temporales.

## Auditoría final

- HDRI, 85 imágenes y 277 mallas disponibles.
- 48,3 MB de texturas cargadas; presupuesto declarado de 6 GB VRAM y 16 GB RAM respetado.
- Sin UV ausentes, archivos perdidos, licencias desconocidas, cámaras dentro de geometría ni altas luces recortadas.
- Sala, veranda, dormitorio y suite pasan el rango de ocupación del protagonista.
- `cocina_comedor` conserva una advertencia: ocupación 0,154 frente al mínimo 0,18. El encuadre muestra comedor y carpintería, pero la cocina histórica no tiene detalle suficiente para protagonismo.
- La auditoría fotográfica devuelve `ok: true` porque la advertencia no es estructural. La revisión humana debe exigir sustituir la cocina antes de un vídeo final de calidad alta.

## Problemas del proceso

1. Las cotas lineales y superficies de la planta comercial no cierran exactamente. Xixova necesita confianza y procedencia por cota, no sólo una referencia global.
2. La revisión de arquitectura reutiliza cámaras finales; las vistas del apartamento vacío pueden quedar pegadas a paredes. Debe generar cámaras ortográficas y axonométricas propias.
3. La reserva de puertas no conoce qué espacios conecta cada abertura y produjo falsos positivos con muebles vecinos.
4. Una cámara puede pasar la colisión binaria estando a centímetros del respaldo de un activo. Falta distancia mínima cámara–geometría.
5. El planificador no está usando de manera fiable el frente efectivo de los activos heredados.
6. La biblioteca curada sólo contiene un asiento publicado. Camas, comedor, cocina y baños tuvieron que reutilizar activos históricos de calidad visual limitada.
7. Las animáticas cargan geometría detallada en activos sin niveles publicados, aumentando su tiempo. Deben exigir proxies para Workbench.
8. Los pilotos generados por CLI no reaparecen como trabajos históricos al reiniciar Director. Hace falta un registro persistente de artefactos por hash para revisarlos directamente en la GUI.

## Próximo paso antes del vídeo final

Curar una cocina, dos camas y un comedor con niveles `proxy`, `standard` y `hero`; regenerar únicamente las tomas afectadas; ejecutar un piloto temporal de 24–48 fotogramas y aprobar visualmente la hoja de contactos desde Director. El render final no debe comenzar mientras la cocina siga marcada como recurso provisional.

