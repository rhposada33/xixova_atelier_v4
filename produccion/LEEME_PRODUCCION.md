# XIXOVÁ — producción de video (Blender 4.5 LTS)

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
