# Promoven Connect — PC-07C.1

23/10/2026. Preparação local de staging remoto; **nenhum deploy, recurso Cloud, DNS, migração remota, e-mail real, commit, push ou merge**. Nenhuma alteração em Escobar, landing, leads comerciais ou Blender. Este checkpoint não autoriza PC-07C.2.

## Decisão de arquitetura e custos

Recomendado Supabase self-hosted exclusivo Connect, runtime Edge privado, gateway sem rota de funções e proxy com TLS/origem confiável. Frontend separado na VM ou Vercel Pro. Supabase Cloud com Edge gerenciada não reproduz a manipulação local de Kong/rede; alternativa Cloud DB/Auth/Storage + runtime privado próprio precisa adaptação e ensaio. A topologia e inventário por componente estão na [arquitetura remota](PROMOVEN_CONNECT_REMOTE_ARCHITECTURE.md).

Demo mínima estimada US$53/mês (frontend VM) ou US$73 (Vercel); staging operacional US$88–98; produção inicial **sem HA** US$195–230. Preços públicos, hipóteses, franquias e exclusões na [matriz de custos](PROMOVEN_CONNECT_COST_MATRIX.md). Planos/quotas/slots das contas: **UNKNOWN**, sem conectores administrativos autorizados disponíveis. Não presumido nenhum projeto gratuito. Infraestrutura e custódia operacional não contratadas.

## Implementação entregue

- Preflight read-only com alvo fixo local, validação de descriptor remoto explicitamente permitido, rejeição de Escobar/refs desconhecidas, Node/CLI/dependências/lockfiles/configuração/rotas/bundle/runbooks e evidências. Não contém link/push/deploy/DNS.
- Runner local explícito, sequencial para não sobrepor escritores e restore. Registra tempo, escopo, alvo, digest, hash de relatório e log; stdout por check sem segredos. Sem flag, apenas imprime plano.
- Gate v2 separa staging sintético, produção e compradores reais. Verifica artefatos, hashes, idade, alvo, fontes, HEAD da aprovação e referência da autorização. Alvos/aprovações vazios; booleans legados não concedem release.
- Ensaio de 34 migrações em dois bancos descartáveis sem rede/portas/volumes existentes; baseline schema-only da plataforma Supabase local, schemas e roles Connect removidos somente na cópia. Instalação limpa Connect e atualização incremental com sentinela preservada, journal/checksums e reexecução sem reaplicar DDL.
- Build em workspace e cópia limpa, cinco npm ci --offline por lockfiles, comparação SHA-256 dos seis arquivos gerados.
- Demo reutiliza seed transacional PC07A e acrescenta upload/publicação/download reais de duas imagens via Edge/proxy/Storage, reencode/checksum e ausência de EXIF/ICC. Não duplica validadores de contracts.
- Teste onboarding evoluído para a fixture completa: oito etapas, incluindo mídia. Teste de revogação aguarda confirmação HTTP/RPC e estado Revogado antes de recarregar o catálogo. Configuração pública também valida VITE herdada do processo; build só recebe a allowlist revisada. ESLint inclui scripts Node .mjs dos testes. Não houve mudança no fluxo Auth, RPCs de negócio, RLS, Storage ou novas migrações de aplicação.

## Estrutura de arquivos

```text
infra/promoven-connect/staging/
  .gitignore                   # .local privado/ignorado
  preflight.mjs                # inspeção read-only
  target.mjs                   # alvos e variáveis públicas permitidas
  evidence.mjs                 # digest, evidência e matrizes de release
  preflight.test.mjs           # rejeições e aprovações independentes
  validate.mjs                 # plano padrão / --execute-local
  migrations-local.py          # clone schema-only e migrações descartáveis
  build-reproducible.mjs       # cópia limpa + cinco lockfiles + hashes
  hygiene.mjs                  # Git/artefatos/bundle/segredos sem valores
  check-release.mjs            # staging ou production, fail-closed
  readiness.json               # v2 + histórico, sem aprovação
  environment.example          # blueprint self-hosted, delivery disabled
  validate-local.sh            # wrapper legado prepara nova demo
apps/promoven-connect-web/
  tests/staging-demo.mjs        # demo completa, somente local
  tests/onboarding.spec.ts      # fixture PC07C1 com mídia
  tests/brokers.spec.ts         # aguarda confirmação de revogação
  eslint.config.js             # globals Node para .mjs
```

Documentos criados: este relatório, REMOTE_ARCHITECTURE, COST_MATRIX, STAGING_APPROVAL. Atualizados DEPLOYMENT_PLAN e RELEASE_READINESS. Artefatos não versionados: staging/.local, web/pilot-results, web/test-results/visuals e ops/artifacts.

## Resultados finais e evidências verificáveis

