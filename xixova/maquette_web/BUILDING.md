# Vista general del edificio

Esta primera versión es una interpretación arquitectónica e inventario de demostración. No es una reconstrucción exacta, BIM ni oferta comercial. El objetivo visual está en `.dream-loop/target.png`; la captura anterior en `.dream-loop/baseline.png` mostraba el visor interior. El cambio crea una portada de edificio independiente conservando ese visor.

## Análisis de la referencia

La torre tiene una silueta residencial esbelta, aproximadamente tres veces más alta que ancha. Se aprecian dos alas claras articuladas por una franja vertical oscura, líneas horizontales de balcones profundos, carpintería oscura y barandas de vidrio. Las fachadas laterales son más cerradas y tienen ventanas horizontales pequeñas. Los balcones se agrupan mediante marcos bronce oscuro y luz lineal cálida. En la parte superior hay retranqueos y dos grandes aleros oscuros a cotas distintas. El acceso está protegido por una marquesina sobre un podio cálido, con cerramiento y vegetación tropical. La referencia sitúa el conjunto en un contexto costero brasileño al atardecer.

La fotografía original no tenía una ruta de archivo accesible al worker de implementación. Se usó el objetivo visual suministrado por el coordinador, que conserva esos rasgos, junto con la descripción detallada del usuario. No se copiaron vecinos, coches, personas, marcas de agua ni logotipos de la fotografía.

## Suposiciones de reconstrucción

- Se mantienen las 18 plantas residenciales solicitadas y cuatro unidades por planta: 72 unidades, 54 disponibles, 6 reservadas y 12 vendidas. Planta baja, podio y coronación no se cuentan como viviendas.
- Altura provisional entre plantas: 3,15 m. Base residencial: 4 m. Huella conceptual: aproximadamente 24 × 34 m. Coronación: aproximadamente 64 m. Son parámetros de presentación, no medidas deducidas con precisión de la fotografía.
- Dos alas simétricas en planta, aleros superiores a distinta altura y núcleo central de grafito. Las caras posteriores se interpretan con el mismo lenguaje; no se afirma que reproduzcan el edificio real.
- Los finales 03 y 04 ocupan la fachada de acceso; los finales 01 y 02, la opuesta. Los cuatro proxies cubren volúmenes independientes, sin interiores modelados.
- Las orientaciones cardinales, vista, precio, sol de mañana/tarde, áreas y dormitorios son provisionales. La clasificación de sol se deriva de la orientación y no de un estudio solar validado para una parcela real.
- Hay tres tipologías comerciales en cuatro posiciones: final 01 familiar de 118 m² y 3 dormitorios; final 02 compacta de 82 m² y 2 dormitorios; final 03 compacta ampliada de 96 m² y 3 dormitorios; final 04 esquina de 146 m² y 4 dormitorios. Las plantas 17 y 18 reciben 8 m² extra como hipótesis de terraza.
- Precio base por tipología, incremento de R$ 35.000 por piso, prima de R$ 120.000 para vista al mar y R$ 150.000 para plantas superiores. Todos estos precios son ficticios.
- Los finales 01 y 04 enlazan a `garden_house_18`; los finales 02 y 03 a `terraza_luz`, siempre como tipologías ilustrativas. No se afirma que sus plantas correspondan exactamente al apartamento exterior seleccionado.

La configuración comercial y tipológica está en `src/building/inventory.ts`, fuera de los componentes; el generador de geometría y sus medidas están en `building_model.py`. Cambiar niveles o medidas exige regenerar ambos contratos y revisar el inventario. Los IDs de proxies son el vínculo entre ambos.

## Activo Blender y jerarquía

El modelo se construyó y exportó mediante Blender MCP, en una escena nueva `XIXOVA_BUILDING`, preservando la escena inicial. El editable se entrega en `resultados/garden_house_building/xixova-building.blend`; el activo web está en `public/building/xixova-building.glb`. Cada proxy conserva los metadatos `xixova_unit_code`, `xixova_unit_status`, `xixova_floor` y `xixova_proxy` mediante `export_extras=True`.

```text
BUILDING
├── PODIUM
├── ENTRANCE
├── FACADE_SHARED
├── ROOFTOP
├── LANDSCAPE
├── FLOOR_01
│   ├── UNIT_101_PROXY
│   ├── UNIT_102_PROXY
│   ├── UNIT_103_PROXY
│   └── UNIT_104_PROXY
├── …
└── FLOOR_18
    ├── UNIT_1801_PROXY
    ├── UNIT_1802_PROXY
    ├── UNIT_1803_PROXY
    └── UNIT_1804_PROXY
```

