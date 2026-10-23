# Promoven Connect — checkpoint PC-04

Data: 23/10/2026. Estado: **implementado e validado somente no Supabase Connect local**. Sem deploy, migração remota, DNS, commit ou push. Landing Promoven, Escobar, leads comerciais e pipelines Blender não foram alterados.

## Funcionalidades

- `/connect/broker/projects` lista apenas empreendimentos publicados para os quais o corretor tem autorização ativa e CRECI verificado **naquele projeto**. Cada card mostra incorporadora, local, tipologias e contagem de unidades disponíveis publicadas. A falta de mídia usa placeholder Promoven.
- `/connect/broker/projects/:id` consulta uma projeção privada 2D. Filtros por andar, tipologia, dormitórios, área, preço autorizado e disponibilidade; ordenação por código, preço autorizado, área e andar. A consulta, o total e a paginação de 20 unidades por vez ocorrem no PostgreSQL, com limite máximo de 40 por chamada.
- `/connect/broker/projects/:id/units/:unitId` mostra atributos, disponibilidade e preço quando permitido. Unidades não publicadas e unidades de outro projeto não são retornadas.
- Favoritos persistem por corretor em `broker_favorites`; cada leitura ou alteração revalida o acesso. Suspensão e revogação tornam o favorito inacessível, inclusive com o mesmo JWT. Comparação local de até quatro unidades do **mesmo** empreendimento refaz a consulta autorizada antes de exibir preço, área, dormitórios, vagas, andar e disponibilidade.
- O preço privado começa **oculto**. Um administrador da organização pode autorizá-lo no detalhe administrativo do projeto, em regra separada da visibilidade pública. A mudança usa versão otimista e auditoria. Filtros e ordenação por preço são rejeitados no banco enquanto ele estiver oculto. Disponibilidade e atributos de unidades publicadas são permitidos ao corretor com acesso ativo, independentemente das flags da projeção pública.

## Migração, RPCs e contratos

Migração local aplicada com `npx supabase migration up --local`: `infra/promoven-connect/supabase/migrations/20261023070000_broker_catalog.sql`. Acrescenta `projects.broker_price_visible` com default `false`, tabela privada `broker_favorites` com FK composta de tenant/projeto/unidade, e funções `private.broker_catalog_project`, `connect_set_broker_price_visibility`, `connect_broker_catalog_projects`, `connect_broker_project_detail`, `connect_broker_inventory`, `connect_broker_unit_detail`, `connect_broker_favorites` e `connect_set_broker_favorite`. `connect_broker_projects` do PC-03 permanece como resumo de acessos; o catálogo tem projeção própria e requer publicação.

| Arquivo | Função |
| --- | --- |
| `packages/connect-contracts/src/brokerCatalog.ts`, `src/inventory.ts` | Tipos de catálogo, filtros, decimais e política administrativa. |
| `apps/promoven-connect-web/src/brokerCatalogApi.ts` | Adaptador tipado para RPCs privadas. |
| `apps/promoven-connect-web/src/pages/BrokerCatalog.tsx` | Lista de projetos, inventário, filtros, detalhe, favoritos e comparação. |
| `apps/promoven-connect-web/src/pages/Portal.tsx`, `Brokers.tsx`, `Projects.tsx`, `src/style.css` | Rotas, navegação responsiva e permissão administrativa de preço. |
| `infra/promoven-connect/supabase/tests/database/broker_catalog.test.sql` | 45 asserções pgTAP de autorização, isolamento e consulta. |
| `apps/promoven-connect-web/tests/brokers.spec.ts` | Fluxo E2E estendido de corretor e capturas responsivas. |

## Segurança e isolamento

