# Caso Terraza Luz — 2026-09-19

Registro histórico que complementa la [guía compacta](../APARTMENT_PRODUCTION_LESSONS.md). Los hashes y resultados describen esta ejecución; verificar el estado actual antes de reutilizarla.

## Fuentes y resultado

- Proyecto sintético, variante `editorial_jardin`. Sus medidas y orientación no proceden de un plano constructivo verificado.
- Maestro inicial local: `proyectos/terraza_luz/.maqueta/cache/d79b60f8e0697d896c45/escena.blend`.
- Ejecución local: `.dream-loop/terraza_luz/20260919_015903/`. Contiene sesión independiente, maestro final, copia web, scripts, manifiesto BlenderKit, diagnóstico de puertas y nueve imágenes: tres baseline y tres por ciclo.
- Se completaron dos ciclos de Dream Loop Plus con un trabajador Astra high. Se preservaron 119 mallas arquitectónicas; se terminaron ocho puertas y cuatro pasos abiertos. La comprobación de colisiones fue de pose, no una simulación completa del barrido.
- Maestro `maestro_final.blend`: ~445,59 MB; 97 imágenes FILE empaquetadas. GLB con proxies propios para los activos restringidos por la política web del proyecto.
- Fuente web integrada: `proyectos/terraza_luz/web/assets-premium.glb`. El build la copia después de generar el catálogo.
- SHA-256 aprobado: `04698579975ad9702dd87b316eb91dfca1639364aedc1e2ec7c400c85401f47a`.

| Métrica | GLB anterior | Candidato integrado |
|---|---:|---:|
| Bytes | 19.483.200 | 7.273.516 |
| Triángulos únicos | 104.004 | 110.244 |
| Triángulos con repeticiones | 104.004 | 135.140 |
| Materiales | 161 | 141 |
| Imágenes embebidas | 38 | 20 |
| Primitivas aproximadas de una pasada | 397 | 617 |
| Llamadas del primer frame de la comparación local | 1.118 | 1.853 |

Las cifras del primer frame incluyen pasadas auxiliares y pertenecen al visor de comparación. No son un benchmark de producción ni demuestran mejor rendimiento. No hubo medición móvil de FPS ni medición directa de memoria GPU.

## Scripts y encuadres reutilizables

En la carpeta local de ejecución: `prepare_baseline.py`, `cycle1.py`, `cycle2_download.py`, `cycle2.py`, `cycle2_fixes.py`, `export_web.py`, `normalize_glb.py`, `glb_metrics.py` y `capture_web.mjs`. Revisar rutas y guards antes de adaptarlos; contienen decisiones específicas de Terraza Luz. Los scripts Blender se ejecutaron por MCP en modo seguro.

Las cámaras ortográficas usaron 1280×960 y, para previas Cycles, 24 muestras con denoise:

| Cámara | Posición XYZ | Objetivo XYZ | Escala |
|---|---|---|---:|
| TL_Vista_1 | 15,68; −10,03; 14,56 | 5,6; 2,85; 0,8 | 17 |
| TL_Vista_2 | 17; −12; 21 | 5,6; 2,85; 0,5 | 17 |
| TL_Superior | 5,6; 2,85; 24 | 5,6; 2,85; 0 | 14,5 |

BlenderKit: cuatro familias descargadas (WC, lavabo, lavadora y Strelitzia), con autor, ID y licencia en `blenderkit_manifest.json`. La cama considerada se descartó. No copiar licencias ni autorizaciones de este proyecto a otro sin comprobarlas.

## Incidente de integración y corrección

1. Se sustituyó únicamente `assets-premium.glb` y se desplegó un artefacto preexistente. Verificar el hash remoto y la portada resultó insuficiente.
2. El visor local seguía mostrando `mobile`: el cargador guardaba una función `upgrade` que no tenía invocación. El candidato estándar Y-up tampoco tenía adaptación al visor Z-up; una regla antigua ocultaba las camas.
3. La URL pública `/demo` falló. El artefacto local carecía de `demo.html` y tenía una configuración de rutas antigua. Las atribuciones iniciales al dominio o a caché no quedaron demostradas como causas; no repetirlas como diagnóstico confirmado.
4. Se cambió `InteriorApp.tsx` para cargar directamente el objetivo premium de Terraza Luz, adaptar su raíz +90° sobre X y retirar la regla que ocultaba las camas del GLB.
5. Se compiló desde un checkout aislado para excluir dos cambios previos del usuario en `BuildingApp.tsx` y `building.css`. Se aportaron tres texturas locales ignoradas que ya usaba el frontend. Se incorporaron HTML de entrada y `vercel.json` actuales al artefacto.
6. Validación final: URL exacta desde `promoven.online`, redirección a `www`, HTTP 200, `data-quality=premium`, `data-scene-ready=true`, captura revisada, sin errores de página detectados y hash remoto correcto. Suite: 79 pruebas aprobadas y cuatro omitidas; build y `git diff --check` correctos.

Integración: commit `fc1b909a33fe1ac49fabf50ee8ac0ffe0661a9b8`. Despliegue correctivo: `dpl_ADRcMLfUXvuFMZ5TAQM2FDmMKXEE`. El proyecto remoto era `escobarpro`; el nombre `catalogo-xixova` en `.vercel/project.json` estaba obsoleto, aunque su ID seguía siendo el mismo. No asumir que el nombre local es vigente.

El push HTTPS falló por falta de credenciales; el acceso SSH disponible funcionó. Esto es una circunstancia del entorno, no una instrucción para cambiar remotos o autenticación en futuros encargos.

## Límites y pendientes que no deben desaparecer del contexto

- Acceso practicable a terraza no confirmado: ventanales con antepecho de 15 cm. Topología poco convencional del baño social conservada. No se añadieron duchas ni armario secundario donde bloqueaban pasos.
- `editorialDetails` y los proxies del demo siguen requiriendo revisión al integrar nuevas escenas: el parche publicado no demuestra que todas las duplicaciones procedurales estén eliminadas.
- Los niveles mobile/standard y sus consumidores independientes no se renovaron. Una previsualización que solicite directamente `assets-mobile.glb` puede seguir mostrando el modelo anterior.
- Los metadatos generados de tamaños/niveles no se actualizaron en el parche de integración. Revisarlos antes de utilizarlos para presupuestos o selección de calidad.
- El script de build conserva la sustitución del GLB; no sincroniza las ediciones manuales del maestro con los YAML. Regenerar desde YAML puede producir otra escena.
- El informe local `ENTREGA.md` describe el momento anterior a la aprobación y conserva el texto «no integrado». Este registro documenta la aprobación y publicación posteriores; no usar ese informe histórico como estado actual.
- Los scripts, maestro y capturas de `.dream-loop/` son archivos locales ignorados por Git. El GLB integrado sí se añadió al repositorio con una excepción específica en `.gitignore`.
