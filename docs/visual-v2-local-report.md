# Visual V2 — preview local de Escobar

Fecha: 2026-09-20. Estado: preview local reversible, no aprobada para promoción.

## Activación

La ambientación actual del visor se conserva como Visual V1. Visual V2 se activa únicamente en desarrollo, homologación o staging con:

```text
/demo?vista=edificio&unidad=1203&visual=v2
```

`visual=v1`, valores inválidos y producción resuelven V1. `visual=original` conserva el fallback histórico. V2 carga su código y el GLB auxiliar de forma diferida; V1 no solicita esos recursos.

## Protección y assets

- GLB interactivo protegido: `xixova-building-visual-v2.glb`, SHA-256 `003ab678af116360552ef355e76130d3cc63292c22b3dde60bff49da181ade9c`.
- Inventario protegido: SHA-256 `11441b96cb2644f3273186434861275b9528da0cfb5e2595a7590bfe868d8f5a`.
- Auxiliar V2: `public/environments/visual-v2/visual-v2-landscape.glb`, 80.184 bytes, 740 triángulos, cuatro materiales, SHA-256 `b44f0210ed76feb3155c058666bb2e40630fab03e9d9c0fc008a738b6dd65d55`.
- Maestro y script reproducible: `resultados/visual-v2/`, que permanece ignorado por Git. Blender MCP 4.5.13 LTS creó una escena aislada; la escena inicial sin guardar se mantuvo intacta.

Las referencias, baseline del navegador, métricas y capturas están bajo `.dream-loop/visual-v2/`, ignorado por Git. Los dos PNG entregados inicialmente tenían los mismos píxeles; se preservaron y la captura real V1 se usó como baseline funcional.

## Resultado visual

Se completaron los tres ciclos máximos de Dream Loop. La evaluación final desktop/día fue 5,7/10; no alcanzó el objetivo de 8/10. Se preservaron edificio, cámara, interfaz, acceso y marcador 1203. Los defectos de plano negro y arista de terreno se resolvieron, pero el entorno continúa demasiado ilustrativo, con poca profundidad y paisajismo intermedio para igualar la referencia.

Las capturas C3 desktop están en `.dream-loop/visual-v2/cycle-3-v2-front.png`. Las capturas móvil/día y móvil/atardecer disponibles pertenecen al ciclo 2; no acreditan el último ciclo.

## Validación local

- Unitarias: 85 correctas, 4 omitidas existentes.
- ESLint, TypeScript/build y `git diff --check`: correctos.
- Código diferido V2: 2,82 kB gzip.
- El navegador confirmó V1 sin módulo V2 y V2 con la unidad 1203, el GLB del edificio y el GLB auxiliar cargados.

Playwright bajo SwiftShader no acredita rendimiento móvil real. La suite de capturas se interrumpió al superar aproximadamente 31 segundos: no se declaran aprobadas la comprobación C3 móvil, desktop al atardecer, JSON final de raycasting, métricas de renderer ni cinco ciclos de montaje. La E2E pública tampoco quedó aprobada: bajo sandbox el servidor terminó al iniciar y el reintento llegó a ejecutar una de 44 pruebas sin emitir resultado final.

No hubo commit, push, despliegue, cambio de Supabase ni modificación de los GLB protegidos.
