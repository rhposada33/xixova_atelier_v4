# XIXOVÁ — producción de video (Blender 4.5 LTS)

## Pipeline v3 fotorrealista

La escena activa de esta fase es `trabajo/xixova_recorrido_fotorrealista_v2.blend`
y la biblioteca externa es `xixova_interiores_v2.blend`. Ambas se crearon como
versiones nuevas: la escena completa y la biblioteca v1 permanecen intactas.

Los materiales CC0 se descargan reproduciblemente desde Poly Haven y se guardan
fuera de Git. El manifiesto conserva URL, autor, tamaño y SHA-256. La escena de
entrega empaca estos mapas. Los pilotos usan Cycles CUDA, 746×420 y 32 muestras.

```bash
bash produccion/xixova.sh pipeline preparar
bash produccion/xixova.sh pipeline construir --quality final
bash produccion/xixova.sh pipeline auditar-calidad
bash produccion/xixova.sh pipeline pilotos
bash produccion/xixova.sh pipeline comparar
bash produccion/xixova.sh pipeline estado
```

Después de aprobar los pilotos:

```bash
bash produccion/xixova.sh pipeline revisar       # 21 controles Cycles
bash produccion/xixova.sh pipeline animatica     # 840 PNG + MP4 económico
# Solo tras aprobar la animática:
bash produccion/xixova.sh pipeline render
bash produccion/xixova.sh pipeline montar
```

`optimizar-vram` consolida mallas repetidas sin cambiar cámaras ni reducir los
mapas de activos protagonistas. El catálogo v3 registra nivel de calidad, LOD,
mapas PBR, densidad texel, validación UV/normales, memoria y tomas de uso.

## Pipeline v2 declarativo (compatibilidad)

`proyecto.yaml` es la fuente única para rutas, siete tomas, perfiles y límites
de hardware. El lanzador usa `uv` para resolver YAML y entrega JSON sin
dependencias a Blender:

```bash
bash produccion/xixova.sh pipeline validar
bash produccion/xixova.sh pipeline estado
bash produccion/xixova.sh pipeline preparar
bash produccion/xixova.sh pipeline construir
bash produccion/xixova.sh pipeline camaras
bash produccion/xixova.sh pipeline revisar
bash produccion/xixova.sh pipeline animatica
bash produccion/xixova.sh pipeline render
bash produccion/xixova.sh pipeline montar
bash produccion/xixova.sh pipeline biblioteca
```

Cada salida v2 vive bajo un hash de configuración y escena. Antes de ejecutar
Blender se comprueban versión 4.5, CUDA, rango, cámaras y recursos ausentes; una
escena abierta por otro proceso queda bloqueada. `estado` informa progreso y ETA.
Los comandos históricos continúan disponibles durante la migración.

La escena de trabajo es `trabajo/xixova_produccion.blend`. Es una copia de la
escena Atelier ya construida, no una reconstrucción. Los archivos recibidos se
conservan en `originales/` y las copias de seguridad automáticas usan `.blend1`.

## Estado conocido

- 480 fotogramas, 24 fps, 20 segundos; cuatro tomas de 120 fotogramas.
- Final ligero aprobado: 746×420, Cycles, CUDA, muestreo adaptativo, 32 muestras,
  datos persistentes y denoise. Los intentos anteriores a 1080p (256 y 64
  muestras) se detuvieron y sus fotogramas de prueba se archivaron fuera de la
  secuencia final.
- Recursos empacados: 48/48 imágenes; no se encontraron rutas ausentes.
- Exterior: se conserva la corrección con coordenadas `Generated` y giro de 250°.
- Sofá: se importó desde Sketchfab `Modern three-seater sofa (Free)`, de
  `mk.ldeclaros`, con licencia CC Attribution. Se aplicó solo escala uniforme y
  mide 2,10 × 0,791 × 0,801 m. El chaise longue rechazado se conserva oculto.

## Pipeline separado

La construcción inicial sigue disponible en los scripts originales (`atelier.py`,
`atelier_base.py`, `atelier_recursos.py`) y no se ejecuta para ajustes posteriores.
`scripts/configurar_produccion.py` modifica únicamente la copia existente: crea
las cámaras, marcadores, animación y ajustes de render. `scripts/renderizar.py`
solo renderiza. Cada PNG válido existente se omite, por lo que volver a lanzar un
modo reanuda el trabajo.

## Comandos

Desde la raíz del proyecto:

