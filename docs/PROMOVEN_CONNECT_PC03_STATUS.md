# Promoven Connect — checkpoint PC-03

Data: 23/10/2026. Estado: **implementado e validado somente no Supabase Connect local**, sem deploy, DNS ou migração remota. A aplicação principal Promoven, Escobar, leads comerciais e assets 3D não foram alterados.

## Funcionalidades

- Rede privada por projeto: um corretor pode aceitar convites de várias incorporadoras, sem ganhar acesso por possuir uma identidade Auth ou perfil profissional. A autorização é única por `(project_id, broker_user_id)` e pode estar `invited`, `active`, `suspended` ou `revoked`.
- Convite por e-mail: gestor autenticado seleciona projeto e e-mail; a Edge Function Connect gera token aleatório de 256 bits e entrega **dois links** pelo Mailpit local: acesso Auth e convite. O token do convite fica no fragmento do segundo link, fora da requisição HTTP e do redirect Auth. A função devolve apenas ID, status e expiração. O banco guarda somente SHA-256, normaliza e-mail, limita convite a 48 horas e impede outro convite pendente para o mesmo e-mail/projeto. Reenvio gira o token e cancela o anterior; cancelamento e aceite são auditados. A configuração local não permite cadastro público irrestrito.
- Aceite: a pessoa abre o link, autentica ou obtém acesso por e-mail de convite, informa nome, contato e CRECI, e aceita somente com JWT Connect e e-mail confirmado igual ao convite. Aceite, vínculo e auditoria são transacionais. Token vencido, cancelado ou usado não concede acesso.
- **Política CRECI:** preenchimento inicia `pending`. Um administrador da incorporadora faz revisão **manual por autorização de projeto** e marca `verified` ou `rejected`; isto não representa validação oficial em órgão externo. Somente revisão daquele projeto, perfil agregado `verified` e ativação explícita por gestor liberam a projeção privada. Rejeição em um projeto não altera acessos de outra incorporadora. Alterar o perfil reinicia cada revisão como `pending`, suspende acessos ativos e bloqueia imediatamente a projeção privada até nova revisão e reativação.
- Gestão `/connect/brokers`: convites, reenvio, cancelamento, filtros, revisão, ativação, suspensão, revogação e histórico. Gerente pode convidar e gerir o estado da autorização, mas não verificar CRECI. A área `/connect/broker` mostra projetos ativos e estados pendentes/interrompidos; `/connect/broker/profile` edita o perfil. Não há catálogo detalhado, favoritos, links atribuídos ou leads.

## Migração, RPCs e arquivos

Migrações locais: `infra/promoven-connect/supabase/migrations/20261023050000_brokers.sql` cria `broker_profiles`, `project_broker_access`, `broker_invitations`, FKs compostas, índices/unique, RLS e grants mínimos; `20261023060000_scope_creci_reviews.sql` isola a revisão CRECI por autorização e suspende acessos após edição do perfil. RPCs: `connect_upsert_broker_profile`, `connect_create_broker_invitation`, `connect_resend_broker_invitation`, `connect_cancel_broker_invitation`, `connect_accept_broker_invitation`, `connect_verify_broker`, `connect_set_broker_access`, `connect_broker_projects`, `connect_broker_access_status`.

| Arquivo | Papel |
| --- | --- |
| `infra/promoven-connect/supabase/functions/broker-invite/index.ts` | Geração de token, link Auth e entrega SMTP local. Segredo de serviço fica somente no runtime da função. |
| `infra/promoven-connect/supabase/.env.functions.example` | Configuração de entrega local; cópia `.env.functions.local` é ignorada. |
| `packages/connect-contracts/src/broker.ts`, `broker.test.ts` | Contratos/validação do perfil e testes. |
| `apps/promoven-connect-web/src/brokerApi.ts` | Adaptador tipado de SELECT sob RLS, RPCs e Edge Function. |
| `apps/promoven-connect-web/src/pages/Brokers.tsx` | Gestão, perfil, área do corretor e aceite do convite. |
| `apps/promoven-connect-web/src/pages/Portal.tsx`, `src/main.tsx`, `src/access.ts`, `src/style.css`, `index.html` | Rotas, navegação, retorno seguro para convite e identidade responsiva. |
| `apps/promoven-connect-web/tests/brokers.spec.ts` | E2E com Mailpit, duas tentativas concorrentes, ativação e revogação. |
| `infra/promoven-connect/supabase/tests/database/brokers.test.sql` | 49 testes SQL/pgTAP PC-03. |

## Segurança verificada