Cada grupo de presentación fusiona la geometría por material, de manera que los balcones y ventanas no crean un draw call por pieza. Las palmeras usan geometría simplificada agrupada. El activo exportado por Blender reportó 31.920 triángulos, 95 mallas (72 proxies y 23 mallas de presentación) y 14 materiales. La geometría está por debajo del presupuesto aproximado del usuario; no se añaden triángulos artificiales para alcanzar un mínimo. La versión inicial utiliza materiales PBR sin texturas externas; el grado de fotorrealismo debe evaluarse en las rondas visuales posteriores. El GLB se entrega sin compresión Draco, evitando decodificadores adicionales; su peso se registra en la entrega de verificación.

El modo seguro de MCP bloqueó la ejecución de un archivo mediante `exec/open`. La generación se realizó después enviando código directamente, usando operadores Blender permitidos para guardar/exportar. No se desactivaron protecciones ni se recurrió a otra aplicación.

## Web e interacción

`src/main.tsx` abre `BuildingApp` y carga `InteriorApp.tsx` mediante `React.lazy` sólo al pulsar “Explorar apartamento”. La antigua implementación interior se conserva. La ruta `?vista=interior` permite abrirla directamente y `?vista=edificio&unidad=1203` identifica la selección exterior. Los filtros y la selección se conservan en la sesión; favoritos en almacenamiento local. Las acciones de propuesta sólo guardan fichas locales y no envían mensajes ni reservas.

`BuildingScene.tsx` carga el GLB real con `GLTFLoader`. La cámara orbital usa `OrbitControls`, un encuadre de toda la torre y controles para rotación, zoom y restauración. El selector proyecta un rayo desde el puntero y consulta exclusivamente los 72 proxies. La geometría arquitectónica se mantiene intacta. Los proxies reciben un relleno translúcido y contorno según su estado; la selección usa petróleo y contorno más visible. Los no coincidentes se atenúan, sin ocultar partes del edificio. El usuario también puede seleccionar cualquier apartamento con teclado desde la matriz.

Los filtros de precio, planta, área, orientación, dormitorios, sol y mar se combinan mediante AND. El contador y la fachada reciben el mismo resultado de `filterUnits`. Las leyendas, etiquetas, fichas y matriz expresan el estado con texto además de color. Unidades reservadas y vendidas permiten consultar alternativas; propuesta está disponible sólo en unidades disponibles. Las que no tienen interior muestran un botón desactivado explícito.

Los modos `neutral_day` y `warm_dusk` ajustan cielo, luz hemisférica, sol y exposición en tiempo real. El atardecer no está horneado sobre la fachada. No se vinculan estas dos escenas ilustrativas al estudio solar interior existente.

## Archivos y verificación

- `src/building/inventory.ts`: configuración y generación de datos, tipos, filtros y reglas comerciales.
- `src/building/BuildingScene.tsx`: carga de GLB, orbitación, luces, selección y estados.
- `src/building/BuildingApp.tsx`: portada, ficha, filtros, matriz, comparación, favoritos y entorno.
- `src/building/building.css`: estilos responsive de la portada.
- `src/main.tsx` y `src/InteriorApp.tsx`: entrada y carga diferida del visor histórico.
- `building_model.py`: receta original de reconstrucción.
- `src/building/inventory.test.ts` y `tests/building.spec.ts`: contratos y flujos de usuario.

El worker de la primera ronda no ejecutó build, pruebas ni capturas por instrucción del coordinador. Esos resultados y las rondas de Dream Loop se registran por el coordinador, no se afirman aprobados aquí. Las pruebas e2e históricas del interior deben abrir `?view=interior`; las nuevas pruebas de edificio abren `/`. El servidor e2e sirve `publicaciones/catalogo_xixova`; por tanto debe actualizarse esa publicación con el build antes de ejecutarlas.

## Sustituir la demostración por datos reales

1. Reemplazar el generador `inventory` por un archivo o endpoint que cumpla `BuildingUnit`; mantener IDs estables o actualizar `modelObjectId` junto al GLB.
2. Confirmar número de plantas, cuatro unidades o distribución real, áreas, dormitorios, suites, estacionamientos y disponibilidad. Regenerar los contadores a partir de los datos, nunca escribirlos en componentes.
3. Sustituir orientaciones y vistas por información topográfica validada; recalcular preferencias solares con coordenadas y norte reales.
4. Mapear `interiorProjectId` a un proyecto real por unidad/tipología. Quitar el enlace ilustrativo cuando exista un interior correspondiente.
5. Confirmar precios, fecha de actualización y publicación. Cualquier integración comercial futura debe implementarse explícitamente; actualmente no hay reserva, CRM, pagos ni envío de propuesta.

Para una reconstrucción precisa se necesitan planos de plantas, elevaciones ortográficas, número real de plantas y unidades por piso, orientación geográfica, especificaciones de materiales, cotas y medidas, y archivos CAD/BIM. Fotografías adicionales de las fachadas posteriores y del acceso también reducirían las suposiciones.
