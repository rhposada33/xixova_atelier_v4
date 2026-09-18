# Promoven — D1: ilustração animada de iluminação

Esta sección es una ilustración visual de iluminación. No es una simulación solar ni
calcula orientación, ubicación, fecha, estación o coordenadas. El aviso visible
en la landing aclara que no sustituye un estudio técnico de insolación.

## Invariantes preservados

- GLB: `/building/promoven-building-v2.glb`.
- Cámara inicial: `(15.5, 10.1, 23)`; target `(0, 5.6, 0)`.
- Escala: `12 / altura del modelo`.
- OrbitControls, límites de zoom, carga diferida, poster y fallback WebGL.
- El renderer de marketing permanece aislado de `/demo`.

## Línea temporal y controles

El único valor temporal es continuo entre 08:00 y 20:00. Los presets posicionan
el mismo slider en Manhã (08:00), Meio-dia (12:00), Entardecer (17:30) y Noite
(20:00). El ciclo dura 16 segundos y utiliza una costura breve Noite→Manhã;
no representa una madrugada ni datos solares.

Autoplay solo corre con al menos el 50 % de la sección visible y con la página
activa. Cualquier interacción temporal con slider, preset u OrbitControls lo
suspende y lo reanuda cinco segundos después de la última interacción. La pausa
explícita solo se reanuda mediante su botón. Con movimiento reducido no hay
autoplay y los cambios manuales son inmediatos.

## Rendimiento y recursos

En escritorio parte con mapas de sombra de 1024; en puntero táctil, con 512. Si
el frame time medio supera 34 ms durante dos segundos visibles, el orden de
degradación es 512, sombras desactivadas y, por último, pixel ratio reducido.
No se degradan geometría, cámara ni controles. Solo piedra y bronce proyectan
sombra; pavimento/base la reciben.

Los posibles materiales de habitaciones se buscan de forma defensiva y se
clonan únicamente antes de aplicar emisión nocturna. Si no se encuentran, la
noche sigue funcionando sin emisión. Todas las copias, texturas, geometrías y el
contexto WebGL se liberan al desmontar.

## C1 archivado

El carrusel C1 sigue archivado: no se monta `.time-of-day` ni se solicitan
recursos de `/marketing/moments/` desde la landing.

## Dream Loop Plus

1. Se extendió el preview existente: el cambio manual llegó al renderer aun con
   autoplay detenido y el fondo pasó a seguir la misma línea temporal.
2. Se ajustaron legibilidad, tonos de entardecer/noche, emisión defensiva y el
   dock dentro del marco del canvas, sin cambiar modelo ni encuadre.
3. Se comprobó escritorio y móvil en los cuatro estados; se consolidaron el
   contraste de controles, el foco visible y la cuadrícula móvil 2×2.

## Pase visual D1.1

El refinamiento mantuvo sin cambios el GLB, la cámara, los controles, la línea
temporal y los contratos de accesibilidad. Se redujo la exposición y la energía
de relleno respecto de D1, recuperando contraste mediante luz direccional: la
mañana es lateral y cálida, el mediodía es alto y neutro, y el entardecer viene
desde el lado opuesto con un relleno más frío. La noche baja la luz exterior y
reutiliza el atlas existente de habitaciones únicamente en clones temporales
como emisión cálida moderada; por eso conserva una distribución visual no
uniforme sin modificar materiales compartidos.

También se ajustaron el frustum, `bias` y `normalBias` de la sombra antes de
considerar más resolución. El título se contuvo ligeramente y el dock recibió
un borde y fondo más separados, sin aumentar su altura. Las capturas finales
están en `resultados/checkpoint-d1-1/` (ignorado por Git).