- Projetos e unidades base continuam legíveis somente para membros internos sob RLS. A RPC do corretor devolve apenas resumo de projetos com autorização `active`, organização ativa e perfil `verified`; não devolve preço, inventário privado ou documento.
- RLS impede leitura cross-tenant de convites e autorizações. `token_hash` não tem grant SELECT para `authenticated`; não há token claro em tabela, resposta da Edge Function, bundle ou evento de auditoria. O token via fragmento é consumido antes do cliente Auth e removido da barra de endereço; `Referrer-Policy: no-referrer` protege a navegação.
- As RPCs derivam corretor de `auth.uid()` e conferem e-mail confirmado no Auth. Administrador e gerente são revalidados por membership ativa no banco; broker não pode alterar seu estado. Versão antiga ou estado inválido retorna HTTP 409.
- Unicidade do convite pendente e do vínculo broker/projeto impede duplicação mesmo sob concorrência. Suspensão, revogação ou CRECI pendente naquele projeto removem o projeto imediatamente da RPC privada. Revisão ou rejeição de outro projeto não concede nem retira essa autorização.
- A Edge Function aceita apenas JWT Connect, funciona só com `CONNECT_DELIVERY_MODE=local` nesta entrega e envia por SMTP ao Mailpit local. Não há credencial de serviço no bundle web.

## Testes e evidências

| Verificação | Resultado |
| --- | --- |
| `npx supabase test db` | **119** passaram: 30 PC-01, 40 PC-02 e 49 PC-03. Cobrem identidade incorreta, token reutilizado/vencido/cancelado, revisão CRECI por projeto, múltiplas organizações, isolamento, suspensão, revogação, versões e auditoria. |
| Pacote `connect-contracts` | Typecheck e **13** testes passaram. |
| App web | Build, lint e **2** testes unitários passaram. |
| `npm run test:e2e` com Mailpit e Edge Function locais | **5** passaram, incluindo regressões PC-01/PC-02, entrega e aceite do convite, revisão, ativação, revogação e dois convites concorrentes para mesmo projeto/e-mail (um sucesso e um conflito). |
| Layout | Convite, perfil profissional, área do corretor e gestão verificados sem rolagem horizontal em **390, 768 e 1440 px**. |
| Bundle | Sem `escobar`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY` ou `three.js`. |

Capturas sintéticas locais: [gestão 390 px](../apps/promoven-connect-web/test-results/visuals/brokers-390.png), [gestão 768 px](../apps/promoven-connect-web/test-results/visuals/brokers-768.png), [gestão 1440 px](../apps/promoven-connect-web/test-results/visuals/brokers-1440.png), [convite 390 px](../apps/promoven-connect-web/test-results/visuals/invite-390.png), [área do corretor 390 px](../apps/promoven-connect-web/test-results/visuals/broker-home-390.png) e [perfil 390 px](../apps/promoven-connect-web/test-results/visuals/broker-profile-390.png). As outras larguras dessas três telas também foram capturadas. São artefatos ignorados pelo Git.

## Limitações e estado do Git

- Entrega de convite validada apenas com Mailpit local. SMTP transacional remoto, reputação de remetente, templates e operação de fila/retry ainda exigem infraestrutura Connect dedicada. Uma falha de e-mail cancela o convite recém-criado, mas pode deixar uma identidade Auth provisionada sem autorização; ela não obtém projeto.
- CRECI é revisado manualmente; não há consulta oficial externa. O estado efetivo “vencido” é derivado de `expires_at` na UI e no aceite, mesmo que uma linha antiga permaneça `pending` até cancelamento/reenvio. Não há job de expiração remota.
- A área do corretor mostra somente uma lista inicial de projetos autorizados. O catálogo 2D detalhado é PC-04. O histórico administrativo limita a interface aos 30 eventos mais recentes, embora a tabela de auditoria mantenha os eventos.
- A validação E2E de largura cobriu as quatro telas PC-03. Não houve validação remota.
- O Git permanece sem commits ou push. Os arquivos PC-00/PC-01/PC-02 já estavam não rastreados ao iniciar PC-03; foram preservados. Os arquivos PC-03 também estão não rastreados. Nenhum arquivo de Escobar, landing, leads ou Blender foi alterado.

## Rollback local e pendências PC-04

Parar a função `broker-invite` e desabilitar as rotas PC-03 antes de qualquer rollback de dados. Preservar auditoria e fazer backup do banco Connect; usar migração compensatória revisada para remover RPCs/tabelas PC-03 somente após resolver referências e dados sintéticos. Não executar `db reset` em banco existente nem tocar PC-01/PC-02. Não há deploy remoto a reverter.

PC-04 pendente: catálogo privado 2D por corretor, filtros e detalhe seguro, com integração 3D opcional conforme `PROMOVEN_CONNECT_INTEGRATION_PLAN.md`. Nenhum código PC-04 foi implementado.
