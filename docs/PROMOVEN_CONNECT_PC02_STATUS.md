# Promoven Connect — checkpoint PC-02

Data: 23/10/2026. Estado: **implementado e validado localmente** sobre o PC-01 local. Nenhum serviço remoto foi pressuposto ou modificado. Connect permanece aplicação privada separada da landing Promoven e de Escobar.

## Funcionalidades implementadas

- Projetos por organização: criação por administrador, edição versionada de nome, localização, endereço, descrição e visibilidade; slug público globalmente único; estados `draft`, `published`, `archived` com mudança explícita por administrador.
- Unidades: criação, leitura, edição versionada e exclusão auditada por administrador ou gerente com membership ativo. Código normalizado em maiúsculas, único por projeto. Área e preço em PostgreSQL `numeric`; entrada normalizada em strings decimais pelo contrato compartilhado.
- Inventário responsivo com busca por código, filtros de andar, tipologia e status e contagens derivadas das unidades reais. Lista de projetos com filtro de status, pesquisa nas páginas carregadas e paginação de 100 registros.
- CSV UTF-8 limitado a 2 MiB/2.000 linhas. Parser compartilhado valida cabeçalho, aspas, duplicatas, números e versões. Prévia RPC é somente leitura e apresenta novo, alterado, igual ou conflito; a UI mostra preços e status antes/depois. Confirmação revalida linhas, hash, versões e tenant sob bloqueio do projeto, aplica o lote numa transação e registra resultado idempotente e auditoria. Conflitos de versão retornam HTTP 409.
- Projeção pública construída no banco: apenas projeto publicado e unidades marcadas publicadas; preço, descrição, atributos e disponibilidade obedecem às flags explícitas. Preço privado por padrão. Documentos e caminhos de assets nunca entram nessa projeção.
- Tabelas `projects`, `units`, `project_assets`, `inventory_imports` com RLS e grants somente de leitura para membros. Escritas ocorrem exclusivamente em RPCs autorizadas; FKs compostas impedem ownership divergente. Auditoria PC-01 é reutilizada. Histórico recente aparece para administrador no detalhe do projeto.
- Dashboard PC-01 aponta para empreendimentos; navegação, seletor de organização, criação restrita de organização, login e recuperação foram preservados. Estado vazio orienta a criação do primeiro projeto.

## Estrutura final de arquivos

| Caminho | Função |
| --- | --- |
| `packages/connect-contracts/src/inventory.ts`, `csv.ts` | Tipos, normalizadores, projeção auxiliar e parser CSV compartilhados. |
| `apps/promoven-connect-web/src/connectApi.ts` | Adaptador tipado para SELECT sob RLS e RPCs Connect. |
| `apps/promoven-connect-web/src/pages/Projects.tsx` | Projetos, detalhe, unidades, importação e histórico. |
| `apps/promoven-connect-web/src/pages/Portal.tsx`, `src/style.css` | Navegação e identidade responsiva do PC-01 estendidas. |
| `apps/promoven-connect-web/tests/projects.spec.ts` | E2E do fluxo PC-02 e screenshots. |
| `infra/promoven-connect/supabase/tests/database/projects_inventory.test.sql` | 40 verificações SQL/pgTAP de PC-02. |

## Migrações locais

Aplicadas somente ao Supabase local de `infra/promoven-connect/` com `supabase migration up --local`:

1. `20261023000000_projects_inventory.sql`: schema, RLS, RPCs de CRUD, importação, publicação e projeção pública.
2. `20261023010000_correct_inventory_validator.sql`: correção local do validador para as 12 propriedades do CSV; a primeira migração também está corrigida para instalações novas.
3. `20261023020000_serialize_inventory_writes.sql`: serialização de toda escrita de unidade no projeto.
4. `20261023030000_http_conflicts.sql`: resposta HTTP 409 via SQLSTATE `PT409`; a primeira migração também contém esse código para instalações novas.
5. `20261023040000_import_summary.sql`: resultado persistido de importações confirmadas. Prévia não persiste dados.

## Testes e evidências visuais

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck && npm test` em `packages/connect-contracts` | 10 testes passaram. |
| `npm run build && npm run lint && npm run test:unit` em `apps/promoven-connect-web` | Build, lint e 2 testes passaram. Vite informa chunk de ~507 kB; otimização futura. |
| `npx supabase test db` em `infra/promoven-connect` | 70 testes passaram: 30 PC-01 + 40 PC-02. |
| `npm run test:e2e` com credenciais sintéticas locais | 4 testes passaram: login, recuperação, organização/perfil e fluxo projeto/unidade/publicação/CSV. O E2E também verificou HTTP 409. |
| Bundle de produção | Sem texto `escobar`, `service_role`, `SUPABASE_SERVICE_ROLE` ou `three.js`. Nenhuma chave privilegiada foi adicionada ao app. |
| Larguras de 390, 768 e 1440 px | E2E confirmou ausência de rolagem horizontal nas telas de dashboard e projeto. |

Capturas locais: [projeto 390 px](../apps/promoven-connect-web/test-results/visuals/project-390.png), [768 px](../apps/promoven-connect-web/test-results/visuals/project-768.png), [1440 px](../apps/promoven-connect-web/test-results/visuals/project-1440.png). São artefatos locais ignorados pelo Git, com dados sintéticos.

## Critérios de aceite

Os testes cobrem criação por administrador, edição de unidade por gerente, isolamento de projetos e unidades entre organizações, rejeição de escrita direta e de ownership no payload, unicidade de código, precisão decimal, conflito de versão/HTTP 409, prévia sem escrita, importação atômica e idempotente, draft invisível ao público, preço privado, publicação explícita, auditoria e regressão PC-01. A UI cobre CRUD, filtros, histórico e revisão CSV nos três tamanhos solicitados.

## Limitações

- `project_assets` é estrutura de metadados privada. Não há upload, bucket, URL assinada, processamento 3D nem publicação de imagens/plantas neste checkpoint. As flags de imagens e plantas ficam preparadas, mas não produzem mídia pública sem autorização e Storage próprios. Documentos permanecem privados e não são servidos.
- A busca de projetos usa apenas as páginas carregadas; a UI oferece “Carregar mais”. O inventário consulta páginas de 200 registros até carregar o projeto ativo. Para catálogos muito grandes, filtros e cursores no servidor serão necessários.
- O campo `file_hash` da importação representa o SHA-256 do payload de linhas normalizadas recebido pelo servidor; não é um checksum dos bytes originais do CSV.
- A projeção pública existe como RPC segura, sem tela de catálogo pública. Links atribuídos, leads e corretores pertencem aos checkpoints posteriores.
- Nenhuma migração, configuração de Auth, DNS ou deploy foi aplicada remotamente. O resultado prova somente o ambiente local com dados sintéticos.

## Rollback e pendências PC-03

Sem deploy, rollback de aplicação consiste em reverter apenas os arquivos PC-02 após revisão, preservando PC-01 e arquivos preexistentes não rastreados. **Não** executar `db reset` ou `db push` em banco existente. Em ambiente futuro, tirar backup e aplicar migração compensatória revisada para tabelas e RPCs PC-02; reverter a versão do app em deploy isolado. O plano completo está em `PROMOVEN_CONNECT_INTEGRATION_PLAN.md`.

PC-03 permanece pendente: autorizações e convites de corretores, conforme escopo original. Nenhum código de PC-03 foi criado.