**PC-07C.1 concluído no escopo local; liberação remota BLOCKED.** Execução final terminou em 2026-10-24T02:20:05.791Z (23/10, 23:20 BRT). Todos os onze grupos possuem o mesmo digest das fontes `88d371c7a46b22fb9ff280c74a942177d84326b912d0808f01b04ed8110891e4`; logs/relatórios conferidos pelo preflight. Ambiente observado: Node 20.19.5, npm 10.8.2, Supabase CLI 2.118.0, imagem Postgres 17.11.0.004. Versões futuras remotas devem ser escolhidas/revalidadas, não copiadas por pressuposto.

| Check | Resultado | Tempo do grupo | Cobertura |
| --- | --- | ---: | --- |
| migrations | **PASS local** | 31.20 s | 34 migrações × 2 cenários; 341 SQL/RLS em cada; checksum rerun |
| sqlRls | **PASS local** | 6.47 s | 12 arquivos / 341 verificações SQL/RLS na origem local |
| unitContracts | **PASS local** | 8.30 s | 42 casos: Sharp 5, privacidade 2, mail 5, ops/proxy/preflight 13, contracts 15, web 2; typecheck/lint |
| proxyHttp | **PASS local** | 13.46 s | Edge real, HMAC, bypass, rate compartilhado, restart e falhas |
| mailHttp | **PASS local** | 8.53 s | 16 verificações reais de outbox/SMTP sink/concorrência/reconciliação |
| webBuild | **PASS local** | 19.39 s | 5 instalações npm ci --offline; 2 builds, 6 arquivos idênticos |
| syntheticDemo | **PASS local** | 1.79 s | 1 organização, 2 projetos, 50 unidades, 5 corretores, 10 links/leads/acompanhamentos, 4 propostas e 2 mídias |
| webE2e | **PASS local** | 52.30 s | 8/8, zero skips/retries; Playwright 51,3 s; 390/768/1440 px |
| concurrency | **PASS local** | 0.67 s | 3 verificações: suspensão × lead; suspensão × CRM; reservas/quota de mídia |
| recovery | **PASS local** | 20.83 s | 341 SQL/RLS na cópia + Auth/Storage/outbox/supressões HTTP |
| hygiene | **PASS local** | 0.21 s | 192 arquivos Connect; 12 valores privilegiados comparados sem revelar; bundle sem Escobar; ignores/diff |

Tempo somado dos grupos: **163.15 s**. SQL total desta execução: **1.364 assertions** (341 origem + 682 nos dois ensaios de migração + 341 restore); são repetições nos quatro contextos, não 1.364 casos diferentes. Restore: **20 s** no script, **6,70 s** na fase HTTP, além do tempo do wrapper. Auth health/login/user, Storage privado negado, signed download/checksum, recuperação Mailpit, outbox decifrada/claim/aceite, journal verificado, reaplicação, eliminação dos objetos/mail e bloqueio de reintrodução: todos true na cópia. Fonte preservada e contêineres descartáveis removidos; dois mail workers retomados.

**Preflight final:** 37 verificações, 36 PASS e uma **BLOCKED** (`cspRemote`); nenhuma FAIL ou NOT RUN local. Exit 1 esperado pelo bloqueio remoto. Quatro smoke tests negativos do executável passaram (Escobar, ref não aprovada, outra porta local e VITE privilegiada herdada sem valor em stdout), além dos três testes unitários de matriz/alvo/evidência. Os dois comandos check-release (staging e production) retornam exit 1 e:

```json
{"syntheticStagingReady": false, "productionReady": false, "realBuyerDataAllowed": false, "localEvidenceComplete": true}
```

Não há evidência remota cadastrada nem autorização. Gate remoto é BLOCKED; testes remotos são NOT RUN. As tarifas públicas foram pesquisadas; quotas de conta UNKNOWN.

### Demo e tempos observados

Manifesto privado: `apps/promoven-connect-web/pilot-results/pc07c1.json`; organização sintética `d05bfaa5-599f-4309-821a-fb7a407c09c1`, slug `pc07a-1792808330189`. Nome reaproveita “Incorporadora Sintética PC07A”, mantendo a base do roteiro existente; o manifesto identifica inequivocamente a fixture completa PC07C1. Preparação HTTP/RPC completa observada: **1.66 s**. Não são tempos de trabalho humano.

| Operação do seed transacional | Tempo local |
| --- | ---: |
| Provisionar organização via RPC | 5 ms |
| Criar empreendimento 1 | 4 ms |
| Prévia e confirmação de 25 unidades no projeto 1 | 29 ms |
| Criar empreendimento 2 | 2 ms |
| Prévia e confirmação de 25 unidades no projeto 2 | 19 ms |
| Preparar cinco identidades sintéticas e dez autorizações | 36 ms |
| Captar dez interesses atribuídos | 31 ms |
| Registrar acompanhamentos e propostas | 60 ms |
| Consultar analytics | 10 ms |

