# Promoven Connect — PC-07A: preparação do piloto

**Implementado e validado localmente com dados sintéticos em 23/10/2026.** Preparação operacional/documental concluída; liberação remota e uso de dados reais não aprovados. PC-07B não iniciado. Sem commit, push, deploy, DNS, Cloud ou alteração da landing/Escobar/leads B2B/Blender.

## Inspeção e isolamento

Revisados AGENTS, documentos PC-00, relatórios PC-01–06, integração, shell, contratos, RPCs, migrações e testes. Git limpo no início deste checkpoint; alterações feitas aqui permanecem no checkout. Estado remoto não inferido.

Connect usa contêineres `supabase_*_promoven_connect_local`, API 56321, DB 56322, Mailpit 56324 e analytics 54327. Outros serviços locais possuem contêineres/bancos separados; não foram reiniciados nem migrados. As portas Docker são publicadas em `0.0.0.0`/IPv6: isso não é isolamento de rede completo; restringir firewall/bind antes de expor a máquina a rede não confiável. A aplicação usa `127.0.0.1:5178`; o fixture só conecta ao DB Connect local.

## Funcionalidades e melhorias de UX

- `/connect/onboarding`, entrada **Primeiros passos** e CTA **Preparar minha operação** no dashboard.
- Organização e projeto selecionáveis; oito grupos cobrem provisionamento/admin, projeto, inventário, mídia, visibilidade/publicação, corretores, links e CRM/analytics.
- Progresso calculado de registros autorizados, com labels explícitos e ressalva de revisão humana; nenhum KPI fictício. Publicação de preços não é exigida.
- Atalhos para módulos existentes, revisão pública em nova aba, instruções de sequência e estado sem organização/projeto.
- Adição de equipe interna por e-mail de conta previamente provisionada; somente administrador da organização. Reutiliza RPC auditada PC-01. Não muda autenticação, papéis nem habilita cadastro público.
- Carregamento, retry de falha, aviso de conta ausente/duplicidade, botão ocupado e recuperação de erro. Troca de organização reinicia o estado do roteiro; resposta obsoleta é descartada.
- Corrigida seleção simultânea de “Área do corretor” e subpágina no menu (`NavLink end`). Preservados menu móvel, seletor administrativo, tema claro, verde e tipografia existentes.
- Ajustados testes antigos que dependiam da primeira organização ou contagem global de auditoria: agora escopam organização/ator explicitamente, preservando cenários existentes.

O roteiro orienta publicação de mídia/preços, mas o indicador registra existência, não certifica revisão, entrega de e-mail ou conformidade. Provisionamento de identidade inicial permanece administrativo; não há nova UI de revogação da equipe interna neste checkpoint. Não houve redesign amplo.

## Arquivos e migração

```text
apps/promoven-connect-web/
  src/pages/Onboarding.tsx                 novo roteiro e equipe
  src/pages/Portal.tsx                     rota, CTA, menu
  src/style.css                           cards/progresso responsivos
  tests/onboarding.spec.ts                 roteiro, erro/retry, teclado, larguras
  tests/pilot-seed.mjs                     fixture transacional local e medições
  tests/{auth,projects,brokers,media}.spec.ts  escopo de organização nos testes
  .gitignore                              relatórios locais ignorados
infra/promoven-connect/supabase/
  migrations/20261023110000_pilot_onboarding.sql
  tests/database/onboarding.test.sql      14 asserções novas
  tests/database/foundation_rls.test.sql   contagem de auditoria por ator
 docs/PROMOVEN_CONNECT_{PC07A_STATUS,DEPLOYMENT_PLAN,ONBOARDING,PILOT_CHECKLIST}.md
 docs/PROMOVEN_CONNECT_INTEGRATION_PLAN.md atualização
```

Migração aplicada **somente localmente**, via `npx supabase migration up --local` em `infra/promoven-connect`:

- `connect_onboarding(uuid)`: security definer, search_path vazio; permite administradores/gerentes ativos da organização, contagens por projeto do tenant.
- `connect_add_member_by_email(uuid,text,text)`: exige administrador antes de buscar e-mail em Auth, normaliza conta e delega à RPC existente; sem service key no cliente. Não envia e-mails.
- Execução revogada de public/anon e concedida a authenticated; autorização efetiva dentro das funções. Nenhuma tabela/coluna nova nem alteração dos contratos/validadores PC-01–06.

## Verificação e evidências

