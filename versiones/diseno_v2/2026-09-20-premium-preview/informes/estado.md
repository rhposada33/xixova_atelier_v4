# Estado de la vista previa V2

## Protección

- Fuentes originales inventariadas en `../baseline/original-sha256.txt`.
- Copias editables bajo `../workspace/`; artefactos de catálogo bajo
  `../artefactos/catalogo/`.
- La interfaz muestra `Vista previa V2`. No se ha publicado ni sustituido ningún
  activo original.
- La verificación final detectó una modificación regenerable fuera de V2:
  `xixova/maquette_web/node_modules/.vite/deps/_metadata.json`. La produjo el
  servidor local usado para capturar la referencia. No es código fuente, GLB,
  YAML ni artefacto publicado; se registra y no se restaura automáticamente.

## Diagnóstico inicial

| Área | Hallazgo | Tratamiento V2 |
| --- | --- | --- |
| Terraza Luz | Acabados planos y reflejos insuficientes | Entorno PMREM local, acabados PBR en tiempo de ejecución y SSAO de calidad alta. |
| Terraza Luz | Lectura comprometida por cortes y elementos altos | Ajuste de encuadre y paneles para mantener la escena visible. |
| Escobar | La referencia del edificio y sus 72 proxies ya son V2 aislables | Se conserva el binding y se validará durante la ronda de edificio. |
| Garden House | Dos normales PBR referenciados no están disponibles en las fuentes | La copia V2 usa el atlas local sin depender de recursos inexistentes. |

## Validación actual

- Compilación V2: correcta.
- Pruebas unitarias: 79 aprobadas, 4 omitidas.
- Lint: correcto.
- Se realizaron tres rondas visuales contra la referencia generada; las
  capturas están en `../comparativas/`.
- La suite de interfaz empezó correctamente y validó la primera navegación de
  Garden House; el proceso local de Playwright perdió su servidor efímero antes
  de completar las seis pruebas. Sus dos fallos restantes son de conexión y de
  estabilidad del servidor, no de una aserción visual registrada. Repetir la
  suite desde un terminal persistente antes de un checkpoint de sustitución.
- Los hashes de código, modelos, YAML y artefactos protegidos permanecen sin
  cambios; ver la nota de caché en Protección.
- Pendiente: medición de rendimiento en hardware real y optimización del GLB
  móvil de Garden House para cumplir el presupuesto de 10 MB.