Normalizar/publicar/baixar cada mídia: **804 ms / 352 ms**. Download 200, checksum do arquivo normalizado corresponde, bytes diferem do original e EXIF/ICC ausentes. Contagens assertadas em analytics e onboarding; nenhum indicador comercial inventado.

### Artefatos locais (ignorados, sem enviar ao Git)

- `infra/promoven-connect/staging/.local/evidence-index.json`: onze relatórios e hashes de logs, vinculados às fontes; preflight.json, gate-staging.json, gate-production.json e preflight-negative-evidence.json.
- Cada grupo tem `.json` e `.log` no mesmo diretório. migrations.log identifica a baseline/contagens; webBuild.log contém os seis hashes SHA-256 reproduzidos; proxyHttp/mailHttp têm resultados HTTP sem tokens/contatos.
- `infra/promoven-connect/ops/artifacts/connect-recovery-1792808384/`: result.txt, http-result.json, rls-tests.log, checksums e arquivos privados de recuperação. **Dumps/keyrings não são entregáveis públicos.**
- **52 screenshots** em `apps/promoven-connect-web/test-results/visuals/`; assert de ausência de overflow nas três larguras. Inspeção visual amostral feita nas imagens abaixo, sem corte lateral/controles sobrepostos observados:
  - [Onboarding 390 px](../apps/promoven-connect-web/test-results/visuals/onboarding-390.png)
  - [Comparação 768 px](../apps/promoven-connect-web/test-results/visuals/catalog-compare-768.png)
  - [Analytics 1440 px](../apps/promoven-connect-web/test-results/visuals/crm-analytics-1440.png)

Git final: **9 arquivos rastreados modificados + 14 arquivos novos não rastreados**, todos deste checkpoint e no escopo Connect/documentação. HEAD não mudou. `git diff --check` PASS. Não foi feita auditoria de todo o histórico Git ou dos demais produtos; scanner de segredos/bundle cobre o escopo de release Connect atual. Logs/artefatos de teste e dumps continuam ignorados.

## Cobertura dos vinte fluxos

| Fluxo pedido | Evidência local |
| --- | --- |
| 1 Login; 2 seleção de organização | auth.spec.ts e todos os fluxos autenticados |
| 3 Onboarding | onboarding.spec.ts, progresso completo, erro 503/retry, teclado e escopo de gerente |
| 4 Empreendimento; 5 CSV preview/confirmação; 6 publicação | projects.spec.ts + seed RPC transacional; SQL testa conflito/atomicidade |
| 7 Upload de mídia | media.spec.ts e staging-demo.mjs: Edge real, normalização, publicação, URL curta, download Storage |
| 8 Convite outbox; 9 Mailpit; 10 ativação corretor | brokers.spec.ts + mail-worker/real-integration.mjs |
| 11 Catálogo; 12 favoritos; 13 comparação | brokers.spec.ts com preço/visibilidade/isolamento |
| 14 Link atribuível; 15 consulta pública; 16 lead | brokers.spec.ts; proxy real prova captura persistida/idempotência entre instâncias |
| 17 Pipeline CRM; 18 analytics | brokers.spec.ts + demo; status proposal é estágio, não venda ou proposta contratual |
| 19 Revogação | brokers.spec.ts e SQL/RLS de acesso/revogados |
| 20 Backup e restore | recovery-local.sh com Auth/Storage/Mailpit HTTP e reaplicação de supressões |

Tempos são automação local observada, não produtividade humana nem resultado comercial. A fixture cria cinco identidades/aprovações diretamente no banco local, depois usa RPCs de domínio. Convite e ativação por UI/Mailpit são comprovados separadamente no E2E. Contagens da demo são por organizationId do manifesto; outras fixtures de regressão permanecem preservadas.

## HTTP real e segurança

Rotas reais no proxy localhost:56410/56411: public-interest (202/captura persistida), broker-invite (202/outbox), broker-link (201), asset-media (201 upload/200 URL e download). Auth/REST/Storage no Connect localhost:56321. Nenhum backend sintético foi usado como substituto dessas provas.

| Verificação | Resultado HTTP/local |
| --- | --- |
| Requisição pública assinada / headers externos falsificados removidos | 202 / 202 |
| Bypass pelo Kong | 403 |
| Bypass pela rede frontal para IP Edge | network_blocked; Edge apenas rede interna, zero portas publicadas |
| Sem HMAC / header de verificação forjado / assinatura inválida | 403 |
| Corpo, método e caminho alterados | 403 |
| Timestamp expirado/futuro | 403 |
| CORS inválido / OPTIONS válido | 403 / 204 |
| 40 concorrentes em duas réplicas | 30 aceitas, 10 com 429 |
| Reinício de proxy | limite preservado, ambas 429 |
| Backend indisponível / retomada | 502 / 202 |
| Limiter indisponível / retomada | 503 / 202 |
| Captura repetida entre réplicas | 202/202, uma linha persistida |
| Logs | nenhum segredo/canário do ensaio; allowlist |

