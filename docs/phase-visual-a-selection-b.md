# Fase Visual-A + selección básica Visual-B

## Diagnóstico y decisión

La composición anterior mantenía filtros y ficha como columnas permanentes, reduciendo la maqueta a una franja central. La nueva vista trata el edificio como escena principal: filtros y ficha se presentan como superficies flotantes de marfil, con una introducción comercial ligera y un fondo cálido de profundidad discreta.

La referencia visual entregada se usó para jerarquía, ritmo, paleta y composición; no se reemplazó la maqueta ni se modificaron GLB, geometrías, materiales, texturas, cámaras registradas ni cálculos solares.

## Componentes modificados

- `BuildingApp.tsx`: presentación comercial, disparador de filtros, filtros plegables, contador derivado y Escape para cerrar filtros.
- `BuildingScene.tsx`: hover comercial con datos públicos existentes; unidades fuera de filtros ya no se destacan ni seleccionan desde el canvas.
- `building.css`: tokens de Escobar, paneles flotantes, responsive de drawer/bottom sheet y movimiento reducido.
- `building.spec.ts`: la cobertura existente abre el nuevo filtro comercial antes de operar sobre sus controles.

## Tokens y responsive

Los tokens `--escobar-ink`, `--escobar-green`, `--escobar-ivory`, `--escobar-gold`, `--escobar-line`, `--escobar-radius`, `--escobar-shadow` y `--escobar-ease` centralizan color, superficies, radio, sombra y transiciones. En escritorio la ficha flota a la derecha y los filtros parten cerrados. En móvil ambos se convierten en bottom sheets mutuamente utilizables desde la barra compacta; el canvas conserva sus controles.

## Inventario, estados y datos

Los contadores se derivan de `InventorySummary` y de `filterUnits`: inventario actual **72** unidades, **54** disponibles, **6** reservadas y **12** vendidas. Se conservan los 72 proxies y los ocho tipos. Disponible, reservada, vendida, seleccionada y fuera de filtros tienen tratamientos distintos en el canvas. El hover muestra sólo código, piso, área, precio existente y estado público.

La ficha muestra sólo los campos presentes en el contrato público: código, estado, piso, área, dormitorios, suites, plazas, orientación, precio, precio por m² seguro, sol y tipo de vista. Baños no forma parte del contrato público actual (los 8 valores legacy `NULL` se omiten, sin inventar `Não informado`). No se inventan condiciones comerciales ni datos de vistas. La función de orientación se conserva porque el dominio la provee.

## Accesibilidad

Los controles conservan nombres accesibles y foco visible. El disparador de filtros anuncia `aria-expanded`; Escape cierra los filtros y los diálogos existentes mantienen su trampa de foco. La comunicación de estado combina color, texto y símbolos. `prefers-reduced-motion` elimina transiciones de superficies y spinner.

## Dream Loop y capturas

Capturas iniciales: `.dream-loop/baseline/desktop.png`, `tablet.png`, `mobile.png`. Capturas de iteración: `.dream-loop/final/desktop-loaded-round1.png`, `tablet-loaded-round1.png`, `mobile-loaded-round1.png`. La carpeta está ignorada por Git. La primera evaluación corrigió el principal déficit de composición: canvas comprimido por paneles persistentes.

## Validación y riesgos

Línea base y final: ESLint, TypeScript, 62 pruebas unitarias (58 activas, 4 omitidas), build aislado, `npm audit --omit=dev --audit-level=high` (0 vulnerabilidades) y `git diff --check` correctos. La suite E2E pública del edificio terminó correcta (4/4), incluida la variante móvil. Bundle inicial principal: 1,008.83 kB sin comprimir / 269.37 kB gzip; final: 1,010.19 kB / 269.70 kB gzip (+1.36 kB / +0.33 kB), sin dependencias nuevas. Falta repetir el E2E transversal completo de todas las experiencias antes de un futuro commit.

Riesgos conocidos: la referencia incluye un entorno fotográfico que no se replica, porque el alcance prohíbe modificar o añadir activos 3D; la solución usa únicamente gradientes ligeros. Para Visual-B completo conviene añadir baños al contrato público si se desea mostrar `Não informado`, y para Visual-C mantener el estudio solar separado de la presentación comercial.
