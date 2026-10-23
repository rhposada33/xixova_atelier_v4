# Promoven Connect — PC-06

Estado: **PC-06 implementado e validado no Connect local**, com dados sintéticos. Sem commit, push, deploy ou recursos remotos. PC-07 não iniciado.

## Funcionalidades e contratos

- Pipeline `new`, `contacted`, `qualified`, `proposal`, `won`, `lost`, apresentado em português. Usuários autorizados podem alterar estágios abertos; encerramento exige motivo. Somente gestores podem reabrir um lead fechado, com motivo. Não há alteração automática de unidade ou reserva.
- Versão otimista em toda mutação; conflito `PT409` mapeado pelo PostgREST para HTTP 409. Alteração, atividade e auditoria são atômicas.
- Atividades de contato, observação, mudança de estágio, agendamento, conclusão, encerramento e transferência. Histórico e atribuição têm triggers que impedem UPDATE/DELETE, além da ausência de grants diretos.
- Próxima ação e data persistidas, com indicação de acompanhamento vencido. Fechar lead limpa o acompanhamento pendente.
- Responsável operacional separado da atribuição histórica. Transferência explícita por gestor para corretor autorizado no projeto; motivo e auditoria obrigatórios. Não altera origem. Sem responsável explícito, o corretor de origem com acesso vigente atende; leads públicos ficam com a gestão. Após transferência, o corretor anterior deixa de receber o lead via CRM e via RPC legada.
- Lista paginada de 20 leads, histórico de 30 atividades por página, pesquisa por nome/contato, filtros no servidor por organização, projeto, corretor de origem, estágio e período. Ordenação por última atividade e ID. Kanban mostra apenas a página corrente, com acesso ao mesmo detalhe e mesmas mutações da lista.
- Rotas `/connect/leads`, `/connect/leads/:id`, `/connect/broker/leads`, `/connect/broker/leads/:id`, `/connect/analytics`, `/connect/broker/analytics`.
- Menu móvel recolhível com botão, `aria-expanded` e controle de navegação. Tema claro, verde institucional e formulários existentes preservados.

## Migrações e RPCs

Aplicadas via `npx supabase migration up --local` no diretório `infra/promoven-connect`:

- `20261023100000_commercial_crm.sql`: extensão de leads/atividades, autorização, histórico imutável e RPCs comerciais.
- `20261023101000_crm_legacy_scope.sql`: consulta PC-05 passa a usar a mesma política de responsabilidade.
- `20261023102000_crm_candidates.sql`: candidatos autorizados à transferência e exigência de destino explícito.
- `20261023103000_crm_actor_and_target.sql`: nome do autor no histórico e verificação profissional do destinatário.

RPCs: `connect_crm_list`, `connect_crm_lead`, `connect_crm_history`, `connect_crm_change`, `connect_crm_analytics`, `connect_crm_candidates`. O adaptador `src/crmApi.ts` segue o padrão RPC real do Connect; não foram criadas rotas REST fictícias. `connect_crm_change` recebe ação fechada (`status`, `activity`, `schedule`, `complete`, `transfer`) e rejeita campos extras. Versão evita duplicação por retry; um retry de mutação já aplicada recebe conflito, sem nova atividade.

Contratos em `packages/connect-contracts/src/crm.ts`; interface em `apps/promoven-connect-web/src/pages/Crm.tsx`; integração no shell `Portal.tsx` e CSS. As entidades PC-05 foram estendidas, preservando captação e eventos `received` existentes.

## Permissões efetivas

| Papel | Leitura e alteração |
| --- | --- |
| Administrador/gerente | Leads da própria organização ativa; transferência e reabertura autorizadas. |
| Corretor | Lead de origem sem transferência, ou lead atribuído operacionalmente a ele; exige autorização vigente no projeto e perfil ativo. Não transfere nem reabre encerramento. |
| Outro tenant/corretor | Sem leitura de contato, observação, histórico ou alteração do lead alheio. |
| Anônimo | Sem execução das RPCs CRM. Captação pública PC-05 permanece separada. |

