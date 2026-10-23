# Promoven Connect — plano de implementação (PC-00)

Estado: planejamento; PC-01 requer autorização explícita. Este PC-00 somente criou documentação. Nenhuma migração, feature, deploy, seed ou recurso remoto foi criado.

## Sequência de checkpoints

| Checkpoint | Entrega | Aceite e teste | Reversão |
| --- | --- | --- | --- |
| PC-01 — fundação | `apps/promoven-connect-web`, contratos base, projeto Supabase **local isolado**, Auth, perfis, organizações, membros, papéis e RLS; testes de autorização. | Login e troca de organização; membro ativo lê somente seu tenant; usuário inativo, anônimo e cross-tenant negados por SQL/API; nenhum segredo no bundle. | Remover app/infra novos localmente após preservar dados de teste; migração remota futura tem rollback compensatório, não `db reset --linked`. |
| PC-02 — projeto e inventário | Projetos, unidades, publicação, CSV preview/diff/confirm, versão e auditoria. | Unicidade de código, preço exato, conflito `409`, lote atômico, projeto oculto até publicação; testes UI 390/768/1440. | Desativar UI; migração compensatória e backup de dados se remoto. |
| PC-03 — corretores | Perfil CRECI, convite, aceite, autorização, suspensão e revogação. | Identidade correta, token único/expirado, revogação imediata, teste concorrente. | Revogar novos convites e desabilitar módulo mantendo auditoria. |
| PC-04 — portal corretor | Catálogo privado 2D responsivo, filtros e detalhe; adaptador opcional 3D. | Corretor vê somente projetos ativos; carregamento móvel e teclado; fallback sem WebGL. | Ocultar rota e desligar acesso no backend; preservar dados. |
| PC-05 — links e compradores | Tokens de compartilhamento, projeção pública, formulário e atribuição transacional. | Link ativo atribui ao dono correto; revogado não atribui; retry cria um lead; dados privados não vazam. | Desabilitar endpoint de submissão e links; preservar leads, reduzir exposição pública por flag. |
| PC-06 — CRM e métricas | Estados, atividades e relatórios básicos de corretor/organização. | PII somente a sujeitos autorizados; histórico append-only; totais consistentes com filtros. | Desligar UI/rotas mantendo trilha auditável. |
| PC-07 — piloto | E2E, acessibilidade, configuração staging, observabilidade, retenção e runbook. | Fluxo completo com duas organizações e contas sintéticas; testes negativos, desempenho, responsividade, revisão de bundle/Storage, backup/rollback ensaiados. | Reverter build/flags e revogar endpoints; recuperação documentada. |

Cada checkpoint inclui código, migrações quando pertinentes, testes, validação de segurança, evidência responsiva quando houver UI, documentação, limites conhecidos e instruções de rollback. Passar ao próximo somente após gates do anterior.

## Tarefas concretas de PC-01

1. Criar `apps/promoven-connect-web/` com React/Vite/TypeScript, rotas protegidas e layout em pt-BR, sem alterar `xixova/maquette_web` ou `xixova/director_web`.
2. Criar `packages/connect-contracts/` apenas para schemas de entrada/saída realmente usados; fixar versões de dependências e scripts de lint, TypeScript, unit, integração e build.
3. Criar `infra/promoven-connect/supabase/config.toml` com portas locais exclusivas, signup/redirects definidos e sem project ref remoto. Documentar verificação de alvo antes de qualquer comando remoto.
4. Escrever primeira migração de `profiles`, `organizations`, `organization_members` e controle de administrador de plataforma; criar índices, constraints, RLS, grants e helpers `private` com `search_path` fixo. Não incluir tabela de corretores/projetos ainda se não for necessária à fundação.
5. Implementar Auth Connect (PKCE, sessão, recuperação) e bootstrap de administrador local controlado. A UI usa membership ativo e não papel global para autorizar telas.
6. Criar testes SQL com dois tenants, usuários em múltiplas organizações, membro inativo, usuário sem vínculo, anon, tentativa de mudar `organization_id` e tentativa de escrita direta. Testar tanto `SELECT` quanto `INSERT/UPDATE/DELETE` e funções.
7. Criar teste E2E de login/guardas e capturas em 390, 768 e 1440 px; inspecionar build para credenciais e imports do Supabase Escobar.
8. Revisar diffs e plano de rollback. Não executar `supabase link`, `db push`, DNS, Vercel ou deploy em PC-01 sem autorização remota específica; a autorização para implementar PC-01 cobre trabalho local seguro.

## Gates transversais

- `npm`/TypeScript/lint/testes aplicáveis verdes; migrações testadas em banco Connect local limpo e incremental.
- Testes negativos da matriz de segurança passam e são executados em CI futuro. Não há CI versionado no snapshot atual, portanto criar workflow isolado em PC-01 sem executar operações remotas.
- Schema/contratos versionados; mudança de campos sensíveis ou política pública exige revisão explícita e teste de projeção.
- `service_role`, DSN, HMAC e secrets não aparecem em código cliente, env `VITE_*`, bundle, logs ou docs.
- Evidência de responsividade e teclado para telas novas; funcionalidades 3D nunca bloqueiam catálogo principal.
- Comparação com comportamento Escobar e landing: rotas, builds e artefatos existentes continuam íntegros.

## Decisões que bloqueiam etapas específicas

| Decisão | Quando necessária | Valor de trabalho proposto |
| --- | --- | --- |
| Criar projeto Supabase Connect remoto e domínio | Antes de staging/deploy, não para começar PC-01 local | Terceiro projeto isolado, host `connect.promoven.online`. |
| Forma do slug público | Antes da migração de projetos em PC-02 | `public_slug` global único; evitar colisão entre organizações. |
| Visibilidade de preço, documentos e contatos | Antes de PC-04/PC-05 | Privado por padrão, publicação campo a campo. |
| Processo de verificação CRECI e convite por e-mail | Antes de PC-03 em staging | Revisão manual e SMTP transacional próprio Connect. |
| Responsabilidade, retenção e aviso LGPD dos leads de compradores | Antes de PC-05 público/produção | Política e base legal aprovadas; não copiar texto da landing B2B. |
| Fonte e licença de inventário/GLB piloto | Antes de dados reais e visualização 3D | CSV/asset aprovados, importação auditável; primeiro teste sintético. |

## Condição de parada

PC-00 termina com estes cinco arquivos revisáveis. A implementação de PC-01 só começa após autorização explícita do usuário, conforme o pedido original.
