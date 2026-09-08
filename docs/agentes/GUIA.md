# Crear proyectos para Xixova

Xixova recibe datos; el agente interpreta planos PNG/JPG o páginas de PDF y ejecuta los comandos. No hay un servicio de reconocimiento de planos ni una API de chat integrada. El motor no ejecuta Python generado por el agente ni exige un proveedor de IA.

## Contrato de trabajo

1. Copiar la estructura de `proyectos/estudio/` para un proyecto nuevo. Leer los contratos de `xixova/schemas/` antes de editar. Cada documento usa `schema: 1` y rechaza campos desconocidos.
2. Conservar el plano original y registrar su ruta y procedencia en `arquitectura.fuentes`. Registrar dimensiones dudosas en `dudas`. No presentar dimensiones deducidas de píxeles como mediciones reales. Establecer la escala con una cota conocida; si falta, solicitarla. La arquitectura histórica de XIXOVÁ es aproximada.
3. Describir una planta en metros, XY horizontal y Z vertical. Los contornos delimitan espacios; las paredes tienen eje, espesor y altura. Las aberturas se miden desde `a` hacia `b`, con distancia, ancho, alto y antepecho. No duplicar una pared compartida. Los pilares usan contornos poligonales. Registrar instalaciones existentes como puntos fijos.
4. Generar `arquitectura`, inspeccionar `planta.svg` y las vistas vacías. Corregir cotas y distribución; entonces registrar `confirmar-arquitectura --revisor ... --nota ...`. Para un inmueble real, obtener la confirmación de quien conoce el plano. Los ejemplos sintéticos pueden tener revisión técnica del agente explícitamente identificada.
5. Vincular cada interiorismo a `{id, version, hash}` de la arquitectura. `validar` devuelve el hash vigente. Cambiar el hash manualmente no equivale a revisar una propuesta: comprobar todas sus colocaciones tras una reforma. El registro arquitectónico anterior deja de aplicarse al nuevo contenido.
6. Consultar `catalogo`, seleccionar recursos existentes y usar escala uniforme. El origen de un activo es el centro XY de sus límites, con base Z=0 y frente +Y. Las dimensiones son las del recurso completo, no las nominales comerciales.
7. Ejecutar `validar` y atender cada diagnóstico por su `elemento`. Modificar únicamente la capa responsable. Después ejecutar `componer`, `previas` y `animatica`, inspeccionar las imágenes y registrar `confirmar-visual` antes de `recorrido`.
8. Entregar rutas de imágenes, vídeo y escena, más dudas pendientes. No afirmar fotorrealismo o fidelidad dimensional basándose únicamente en que el render terminó.

## Capas

- Arquitectura: geometría base, huecos, vidrio fijo y puntos de instalaciones. Una reforma crea otra versión.
- Interiorismo: activos y materiales asignados a superficies estables. Los identificadores de pisos/techos son `espacio:piso` y `espacio:techo`; paredes y pilares usan su propio ID.
- Presentación: cámaras, luz fotográfica y mundo. Mantener este documento idéntico entre variantes para compararlas.
- Producción: biblioteca, calidad, fps, equipo y salidas. El perfil final de los ejemplos es deliberadamente económico; aumentar resolución y muestras genera otra ejecución aislada.

## Anclajes

```yaml
# Posición explícita: base del recurso, metros; ángulo en grados sobre Z.
colocacion: {tipo: explicita, posicion: [2.0, 3.0, 0], rotacion: 180}

# Centroide de la estancia más desplazamiento global.
colocacion: {tipo: espacio, desplazamiento: [0.2, 0, 0], rotacion: 0}

# Distancia desde a a lo largo del eje. lado=1 es su izquierda; -1 su derecha.
# El respaldo mira a la pared y el frente del activo hacia la habitación.
colocacion: {tipo: pared, referencia: norte, distancia: 2.0, lado: 1, separacion: 0.08}

# Desplazamiento en los ejes locales del otro objeto; suma su rotación.
colocacion: {tipo: objeto, referencia: sofa, desplazamiento: [0, 1.0, 0]}
```

Se rechazan referencias ausentes y ciclos. No se resuelven automáticamente layouts imposibles. Las colisiones usan volúmenes envolventes orientados, por lo que conjuntos con huecos interiores pueden producir falsos positivos. La holgura del activo se aplica entre muebles; las puertas reservan una zona conservadora a ambos lados del hueco. La comprobación de cámaras evalúa cada fotograma con un margen de 5 cm; un objetivo detrás de una pared todavía necesita revisión visual del encuadre.

## Correcciones y límites

Los diagnósticos JSON contienen `codigo`, `gravedad`, `elemento` y `explicacion`. Los comandos fallidos salen con código distinto de cero. No omitir errores para conseguir un render. No mover paredes para encajar muebles dentro de una variante decorativa.

La versión 1 admite una planta, paredes rectas oblicuas u ortogonales y huecos rectangulares. No importa CAD/BIM, no resuelve escaleras ni muros curvos, ni certifica normativa constructiva. Las puertas se representan mediante huecos abiertos; no se simulan hojas, herrajes ni mecanismos. La luz exterior inicial es un mundo uniforme; un entorno real requiere ampliar el contrato de presentación. Los materiales PBR empacados de los activos se conservan.

## Ajustes desde Blender MCP

Para conservar cambios hechos sobre una escena abierta, seguir [Blender MCP → YAML](BLENDER_MCP.md). Usar los IDs y objetos raíz etiquetados, guardar una copia, capturar, validar la diferencia y sincronizar. No cambiar la arquitectura para encajar muebles y no saltarse conflictos de versiones. Después de publicar, reconstruir y continuar sobre la nueva escena.

## Interfaz compacta para agentes

No uses `resolver` como contexto habitual: incluye la escena completa y todos los fotogramas interpolados. Obtén el resumen persistente con:

```bash
uv run xixova_cli.py contexto-agente -p proyectos/estudio/proyecto.yaml --variante calida
```

El comando guarda `contexto-agente.json` en la salida versionada. En el turno siguiente, indica ese archivo con `--desde`; la salida contendrá únicamente las secciones cuyo fingerprint cambió. Para diagnósticos breves usa `validar --compacto`.

Las ediciones usan `schemas/operaciones.json`. `operar` simula por defecto y devuelve cambios y diagnósticos en JSON compacto. `--aplicar` publica el resultado validado:

```bash
uv run xixova_cli.py operar -p proyectos/estudio/proyecto.yaml --variante calida \
  --operaciones docs/agentes/operaciones-ejemplo.yaml
uv run xixova_cli.py operar -p proyectos/estudio/proyecto.yaml --variante calida \
  --operaciones docs/agentes/operaciones-ejemplo.yaml --aplicar
```

Las acciones son `mover_elemento`, `cambiar_activo`, `anadir_elemento`, `eliminar_elemento`, `aplicar_acabado`, `ajustar_luz`, `ajustar_toma` y `crear_variante`. No mezcles interiorismo y presentación en una ejecución. Cada solicitud exige el hash vigente de arquitectura.

Para corregir una cámara, renderiza solo sus tres puntos representativos. También se genera `previa/contacto.jpg`:

```bash
uv run xixova_cli.py previas -p proyectos/estudio/proyecto.yaml --variante calida --toma estar
```

Blender escribe su salida extensa en `logs/`; el terminal recibe únicamente inicio, fin y ruta del proceso.
