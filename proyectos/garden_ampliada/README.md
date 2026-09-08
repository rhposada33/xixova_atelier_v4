# Garden Ampliada — borrador desde imagen

Proyecto reconstruido a partir de la planta amueblada entregada en el chat, sin
cotas visibles. La escala se estimó usando una cama principal de 1,80 m. Antes
de considerar la geometría definitiva se necesita al menos una medida real del
apartamento, preferiblemente el ancho total o una pared larga.

La escena incluye jardín lateral y superior, cocina, comedor, sala, suite
principal, dormitorio secundario, circulaciones y tres baños. El primer vídeo
usa seis tomas de 80 fotogramas a 24 fps: jardín-comedor, jardín-lounge,
cocina, sala y ambos dormitorios. Total: 480 fotogramas, 20 segundos.

Los baños están modelados arquitectónicamente, pero no aparecen en el primer
recorrido porque la biblioteca actual no tiene piezas sanitarias individuales
adecuadas a sus dimensiones. La propuesta usa recursos ya disponibles en el
framework; no descarga activos externos.

```bash
uv run xixova_cli.py validar -p proyectos/garden_ampliada/proyecto.yaml
uv run xixova_cli.py componer -p proyectos/garden_ampliada/proyecto.yaml
uv run xixova_cli.py previas -p proyectos/garden_ampliada/proyecto.yaml
uv run xixova_cli.py animatica -p proyectos/garden_ampliada/proyecto.yaml
```

La animática es el vídeo de revisión. Tras aprobar dimensiones, distribución,
mobiliario y cámaras, se registra `confirmar-visual` y se ejecuta `recorrido`
para el render final de 746 × 420 y 32 muestras.
