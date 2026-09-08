# Consolidación del pipeline de producción

`xixova/` es el único desarrollo activo. El pipeline anterior se conserva sin cambios funcionales en `legacy/produccion/` para reproducir escenas y comparar resultados históricos.

## Correspondencia de capacidades

| Capacidad anterior | Implementación activa |
| --- | --- |
| Validación de configuración, recursos y rangos | Contratos JSON Schema, `validar` y `preflight` |
| Render por fotograma y reanudación | `previas`, `animatica` y `recorrido` |
| Cycles, Workbench, muestras y denoise | Perfiles en `proyecto.yaml` |
| Montaje H.264 y FFprobe | Montaje y verificación automática de `animatica` y `recorrido` |
| Estado y ETA | `estado` |
| Inventario de 3 controles por toma | `auditar-calidad` |
| Comparación antes/después | `comparar --anterior ... --perfil ...` |
| Normalización y migración de biblioteca | `normalizar.py` y `migrar_activos.py` |
| Aislamiento por versión/configuración | Ruta de salida por proyecto, arquitectura, variante y hash |

Los constructores `configurar_*`, `mejorar_fotorrealismo.py` y `completar_zonas_y_biblioteca.py` permanecen en legacy porque contienen nombres y transformaciones exclusivos de los `.blend` históricos. Su resultado reutilizable ya está representado mediante los proyectos, catálogos y variantes de Xixova.

## Evidencia de migración

- Los tres proyectos activos validan con el contrato consolidado.
- 44 pruebas del framework activo pasan, incluidas producción, sincronización MCP y operaciones compactas.
- Las 5 pruebas del pipeline histórico pasan desde `legacy/produccion/tests`.
- Garden Ampliada pasa `preflight` con Blender 4.5.13, GTX 1060, 6 GB de VRAM y 16 GB de RAM.
- La auditoría de Garden produce 18 controles: inicio, mitad y final de sus seis cámaras.

El histórico se ejecuta, cuando sea necesario, con `bash legacy/produccion/xixova.sh ...`. No debe recibir proyectos ni funcionalidades nuevas.
