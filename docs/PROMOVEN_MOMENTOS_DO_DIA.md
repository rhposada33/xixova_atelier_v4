# Momentos do dia — implementação arquivada

Esta seção foi retirada da landing principal por decisão de produto. Nenhum dos seus componentes ou ativos é importado pela página, portanto não gera solicitações de imagem nem aparece para visitantes. O código, testes de lógica e ativos permanecem no repositório exclusivamente para uma possível retomada.

Os quatro PNG fornecidos permanecem fora do bundle público em `/home/rafa/RenderCasa/`. Os derivados públicos usam o mesmo crop `1012×806` em `(564,120)` para manter a torre alinhada e não contêm a interface das referências.

| Momento | Desktop AVIF | Desktop WebP | Móvel AVIF | Móvel WebP |
| --- | ---: | ---: | ---: | ---: |
| Manhã | 1012×806, 83.8 KB | 1012×806, 102.0 KB | 640×510, 48.5 KB | 640×510, 52.1 KB |
| Meio-dia | 1012×806, 98.3 KB | 1012×806, 117.4 KB | 640×510, 58.3 KB | 640×510, 61.3 KB |
| Entardecer | 1012×806, 83.7 KB | 1012×806, 102.7 KB | 640×510, 46.6 KB | 640×510, 51.9 KB |
| Noite | 1012×806, 92.3 KB | 1012×806, 109.8 KB | 640×510, 51.1 KB | 640×510, 54.4 KB |

Total por formato: AVIF desktop 358.2 KB, AVIF móvel 204.5 KB; WebP desktop 431.9 KB, WebP móvel 219.8 KB. Os ativos estão guardados em `xixova/maquette_web/public/marketing/moments/`, mas não são carregados enquanto a seção permanecer arquivada.

## Variante experimental arquivada

`xixova/maquette_web/src/marketing/experiments/timeOfDayLightFlash.css` conserva uma transição de "flash de luz": ilumina e dessatura brevemente a imagem antes da troca. Ela **não é importada nem está ativa** porque não acrescentou valor à composição atual.

Para uma avaliação futura, importe o arquivo depois de `marketing.css` e adicione `data-transition-style="light-flash"` ao elemento `.time-of-day-visual`. A variante mantém os 220 ms de saída e 220 ms de entrada e não sobrepõe as imagens. Reavaliar apenas se as cenas tiverem composição suficientemente alinhada.
