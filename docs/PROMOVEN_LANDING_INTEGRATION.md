# Integração da landing Promoven

## Arquitetura final

A aplicação mantida é `xixova/maquette_web`, uma SPA React 19 + Vite + React Router. A landing de Lovable foi usada apenas como referência visual e de conteúdo. Não há imports, symlinks, build ou dependências de runtime para `promoven-showcase-magic`.

| Rota | Conteúdo |
| --- | --- |
| `/` | Landing pública Promoven |
| `/demo` | Edifício e interiores 3D |
| `/login`, `/forgot-password`, `/reset-password`, `/accept-invitation` | Autenticação existente |
| `/portal/*` | Portal administrativo protegido |

A raiz redireciona para `/demo` somente quando recebe um parâmetro legacy reconhecido. A allowlist é `vista`, `unidad`, `maqueta`, `piso`, `area`, `cliente` e `visual`; chaves e valores inválidos não são propagados. Links novos são gerados com `/demo`.

## Migração seletiva

Foram portados a composição editorial, paleta verde/marfim/dourado, hierarquia tipográfica, conteúdo e comportamento responsivo. Foram descartados TanStack Start/Router/Query, Tailwind 4, Radix/shadcn não usados, Nitro/Cloudflare, error reporting e metadata de Lovable, `.lovable`, lockfiles e hosting externo.

Não foram adicionadas dependências. A landing usa React/CSS e o Three.js já instalado. Todo o conteúdo visível novo está em português do Brasil.

## Preview e demonstrações

O hero usa cópias locais das duas imagens estáticas originais de `promoven-showcase-magic` (`promoven-tower.jpg` e `promoven-interior.jpg`), alternadas por botões acessíveis. Nenhum código, runtime ou import depende daquele projeto; as imagens são ilustrativas e não anunciam unidades reais. O hero não requisita Three.js, GLB ou HDRI. A seção inferior `#experiencia`, antes das demonstrações, apresenta o edifício 3D e explica suas possibilidades.

`HeroBuildingPreview` carrega dinamicamente `building/promoven-building-v2.glb` apenas quando essa seção se aproxima do viewport. É uma peça ilustrativa independente do edifício Xixova e do inventário; não consulta Supabase. O renderer pausa fora do viewport e com aba oculta; a rotação automática cessa quando o usuário interage, enquanto órbita e zoom permanecem ativos. Movimento reduzido, ausência de WebGL ou erro de carga usam um render estático. Geometrias, materiais, texturas, listeners e o contexto WebGL são liberados ao desmontar.

Garden House e Terraza Luz usam capturas JPEG reais do visor integrado em `public/marketing` como fallback. Ao selecionar uma aba, a landing carrega somente o GLB mobile daquela maquete em um visor 3D com rotação por arrasto e zoom limitado; a troca de aba desmonta o visor anterior. O preview inferior do edifício é desmontado quando uma maquete interior está ativa, substituído pelo poster com botão para reativá-lo; assim a landing preserva um único contexto WebGL. Os links abrem seleções válidas do catálogo em `/demo`. Em desenvolvimento, o middleware Vite serve JSON e modelos do catálogo antes do fallback SPA, sem substituir o `index.html` da aplicação. A publicação continua sendo gerada por `scripts/build_catalogo_xixova.sh`, que combina o build Vite com o catálogo e os modelos.

## Contato e SEO

Dados comerciais vivem em `src/marketing/config.ts`. Como WhatsApp e email não estão confirmados, as CTA de contato ficam ocultas. O canonical temporário permanece `https://escobarpro.vercel.app`, conforme decisão do produto; título, descrição, Open Graph, Twitter Card e Organization usam a marca Promoven.

## Bundles e validação

Antes da integração, o chunk inicial era 1.028,08 kB minificado. Depois da galeria estática, o shell/landing ficou em 230,69 kB minificados (72,21 kB gzip) e Three.js passou a um chunk dinâmico separado de 926,10 kB minificados. Demo, interiores, autenticação, Supabase e portal possuem limites lazy próprios. O GLB de 6,7 MB e o HDRI de 1,7 MB são requisitados apenas quando a seção 3D inferior se aproxima do viewport; alternar as imagens do hero não solicita esses arquivos.

A validação inclui lint, TypeScript, unitárias, E2E de landing/demo/portal, build, audit, diff check, busca de segredos/referências externas e inspeção dos chunks. As atribuições dos assets 3D permanecem junto aos respectivos projetos exportados.

## Edifício Promoven V2 (isolado)

A fonte reproduzível é `xixova/maquette_web/promoven_building_v2.py`; a cena editável fica em `assets/promoven/promoven-building-v2.blend`, com texturas empacotadas. Ela foi construída/exportada via Blender MCP em uma cena nova, sem abrir nem modificar os modelos Xixova. O GLB publicado tem cerca de 6,7 MB; o poster é um render real da mesma cena. Em 17/09/2026, os SHA-256 protegidos continuam `07e390ac…` (`xixova-building.glb`) e `003ab678…` (`xixova-building-visual-v2.glb`). O novo modelo não contém proxies de unidades e aparece somente em `/` com a legenda permanente “Visualização ilustrativa”. As fachadas frontal e posterior agora compartilham a mesma modulação de janelas, balcões, guarda-corpos e podio, para que a órbita não revele uma parede cega.

O material de fachada deriva de [Brushed Concrete](https://polyhaven.com/a/brushed_concrete) e a iluminação/reflexão usa [Studio Small 03](https://polyhaven.com/a/studio_small_03), ambos Poly Haven [CC0](https://polyhaven.com/license). Os arquivos fonte necessários estão em `assets/promoven`; o HDRI de 1K é carregado apenas com o preview. Um atlas de quatro interiores visíveis atrás do vidro (`window-atlas.png`) foi gerado com `imagegen` a partir da direção visual de referência, com o prompt de janelas residenciais ortogonais, variação de cortinas, plantas e iluminação quente; ele não afirma representar unidades reais. O comando de download do conector MCP retornou `Unknown command type`, então a obtenção dos assets Poly Haven foi feita pela API pública oficial. Rodin foi avaliado com uma imagem de referência isolada gerada durante Dream Loop Pro, mas o MCP conectado também respondeu `Unknown command type: create_rodin_job`; nenhum crédito pago foi usado e nenhum resultado Rodin entrou no produto. A imagem candidata a Rodin ficou apenas na pasta local ignorada `.dream-loop/`.

O fluxo Dream Loop comparou capturas desktop/móvel com a referência do usuário. A composição ganhou uma torre mais larga, câmera em três quartos, fachada estratificada, vidro/carpintaria escuros, vegetação e podio. A vegetação usa uma textura de copa transparente gerada com `imagegen` (`tree-canopy.png`), otimizada em `tree-canopy-optimized.png`; o atlas de janelas também tem uma versão JPEG otimizada. A saída ainda é um preview web em tempo real, não uma fotografia arquitetônica: a avaliação visual independente da última captura foi 5/10 em relação à referência. O modo de movimento reduzido usa o render da cena. A landing mantém um único contexto WebGL quando se alterna entre edifício e interiores.
