# Momentos do dia — carrusel reutilizado en la landing

El 18 de septiembre de 2026 esta sección se reactivó en la landing, entre
“Recursos conectados” y “Veja a plataforma em ação”. Reutiliza el componente
`TimeOfDayCarousel` y sus activos locales; conserva el posicionamiento como
**ilustración de iluminación**, no como estudio o simulación solar técnica.

Los controles permiten recorrer Manhã, Meio-dia, Entardecer y Noite. La nota
visible “Imagens meramente ilustrativas.” y los textos alternativos específicos
por escena siguen siendo obligatorios.

Os quatro PNG fornecidos permanecem fora do bundle público em `/home/rafa/RenderCasa/`. Os derivados públicos usam o mesmo crop `1012×806` em `(564,120)` para manter a torre alinhada e não contêm a interface das referências.

| Momento | Desktop AVIF | Desktop WebP | Móvel AVIF | Móvel WebP |
| --- | ---: | ---: | ---: | ---: |
| Manhã | 1012×806, 83.8 KB | 1012×806, 102.0 KB | 640×510, 48.5 KB | 640×510, 52.1 KB |
| Meio-dia | 1012×806, 98.3 KB | 1012×806, 117.4 KB | 640×510, 58.3 KB | 640×510, 61.3 KB |
| Entardecer | 1012×806, 83.7 KB | 1012×806, 102.7 KB | 640×510, 46.6 KB | 640×510, 51.9 KB |
| Noite | 1012×806, 92.3 KB | 1012×806, 109.8 KB | 640×510, 51.1 KB | 640×510, 54.4 KB |

Total por formato: AVIF desktop 358.2 KB, AVIF móvel 204.5 KB; WebP desktop 431.9 KB, WebP móvel 219.8 KB. Os ativos estão em `xixova/maquette_web/public/marketing/moments/`: Manhã se precarga como estado inicial; al acercarse la sección se carga el activo activo y el siguiente, y los restantes pasan a segundo plano.

## Variante experimental arquivada

`xixova/maquette_web/src/marketing/experiments/timeOfDayLightFlash.css` conserva uma transição de "flash de luz": ilumina e dessatura brevemente a imagem antes da troca. Ela **não é importada nem está ativa** porque não acrescentou valor à composição atual.

Para uma avaliação futura, importe o arquivo depois de `marketing.css` e adicione `data-transition-style="light-flash"` ao elemento `.time-of-day-visual`. A variante mantém os 220 ms de saída e 220 ms de entrada e não sobrepõe as imagens. Reavaliar apenas se as cenas tiverem composição suficientemente alinhada.
