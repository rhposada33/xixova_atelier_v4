# Conservar ajustes hechos mediante Blender MCP

La sincronización publica cambios de una escena generada en los documentos del proyecto. No instala otro servidor ni desactiva el modo seguro de Blender MCP. Los archivos arquitectónicos y las otras propuestas permanecen intactos.

## Qué se sincroniza

- Muebles existentes: posición, giro Z y escala uniforme positiva del objeto raíz `xixova_sync_role=elemento`. No modificar sus piezas internas.
- Materiales simples del proyecto: color RGB, rugosidad y metalicidad del Principled BSDF. Buscar por `xixova_material_id`, no por nombre visible.
- Luces de presentación existentes: posición, orientación, potencia, tamaño y color.
- Cámaras existentes: lente y poses de cada fotograma; al reconstruir se conservan las muestras del recorrido. La orientación se expresa mediante un objetivo, sin roll.
- Exposición y color/intensidad del entorno simple.

La captura comprueba las identidades y un resumen de la geometría, jerarquías, materiales y propiedades protegidas. Rechaza cambios arquitectónicos, ediciones de mallas/modificadores, objetos añadidos/eliminados, asignaciones de materiales y otros cambios no representables. No convierte objetos descargados en activos del catálogo: deben registrarse y reconstruirse primero. Los materiales PBR de recursos importados conservan su contenido; editar sus nodos requiere actualizar el recurso, no este flujo.

## Flujo compatible con el modo seguro de MCP

### 1. Construir una escena con referencia

```bash
uv run xixova_cli.py componer -p proyectos/estudio/proyecto.yaml --variante calida
```

La escena nueva guarda una referencia de los documentos fuente y del estado inicial. Las escenas anteriores a esta mejora necesitan reconstruirse antes de editar; no se puede determinar de forma fiable qué cambios ya habían recibido.

Abrir el `.blend` devuelto en Blender. MCP permite `bpy.ops.wm.open_mainfile(..., load_ui=False, use_scripts=False)`; comprobar antes si la escena abierta tiene cambios sin guardar. No sustituir trabajo ajeno sin conservarlo.

### 2. Ajustar un elemento mediante MCP

Ejemplo para `execute_blender_code`:

```python
import bpy
sofa = next(o for o in bpy.context.scene.objects
            if o.get('xixova_sync_role') == 'elemento'
            and o.get('xixova_id') == 'sofa')
sofa.location.x += 0.10
```

Los IDs del proyecto son estables aunque se cambie el nombre visible de un objeto. Mover el objeto raíz conserva juntas todas las piezas del recurso.

Las cámaras tienen claves. Para desplazar una toma, leer primero sus posiciones y después editar sus claves; una modificación de posición sin clave se rechaza al capturar. Ejemplo para una toma que ocupa los fotogramas 1–12:

```python
import bpy
scene = bpy.context.scene
camera = next(o for o in scene.objects
              if o.get('xixova_sync_role') == 'camara'
              and o.get('xixova_id') == 'estar')
poses = []
for frame in range(1, 13):
    scene.frame_set(frame)
    poses.append((frame, (camera.location.x + 0.04,
                          camera.location.y, camera.location.z)))
for frame, position in poses:
    camera.location = position
    camera.keyframe_insert(data_path='location', frame=frame)
scene.frame_set(1)
```

### 3. Guardar una copia desde MCP y capturar

```python
import bpy
bpy.ops.wm.save_as_mainfile(filepath='/ruta/absoluta/ajustes_mcp.blend', copy=True)
```

Esta operación está permitida por el modo seguro y conserva el archivo original. Después, desde el shell del agente:

```bash
uv run xixova_cli.py capturar -p proyectos/estudio/proyecto.yaml --variante calida \
  --escena /ruta/absoluta/ajustes_mcp.blend --captura cache/ajustes.json
uv run xixova_cli.py sincronizar -p proyectos/estudio/proyecto.yaml --variante calida \
  --captura cache/ajustes.json
```

El segundo comando solo muestra el cambio propuesto y sus diagnósticos. No escribe datos del proyecto. No aceptar una captura con errores.

### 4. Publicar y reconstruir

```bash
uv run xixova_cli.py sincronizar -p proyectos/estudio/proyecto.yaml --variante calida \
  --captura cache/ajustes.json --aplicar
uv run xixova_cli.py componer -p proyectos/estudio/proyecto.yaml --variante calida
```

Abrir la escena recién construida para continuar editando. La captura anterior pasa a estar desactualizada después de publicar y no puede volver a sobrescribir el proyecto. La nueva escena y las previas se generan en otra salida; la revisión visual anterior no se reutiliza.

## Publicación y conflictos

- Los hashes de proyecto, arquitectura, interiorismo, presentación y catálogo detectan modificaciones de los archivos desde la construcción. Un conflicto se comunica como `SINC_CONFLICTO`; no se intenta una mezcla automática.
- Los cambios se validan con el mismo núcleo que la construcción: medidas, encaje, colisiones, referencias y todos los fotogramas de las cámaras.
- La publicación escribe documentos nuevos en `sincronizados/<revision>/` y sustituye el manifiesto del proyecto al final, con bloqueo entre sincronizaciones. Una interrupción antes del reemplazo deja vigente la revisión anterior. Puede quedar un directorio huérfano, sin referencias activas.
- Se conserva una copia del manifiesto anterior y el listado de cambios en esa carpeta. Versionar los nuevos YAML y el manifiesto en Git junto con los demás datos del proyecto.
- `presentaciones` es un mapa opcional de variante a archivo de presentación. Permite ajustar cámaras o luces de una propuesta sin cambiar las demás. Si no existe una entrada, se utiliza `presentacion`, como antes.
- Un objeto movido adopta colocación explícita. Un ancla intacta se conserva si reproduce la pose capturada; si mover su referencia cambiaría la pose de otro mueble que no se movió en Blender, ese mueble también pasa a explícito. El informe lo indica.

## Captura directa en Blender sin las restricciones de importación del MCP

En la consola Python local de Blender se puede importar `xixova/blender_sync.py` y llamar a `capturar(salida)` para capturar el estado vivo sin guardar un `.blend`. `ajustar_camara(id, desplazamiento, lente)` modifica todas las claves de una toma. Estos ayudantes no son necesarios en MCP seguro: allí se usa la copia guardada y el CLI descritos arriba.