```bash
bash produccion/xixova.sh copia       # solo si no existe la copia; nunca sobrescribe
bash produccion/xixova.sh configurar  # ajustes/cámaras sobre el .blend existente
bash produccion/xixova.sh mejorar     # realismo sobre xixova_fotorrealista.blend
bash produccion/xixova.sh revisar-realismo # 12 previas Cycles comparables
bash produccion/xixova.sh animatica-realismo
bash produccion/xixova.sh mp4-animatica-realismo
bash produccion/xixova.sh final-realismo # solo después de aprobación
bash produccion/xixova.sh mp4-final-realismo
bash produccion/xixova.sh copia-recorrido       # copia independiente; no sobrescribe
bash produccion/xixova.sh completar-recorrido  # mobiliario + biblioteca reusable
bash produccion/xixova.sh previews-biblioteca  # miniaturas del Asset Browser
bash produccion/xixova.sh configurar-recorrido # 7 tomas / 840 frames / 35 s
bash produccion/xixova.sh revisar-recorrido     # 21 controles Cycles
bash produccion/xixova.sh animatica-recorrido   # tras terminar zonas privadas
bash produccion/xixova.sh mp4-animatica-recorrido
bash produccion/xixova.sh final-recorrido       # solo después de aprobación
bash produccion/xixova.sh mp4-final-recorrido
bash produccion/xixova.sh revisar     # 12 previas Cycles: inicio/medio/final
bash produccion/xixova.sh animatica   # 480 PNG económicos y recuperables
bash produccion/xixova.sh mp4-animatica
bash produccion/xixova.sh final       # NO ejecutar antes de aprobar la animática
bash produccion/xixova.sh mp4-final   # montaje después de completar los 480 PNG
```

Para reanudar un subconjunto manualmente:

```bash
$HOME/Aplicaciones/blender-4.5/blender --background \
  produccion/trabajo/xixova_produccion.blend --factory-startup \
  --python-exit-code 1 --python produccion/scripts/renderizar.py -- \
  --modo final --frames 121-240
```

Los tiempos, omisiones y errores se agregan a `salidas/logs/*.jsonl`; el resumen
de la última ejecución queda en `salidas/estado_<modo>.json`. La configuración y
la auditoría están en `salidas/configuracion.json` y
`salidas/auditoria_escena.json`.

## Tomas

1. `T01_COMEDOR_GENERAL`, f1–120: comedor y apertura exterior.
2. `T02_MESA_DETALLE`, f121–240: mesa, vajilla y carpintería.
3. `T03_TERRAZA`, f241–360: corredera, terraza y orientación exterior.
4. `T04_BIBLIOTECA`, f361–480: biblioteca, arte y luz indirecta.

Las trayectorias usan tres claves con Bézier Auto Clamped. La comprobación de
volúmenes en inicio, medio y final no encontró cámaras dentro de paredes o
muebles. Las previas Cycles se inspeccionaron visualmente; se hizo una ronda de
corrección en T04 para centrar biblioteca y relieves.

## Versión fotorrealista 1.1

`trabajo/xixova_fotorrealista.blend` conserva la escena anterior y añade
microbiseles selectivos, microvariación de rugosidad, vidrio calibrado, mapas de
datos en Non-Color y profundidad de campo discreta. El HDRI permanece a 250° y
la vista continúa marcada como conceptual. Dos luces auxiliares ensayadas se
descartaron al detectar sus reflejos en el vidrio durante las previas.

Se validaron 12 fotogramas Cycles y una animática completa de 480 fotogramas. El
sofá recto de Sketchfab queda registrado en `CREDITOS.md` y en las propiedades
personalizadas del objeto; el chaise longue se conserva oculto del render. La
animática vigente se genera en `salidas/fotorrealismo/animatica_con_sofa/` para
conservar sin sobrescribir la revisión anterior.

## Recorrido completo (en preparación)

`trabajo/xixova_recorrido_completo.blend` es una copia independiente de la
versión fotorrealista. Conserva las cámaras anteriores como objetos, pero usa
siete marcadores propios y 840 fotogramas (35 segundos). La auditoría Cycles de
inicio, medio y final está en `salidas/recorrido/auditoria_v2/`.

La planta llega a cocina, circulación, suite principal, dos baños y suite
secundaria. Esas zonas se completan mediante
`scripts/completar_zonas_y_biblioteca.py`, que también genera 18 colecciones y
12 materiales reutilizables en
`/home/rafa/RenderCasa/biblioteca_blender/xixova_interiores_v1.blend`. El
catálogo versionable está en `catalogo_activos.json`; la biblioteca binaria no
entra en Git. Sus 18 colecciones y 12 materiales (30 activos) poseen miniatura.

Tras las dos rondas automáticas, el usuario autorizó un ajuste manual adicional
de cámara. Los 21 controles Cycles de `salidas/recorrido/aprobacion_manual/`
quedaron sin oclusiones negras. La animática vigente está en
`salidas/recorrido/animatica/xixova_recorrido_animatica.mp4`: H.264, 640×360,
24 fps, 840 fotogramas y 35 segundos. La secuencia final histórica completó sus
840 PNG; puede montarse con `mp4-final-recorrido`. Las ejecuciones nuevas del
pipeline v2 se aíslan por hash y no reutilizan silenciosamente esa secuencia.
