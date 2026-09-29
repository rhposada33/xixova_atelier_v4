# Migración al pipeline v2

La versión v2 no reutiliza automáticamente salidas históricas. Cada conjunto de
PNG vive bajo el hash combinado del YAML y de la escena para impedir mezclas.

Flujo recomendado para un proyecto nuevo:

```bash
bash produccion/xixova.sh pipeline validar
bash produccion/xixova.sh pipeline preparar
bash produccion/xixova.sh pipeline construir
bash produccion/xixova.sh pipeline biblioteca
bash produccion/xixova.sh pipeline camaras
bash produccion/xixova.sh pipeline revisar
bash produccion/xixova.sh pipeline animatica
bash produccion/xixova.sh pipeline render
bash produccion/xixova.sh pipeline montar
```

`pipeline estado` muestra el hash activo, progreso y ETA. Si cambia el YAML o el
`.blend`, se crea una salida nueva. Los comandos antiguos siguen disponibles en
`xixova.sh` para montar o consultar renders anteriores.

Variables portables:

```bash
export BLENDER_BIN="$HOME/Aplicaciones/blender-4.5/blender"
export XIXOVA_LIBRARY_DIR="$HOME/RenderCasa/biblioteca_blender"
export XIXOVA_OUTPUT_DIR="/ruta/a/resultados"
```

La biblioteca binaria y las imágenes permanecen fuera de Git. Sí se versionan
`proyecto.yaml`, `catalogo_activos.json`, `recetas_colocacion.json`, scripts,
pruebas y créditos.