| Verificação | Resultado local |
| --- | --- |
| SQL/RLS `npx supabase test db` no diretório Connect | **270 asserções aprovadas**, 256 anteriores + 14 de onboarding. |
| Contratos | **15 testes**, typecheck aprovado; validadores existentes preservados. |
| Web | **2 testes unitários**, TypeScript/build e lint aprovados. |
| E2E | **7 cenários aprovados** após correções: seis passaram na suíte e mídia passou na reexecução dirigida (3,7 s; execução 6,4 s). A suíte anterior de 57,1 s ainda carregava a versão antiga do teste de mídia. |
| Concorrência | `link-concurrency.mjs` e `crm-concurrency.mjs` aprovados: revogação concorrente recusa captação/atualização, sem deadlock. |
| Auth público | Chamada local signup recusada com **422 `signup_disabled`**. |
| Bundle | Busca sem `escobar`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY` ou `three.js`; público/privado seguem chunks separados. Nenhuma credencial privilegiada nova. |
| Layout | Roteiro e regressões em **390/768/1440 px**, sem overflow horizontal nos checks; teclado no menu/links, formulário e retry exercitados. |

Capturas sintéticas em `apps/promoven-connect-web/test-results/visuals/`, ignoradas pelo Git:

- [Roteiro 390](../apps/promoven-connect-web/test-results/visuals/onboarding-390.png), [768](../apps/promoven-connect-web/test-results/visuals/onboarding-768.png), [1440](../apps/promoven-connect-web/test-results/visuals/onboarding-1440.png), inspecionadas visualmente.
- [Projeto 768](../apps/promoven-connect-web/test-results/visuals/project-768.png), [CRM 390](../apps/promoven-connect-web/test-results/visuals/crm-detail-390.png), [analytics 1440](../apps/promoven-connect-web/test-results/visuals/crm-analytics-1440.png), [catálogo público 390](../apps/promoven-connect-web/test-results/visuals/public-share-390.png), também inspecionados. As famílias de regressão incluem as três larguras.

Acessibilidade avaliada por teclado/labels/foco/feedback e inspeção visual; não é certificação WCAG nem ensaio com leitor de tela. Inputs nativos de data/arquivo seguem idioma do navegador; textos da aplicação são pt-BR.

## Piloto sintético e dificuldades observadas

Cenário identificado em [checklist](PROMOVEN_CONNECT_PILOT_CHECKLIST.md): **uma organização, dois empreendimentos, 50 unidades, cinco corretores, dez links, dez leads, dez acompanhamentos e quatro propostas**. Relatório de execução em `pilot-results/pc07a.json`; métricas são consultas ao banco e as contagens foram verificadas. Cada execução cria organização separada e preserva dados anteriores.

Os cinco perfis/autorizações são fixtures técnicas, não cinco usuários humanos testados. Convite, aceite, upload e captação HTTP real local são exercitados nos E2E de regressão. Não foram criados uploads fictícios no cenário de volume; seu roteiro mostra corretamente mídia pendente. Tempos RPC e falhas de preparação estão no checklist; não há alegação de desempenho remoto, produtividade humana ou teste de carga.

## Segurança e privacidade

Regressão cobre multiempresa, grants, escopo de gerente/admin/corretor, revogação, Storage privado e projeção pública, preço oculto, versão otimista, CSV atômico, links expirados/revogados, idempotência, auditoria e histórico imutável. Onboarding não devolve PII de compradores nem dados de outro tenant. Analytics segue agregações autorizadas PC-06. Novas funções não registram e-mail fornecido em logs; adição de membro gera auditoria existente por UID.

Permanecem limites materiais: URLs já assinadas duram até 60 s; token comercial em URL exige redigir logs de proxy; rate limit depende de origem confiável antes do remoto; imagens não são reencodadas; política de expurgo não implementada; backup/restore remoto não ensaiado. Contas/autorizações de provedor e revisão jurídica não verificadas. O plano operacional especifica retenção proposta, compartilhamento, direitos, incidente e recuperação, **sem afirmar conformidade legal**. Nenhum comprador real foi utilizado.

## Infraestrutura, integração e rollback

- [Infraestrutura e operação](PROMOVEN_CONNECT_DEPLOYMENT_PLAN.md): recursos/custos, SMTP, variáveis, DNS/redirects, logs, backup de banco e objetos, metas propostas e bloqueios.
- [Integração Promoven](PROMOVEN_CONNECT_INTEGRATION_PLAN.md): página futura de apresentação em `www.promoven.online/connect`, acesso em `connect.promoven.online/login`, navegação, identidade e fallback. Landing não alterada. 3D continua contrato opcional sob demanda, sem implementação de visor.
- [Onboarding](PROMOVEN_CONNECT_ONBOARDING.md): roteiro operacional sem SQL nas atividades normais e papel do provisionamento autorizado.

Rollback PC-07A: retirar rota/CTA/menu do roteiro; revogar execução das duas novas RPCs se necessário. Preservar membros adicionados, organizações e auditoria. Migração é aditiva; qualquer remoção deve ser compensatória revisada e precedida de backup Connect. Não resetar banco, apagar o fixture em cascata nem restaurar Escobar. Não existe deploy remoto a reverter.

## Estado do Git e recomendação

Alterações limitadas aos caminhos acima, sem commit/push. Capturas, relatórios e envs locais permanecem ignorados. `git diff --check` aprovado. Arquivos e dados anteriores preservados.

Recomenda-se PC-07B **apenas após autorização explícita**, para endurecimento operacional e staging sintético isolado: transporte remoto, proxy/rate limit, processamento de mídia, observabilidade, procedimentos de retenção/direitos e ensaio de restauração. A entrada de compradores reais exige aprovação adicional das políticas e do piloto com usuários. Este checkpoint termina aqui.