- Cada RPC de detalhe, inventário, unidade e favorito exige `auth.uid()`, perfil ativo, organização ativa, autorização `active`, revisão CRECI `verified` naquele projeto e projeto `published`, pela função Connect existente `private.active_broker_access`. As consultas são `security definer` com `search_path` fixo, execução apenas para `authenticated` e resultado com campos explicitamente selecionados.
- Inventário e projeto base continuam sob RLS de membros internos. Corretor não recebe `SELECT` direto sobre eles ou sobre `broker_favorites`, nem `UPDATE` de preço, disponibilidade ou publicação. As RPCs não retornam `storage_path`, documentos internos, credenciais ou assets. A comparação só usa IDs do projeto atual e a RPC de unidade recusa IDs de outros projetos.
- Preços `numeric(14,2)` e áreas `numeric(12,3)` são serializados como strings decimais. A regra de preço privado não altera `connect_public_project`: preço continua ausente na resposta pública até a flag pública própria ser habilitada. Nenhuma consulta pública substitui a autorização privada.
- A lista limita-se a unidades `published`; projeto `draft` ou `archived` não entra no catálogo. Uma autorização ativa isoladamente não torna dados do projeto visíveis.

## Testes e evidências

| Verificação | Resultado |
| --- | --- |
| `npx supabase test db` | **164** asserções passaram: 119 dos PC-01/02/03 e 45 do PC-04. Incluem preço oculto, filtro contra inferência, paginação, múltiplas organizações, CRECI local, RLS, favorito e suspensão/revogação com o mesmo JWT. |
| `packages/connect-contracts` | Typecheck e **13** testes passaram. |
| App web | Build, lint e **2** testes unitários passaram. |
| E2E local com Mailpit e Edge Function PC-03 | **5** testes passaram, incluindo regressões e o fluxo catálogo → filtro → favorito → comparação → detalhe → preço autorizado → revogação. |
| Layout | Lista de projetos, inventário, comparação e detalhe sem rolagem horizontal indevida em **390, 768 e 1440 px**. A tabela comparativa tem rolagem própria quando necessário. |
| Bundle | Sem referências a Escobar, `service_role`, `SUPABASE_SERVICE_ROLE_KEY` ou Three.js. |

Capturas sintéticas locais, ignoradas pelo Git: [projetos 390 px](../apps/promoven-connect-web/test-results/visuals/catalog-projects-390.png), [inventário 390 px](../apps/promoven-connect-web/test-results/visuals/catalog-390.png), [comparação 390 px](../apps/promoven-connect-web/test-results/visuals/catalog-compare-390.png), [unidade 390 px](../apps/promoven-connect-web/test-results/visuals/catalog-unit-390.png), [inventário 768 px](../apps/promoven-connect-web/test-results/visuals/catalog-768.png) e [inventário 1440 px](../apps/promoven-connect-web/test-results/visuals/catalog-1440.png). As outras telas também foram capturadas nas três larguras.

## Limitações de imagens e 3D

`project_assets` do PC-02 guarda somente metadados; não existe no Connect um fluxo validado de upload, publicação, bucket privado ou URL curta. Por isso o PC-04 **não entrega imagens, plantas ou modelos 3D**; usa placeholder de marca e mantém catálogo 2D funcional. Não consulta Storage ou banco Escobar e não inclui Three.js. O contrato de manifesto e carregamento sob demanda continua descrito em `PROMOVEN_CONNECT_INTEGRATION_PLAN.md`, para execução futura após política de assets e autorização.

## Estado do Git, rollback e PC-05

Os diretórios `apps/`, `packages/`, `infra/promoven-connect/` e os documentos `PROMOVEN_CONNECT_*.md` já estavam não rastreados no início do PC-04 e foram preservados. Não houve alteração de arquivos da landing, Escobar, leads ou Blender. Nenhum commit, push ou deploy foi feito.

Rollback local: desabilitar as rotas PC-04 e a permissão de preço na UI; manter backup e auditoria do banco Connect. Uma migração compensatória revisada deve revogar/remover as RPCs PC-04, `broker_favorites` e `projects.broker_price_visible` somente após avaliar favoritos persistidos e dependências. Não executar `db reset`, `db push` ou tocar PC-01/02/03; não há deploy remoto a reverter.

PC-05 pendente: mecanismo Connect seguro para publicação/entrega de imagens e plantas, manifesto opcional para 3D, conforme autorização futura; links atribuíveis e leads continuam fora do PC-04. Nenhum código PC-05 foi implementado.