Outbox: 16 verificações reais incluindo falha temporária/permanente, retry, expiração/cancelamento, leases/fencing, SMTP aceito com confirmação perdida, DB indisponível, crash real, duas instâncias, replay de webhook interno e logs. Contrato de webhook interno não comprova fornecedor externo.

## Ocorrências durante a validação

Correções no harness: import de Sharp passou a usar resolução pública pelo package.json do worker; upload real confirmou 201 (o primeiro assert esperava 200); ESLint precisava globals Node para scripts .mjs. Essas falhas eram nos novos verificadores, não foram mascaradas como PASS.

O onboarding da demo com mídia apresenta oito etapas completas; o teste antigo esperava sete. A suíte também expôs uma corrida no teste de revogação: recarregava a página pública antes do commit da RPC. Agora aguarda resposta bem-sucedida e estado Revogado. Um timeout isolado ao abrir /login no teste de mídia não se reproduziu no teste isolado (PASS em 5,7 s); não foi atribuída causa sem evidência. O resultado final da suíte completa é registrado abaixo. Não foram adicionados retries que escondam falhas.

Uma execução foi invalidada pelo próprio runner porque fontes de configuração mudaram durante o ensaio (hash diferente), embora o ensaio SQL tivesse passado. Foi reiniciada após congelar os arquivos; nenhum resultado antigo foi remarcado manualmente com digest novo.

## Limitações e gates remotos

**BLOCKED:** escolha/conta/recursos/hosts/custos autorizados; modo staging-synthetic (código continua local-only); TLS e peer confiável no proxy (atual HTTP); CSP/CORS no host final; acesso fechado também às APIs/links; cofre/rotação/JWT renovável; backup offsite/journal resistente a rollback; monitoramento/restore remotos; aprovação explícita. **NOT RUN:** qualquer teste ou implantação remota, capacidade/latência/custo de tráfego remoto, SMTP externo e DNS.

Produção adiciona políticas/base legal/retenção/identificação/direitos, anonimização integral de cópias externas, SMTP Auth/comercial e callbacks reais, tratamento de backups, suporte/incidentes/autorização comercial. Esses itens não são artificialmente exigidos para demo exclusivamente sintética. Matriz e duas etapas de aprovação em [STAGING_APPROVAL](PROMOVEN_CONNECT_STAGING_APPROVAL.md).

Preflight/gate são controles locais auditáveis, não assinatura criptográfica de autorização humana nem CI protegido já implantado. A referência de aprovação futura precisa ser conferida com a mensagem original do usuário. A base limpa das migrações reaproveita schema de plataforma instalado (Postgres 17.11.0.004); não comprova bootstrap remoto de GoTrue/Storage em outra versão. Reaplicar arquivos DDL diretamente não é idempotente: o journal compara checksum e pula arquivos já aplicados. Rotação HMAC atual exige manutenção; sem nonce global de replay. RPO/RTO remotos continuam metas não medidas.

## Git, rollback e próximo checkpoint

Entrada: branch master, HEAD dd82c3ccd3c43b6997768e760a5f0dade41453f5, árvore limpa. Saída: mesmo HEAD, mudanças locais apenas nos scripts/testes/documentação Connect listados; nenhum commit. Nenhuma migração da aplicação foi adicionada/aplicada à origem. O ensaio só aplica migrações em contêineres descartáveis nominados connect-migration-check-*. Fixture demo adiciona dados sintéticos isolados e conserva fixtures existentes.

Rollback PC07C1: revisar/remover apenas os arquivos/hunks deste checkpoint; não executar reset/clean global. Scripts não mudam infraestrutura remota. Preservar ledger/keyring/backup e fixtures até decisão explícita de descarte. Rollback futuro: fechar ingresso/parar escritores/dispatch, artifacts compatíveis, compensação de schema revisada, restore em cópia com supressões atuais e reconciliação mail; não restaurar PII suprimida ou reabrir bypass. Landing/Escobar não participam.

PC07C2 está **não autorizado**. O [checklist de preparação e abertura](PROMOVEN_CONNECT_STAGING_APPROVAL.md) discrimina escolha de arquitetura/conta/orçamento, adaptação do modo remoto seguro, ingress/TLS, quotas, recursos, teste externo de bypass, backup/alerta remoto, aprovação da demo e encerramento. Não executar recursos para obter prova antes da autorização de provisionamento.