Mutação bloqueia primeiro a autorização, depois o lead; suspensão/revogação concorrente é revalidada antes da alteração. A atribuição permanece histórica após revogação. Gestores continuam atendendo. Consultas seguintes recusam acesso revogado; informações já visualizadas anteriormente não podem ser removidas da memória do destinatário.

## Métricas

Agregações SQL sobre leads persistidos e autorizados. Janela de criação `[from,to)`, enviada em UTC; apresentação em `America/Sao_Paulo`. Presets de 7/30/90 dias são janelas móveis até o instante da consulta; campos de data permitem limites personalizados à meia-noite de São Paulo. O limite final é exclusivo.

Recebidos = quantidade de leads criados na janela. Distribuição por estágio = estado atual desses leads, não contagem de eventos. Acompanhamentos pendentes = data vencida até agora em lead ainda aberto. Agrupamentos por projeto, corretor de origem e até dez unidades mais consultadas usam quantidade de leads, sem inventar visitas. Ganho significa encerramento comercial informado, não comprovação de venda. Analytics não retorna nome, contato ou observação do comprador. O painel pessoal aplica escopo próprio mesmo se o usuário também for gestor.

## Verificação

- SQL/RLS: **256 asserções**, sendo 229 anteriores e 27 novas, passaram. Incluem tenant, anônimo, campos forjados, versão antiga, observações, histórico imutável, transferência inválida, revogação, paginação e analytics sem PII.
- `tests/crm-concurrency.mjs`: duas conexões reais, suspensão concorrente bloqueia e recusa atualização, sem deadlock e sem incrementar versão.
- Contratos: **15 testes**, typecheck aprovado. Web: **2 testes unitários**, TypeScript/build e lint aprovados.
- E2E comercial estende o fluxo PC-05: captação, contato, qualificação, proposta, observação, acompanhamento, encerramento, indicadores e perda de acesso após revogação. **6 testes E2E passaram**, incluindo regressões PC-01 a PC-05.
- Capturas sintéticas ignoradas pelo Git em `apps/promoven-connect-web/test-results/visuals/`: `crm-detail-{390,768,1440}.png`, `crm-analytics-{390,768,1440}.png`, `admin-leads-{390,768,1440}.png`.

Bundle verificado sem referências a Escobar, `service_role`, `SUPABASE_SERVICE_ROLE_KEY` ou Three.js. Capturas de detalhe e analytics inspecionadas; as três larguras passaram nas verificações de rolagem horizontal. `git diff --check` sem erros.

## Limites e operação

Uso exclusivamente sintético local. Aprovação de privacidade, retenção, compartilhamento e direitos dos titulares continua obrigatória antes de produção. Sem automação de mensagens ou exclusão de histórico. Busca paginada usa offset; alterações concorrentes podem mudar a posição de um lead entre páginas. Kanban não representa todos os leads ao mesmo tempo e não possui drag-and-drop. Atividades recebidas antes do CRM preservam autor de sistema.

Uma primeira tentativa de comando de migração foi executada na raiz do repositório e recusada por divergência de histórico antes de aplicar qualquer migração; os comandos efetivos foram executados no diretório isolado Connect. Nenhuma migração foi aplicada ao banco Escobar.

## Git e rollback

Alterações PC-05 preexistentes preservadas. Novos arquivos CRM e alterações em contratos, shell, CSS e teste E2E permanecem sem commit. Não houve push ou publicação.

Rollback: bloquear mutações CRM e restaurar UI anterior, preservando banco e histórico. Revogar execução das RPCs novas se necessário. Preparar migração compensatória após backup Connect; não remover campos/histórico sem avaliar leads encerrados e responsáveis transferidos. Não reintroduzir a RPC legada anterior, pois ela ignora transferência operacional. Não executar reset ou restaurar outros sistemas.

## PC-07

Nenhuma implementação PC-07. Operação remota, política de retenção aprovada, telemetria operacional e otimização de paginação exigem trabalho posterior autorizado.
