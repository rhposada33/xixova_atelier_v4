# Añadir un edificio al demo

El registro compartido está en `xixova/data/demo_buildings.json`. `catalogo.yaml` sigue describiendo interiores; no se usa para elegir edificios.

Para preparar otro edificio:

1. Crear un inventario local de `PropertyUnit` en `xixova/data/` con IDs propios, códigos `piso × 100 + final`, `modelObjectId: UNIT_<código>_PROXY` y una unidad inicial publicada. Registrarlo en `demo_buildings.json` con `inventoryFormat: property-units` e `inventoryProvider: static`.
2. Colocar el GLB aprobado en `xixova/maquette_web/public/building/`, registrar su SHA-256 y permitir su seguimiento en `.gitignore`. La geometría debe contener exactamente un proxy de malla por unidad publicada. Registrar variantes de modelo solo cuando existan.
3. Definir el encuadre original y premium del edificio. Si no se ofrece un interior válido en el catálogo, usar `interiorEnabled: false`.
4. Ejecutar `PYTHONPATH=. python3 scripts/check_demo_buildings.py`, las pruebas web y el build. El exportador repite la validación antes de reemplazar un catálogo. Probar `/demo?edificio=<id>&unidad=<código>` en desktop y móvil.

Los enlaces sin `edificio` abren Escobar. `?cliente=jequitiba` se normaliza a `?edificio=jequitiba`. En producción, Escobar sigue consultando Supabase; Jequitibá y Canto do Forte usan inventarios locales independientes del demo. El registro define qué se muestra, y el exportador publica `buildings` en `catalog.json` mientras mantiene `building` para clientes antiguos.

## Canto do Forte

Concepto arquitectónico original inspirado en las referencias visuales del usuario: 16 pisos residenciales, 4 unidades por piso y 64 unidades ilustrativas, con vestíbulo de doble altura, balcones curvos, jardines, piscina y pérgola de cubierta. Áreas, precios, orientaciones y estados son datos sintéticos, no una oferta inmobiliaria ni mediciones de un inmueble real. No tiene recorrido interior vinculado.

- URL local: `/demo?edificio=canto-do-forte&unidad=1203`.
- Fuente reproducible: `proyectos/canto_do_forte/build_canto_do_forte.py`. Ejecutar su contenido mediante Blender MCP; ajustar `ROOT` al mover el repositorio. Solo reconstruye su escena `CANTO_DO_FORTE` y conserva las otras escenas. El `.blend` local se guarda junto al script.
- Las texturas de piedra/madera, fronda, grupos tropicales y panorama se generaron con ImageGen para este concepto. Los interiores de fachada reutilizan `assets/promoven/window-atlas-optimized.jpg`, ya presente en el proyecto, junto con su normal de hormigón. No se descargaron modelos externos.
- GLB con geometría comprimida con Draco y texturas empacadas. El decodificador se empaqueta localmente con Three; no depende de un CDN.
- El perfil `coastal` conserva sus materiales, añade iluminación de acceso y un halo moderado a luminarias. El panorama es un fondo ilustrativo fijo y también aporta reflejos; no representa una ubicación geográfica exacta.
- El panorama externo tiene ruta y hash en el registro y se valida antes de exportar. Después de aprobar un nuevo GLB, actualizar su SHA-256 en el registro y repetir el preflight.

Para mantener la interacción ligera, la oclusión ambiental se calcula en reposo en desktop; al girar o acercar se suspende y vuelve al detenerse. En móvil se utiliza un límite de resolución menor y se omite ese pase.
