# Promoven Connect — PC-07B.3B

Data: 2026-10-23. Escopo: e-mail comercial local, outbox persistente e recuperação. Não autoriza PC-07B.3C, staging, produção ou dados reais.

## Resultado

Outbox e SMTP **validados localmente**, com PostgreSQL, Edge Function `broker-invite`, dois workers e Mailpit reais. Provedor SMTP remoto **não configurado**; webhooks remotos **não validados**; aprovação de privacidade **pendente**. O aceite SMTP é explicitamente diferente da entrega na caixa do destinatário.

## Arquitetura implementada

```text
UI / JWT + Idempotency-Key
  → proxy PC07B3A (remove headers internos, HMAC, rate compartilhado)
  → broker-invite privado (HMAC + Auth.getUser + validação)
  → connect_queue_invitation (autorização + convite + outbox na mesma transação)
  → private.mail_outbox (RLS, payload cifrado)
  → dois workers privados (claim SKIP LOCKED + lease UUID)
  → Auth.admin.generateLink → payload cifrado atualizado → SMTP Mailpit
  → confirmação no banco / reconciliação por Message-ID
```

- `POST /functions/v1/broker-invite` pelo proxy local `127.0.0.1:56410` retorna **202**, com convite criado e entrega pendente. O 200 documentado no checkpoint anterior foi substituído intencionalmente pelo contrato assíncrono.
- A Edge valida o JWT com Auth, obtém o ator e chama RPC exclusiva de `service_role`. A RPC verifica novamente organização/projeto/permissão. O cliente não escolhe o ator, destinatário de reenvio ou token.
- `Idempotency-Key` UUID identifica a operação e a outbox; lock transacional serializa repetições. Reutilização com contexto diferente é rejeitada. Convite e intenção de envio persistem juntos ou sofrem rollback juntos.
- Reenvio autorizado rotaciona o token, cancela o convite anterior e sua mensagem pendente. Cancelamento/expiração são revalidados no claim e antes do despacho. Convite cancelado não admite reenvio.
- As antigas RPCs de criação/reenvio perderam EXECUTE para `authenticated`; não há caminho de cliente que crie convite novo sem outbox. Cancelamento e aceite mantêm seus contratos.
- Estado: `pending → processing → sent | retry | failed | cancelled`; lease vencido sem despacho pode ser retomado. Lease UUID impede confirmação por um dono antigo. Mensagem com marcador de despacho é reconciliada, nunca reenviada cegamente.
- Tentativas máximas configuráveis (padrão 5, intervalo 1–10), backoff exponencial com jitter, estados terminais e shutdown com interrupção de novos claims. Métricas agregadas por estado, retries e leases vencidos; logs somente evento, UUID e código fixo.
- `sent` significa **aceito pelo SMTP**. `provider_status` separado permite `delivered`/`bounced` por confirmação futura. Bounce prevalece sobre evento posterior de entrega.

### Criptografia e permissões

Payload persistente usa RSA-OAEP SHA-256 + AES-256-GCM, vinculado por AAD ao UUID da outbox e versão `broker-invite.pt-BR.v1`. Token e link Auth não ficam em texto puro na outbox. O destinatário vem da referência ao convite autorizado, não do payload cifrado. Hash do token é conferido após decifrar.

A Edge recebe apenas a chave pública. O keyring privado fica no worker, fora do Git, imagem e banco, em `.local/keys.json` (0600, diretório 0700). `worker.env` também 0600. O bootstrap recusa gerar nova chave quando o arquivo foi perdido e já existem mensagens no banco. Backups cifrados antigos também exigem preservar suas chaves; não foi configurado KMS externo.

`private.mail_outbox` e eventos de webhook têm RLS e sem leitura direta por anon, authenticated, service_role ou worker. O worker usa RPCs delimitadas com JWT de `connect_mail_worker`, sem SELECT em leads. **O processo também possui a chave administrativa Auth para gerar links de identidade**; essa credencial continua privilegiada e exige isolamento/rotação. Não é uma credencial de frontend nem argumento de RPC fornecido pelo usuário.

Administradores/gerentes autorizados consultam `connect_mail_status`, que retorna somente estado operacional, tentativas, datas e códigos; corretores e outro tenant são recusados. Auditoria não copia destinatário, token, link ou corpo da mensagem.

### Transporte e limites de confirmação

Adapter Nodemailer SMTP separado do worker; local aceita somente `@test.local`/`@example.invalid`. A interface remota exige autenticação e TLS verificado (mínimo TLS 1.2, STARTTLS obrigatório salvo conexão implicitamente TLS). O executável atual recusa modo remoto. Templates em pt-BR e Message-ID determinístico fornecem correlação.

Timeouts: conexão/greeting 2,5 s, DNS 2 s, socket ocioso 4 s, chamada HTTP/RPC 4 s, lease 30 s, parada Docker 20 s. Não há deadline absoluto para uma sessão SMTP que continue enviando bytes; o modo remoto permanece desabilitado. Erros conhecidos antes de envio ou rejeição temporária permitem retry; rejeição permanente encerra. Resultado ambíguo procura confirmação no Mailpit. Sem confirmação confiável, termina `failed/confirmation_unknown`, exigindo decisão e reenvio autorizado, ou conserva lease/marcador quando o serviço de reconciliação está indisponível.

**PostgreSQL não garante exatamente uma entrega externa.** Message-ID correlaciona e permite reconciliação; não obriga deduplicação pelo SMTP. Cancelar após o despacho externo não recolhe e-mail já aceito, mas invalida o token comercial. O adaptador futuro deve integrar recibo/idempotência do provedor quando disponíveis.

Contrato de webhook interno: HMAC sobre timestamp e corpo, janela de 60 s, comparação constante, corpo até 4 KiB, campos permitidos e event ID durável único. Só o worker executa a RPC; nenhum listener HTTP ou endpoint público privilegiado foi aberto. Testado localmente, sem fornecedor externo.

Fontes técnicas: [SMTP Nodemailer](https://nodemailer.com/smtp), [erros](https://nodemailer.com/errors), [pesquisa por Message-ID no Mailpit](https://mailpit.axllent.org/docs/usage/search-filters/), [API Mailpit](https://mailpit.axllent.org/docs/api-v1/).

## Auth, proxy e rede preservados

Auth continua responsável pelos seus próprios e-mails de recuperação/verificação. A outbox comercial chama `admin/generate_link` sem enviar automaticamente, preservando links/redirects do fluxo PC-03 e token comercial no fragmento. Login, recuperação, confirmação e aceite foram exercitados no E2E. SMTP customizado do Auth será uma configuração futura independente.

Workers `connect-mail-worker-local-1/2`: somente rede `connect_edge_private_local` (`Internal=true`), nenhuma porta publicada, usuário não-root, filesystem read-only, capabilities removidas, no-new-privileges, 192 MiB/0,5 CPU/64 PIDs. PostgREST/Auth/Mailpit são serviços locais existentes; nenhuma caixa externa foi usada. JWT do worker dura 24 h e é renovado pelo bootstrap local.

Edge continua privada, sem porta publicada, HMAC obrigatório; Kong recusa `/functions/v1/*`. Proxies 56410/56411 continuam únicos ingressos das funções. Auth/REST/Storage em 56321 e Mailpit local em 56324 foram preservados. Nenhuma mudança em Escobar, landing, leads comerciais externos ou Blender.

## Arquivos e migrações

| Área | Arquivos principais |
| --- | --- |
| Schema local | `supabase/migrations/20261023140000_mail_outbox.sql`, `20261023141000_mail_claim_scope.sql` |
| Edge/crypto | `supabase/functions/broker-invite/index.ts`, `_shared/mail-crypto.mjs` |
| Worker | `mail-worker/{main,worker,transport,webhook}.mjs`, Dockerfile e lockfile |
| Testes | `mail-worker/{worker.test,real-integration,restore-fixture,restore-probe}.mjs`, `supabase/tests/database/mail_outbox.test.sql` |
| Bootstrap | `ops/start-mail-local.py`, atualização de `ops/start-proxy-local.py` para recarregar configuração Edge alterada |
| Recuperação | `ops/recovery-local.sh`, `ops/recovery-http.py`, novo `ops/recovery-mail.py` |
| Web | `apps/promoven-connect-web/src/brokerApi.ts`, `src/pages/Brokers.tsx`, `tests/brokers.spec.ts` |
| Contratos | `packages/connect-contracts/src/broker.ts` |
| Preparação | `staging/{environment.example,secrets.md,readiness.json,validate-local.sh}` |

Caminhos de infraestrutura relativos a `infra/promoven-connect/`. As duas migrações foram aplicadas **somente localmente**. A segunda corrige uma ambiguidade de alias PL/pgSQL descoberta no primeiro envio real. O teste legado `brokers.test.sql` concede EXECUTE apenas dentro da sua transação para preservar 49 testes das regras antigas; o rollback remove essa concessão. O novo teste verifica explicitamente que os grants reais de produção estão revogados.

## Testes e evidências

| Gate | Resultado e evidência |
| --- | --- |
| SQL/RLS | **PASS**: 322 assertions, 11 arquivos; 25 novas para outbox. Também executados na cópia restaurada. |
| Contratos | **PASS**: 15 testes e typecheck. |
| Worker mail unitário | **PASS**: 5 testes, criptografia/AAD, alteração de destinatário, chaves ausentes, TLS/configuração, backoff, assinatura/timestamp/replay. |
| Helpers/proxy/persistência | **PASS**: 10 testes. |
| Worker de mídia | **PASS**: 5 testes. |
| Web unitário | **PASS**: 2 testes. |
| Mailpit + DB real | **PASS**: 16 cenários; `.local/resilience-evidence.json`, 22:31:22–22:31:29 UTC. |
| Concorrência de domínio | **PASS**: suspensão versus captação, suspensão versus CRM, reserva concorrente de quota de mídia. |
| Proxy real PC07B3A | **PASS**: integração HTTP, bypass/HMAC/CORS, 30 aceitos + 10 limitados entre instâncias, restart, backend 502/recovery e limiter 503/recovery. |
| Backup/restore | **PASS**: `ops/artifacts/connect-recovery-1792794633/`, 17 s total, fase HTTP 5,94 s. Auth, Storage e outbox decifrada/enviada na cópia. |
| E2E e visual | **PASS**: 7/7 (53,5 s), telas em 390/768/1440 px; detalhes no complemento final. |
| Build/lint | **PASS**: TypeScript + Vite, ESLint. |
| Credenciais/logs | **PASS**: valores privados atuais ausentes de fontes versionáveis/bundle e logs examinados; `.local/security-evidence.json`. Não constitui garantia de todos os provedores futuros. |
| SMTP remoto | **NOT RUN / BLOCKED**: fornecedor, credenciais, autorização e configuração ausentes. |
| Webhooks remotos | **NOT RUN / BLOCKED**: somente contrato local implementado. |
| Privacidade | **BLOCKED**: política/retenção/aprovação pendentes; sem compradores reais. |

Os 16 cenários reais cobrem normal, operação idempotente, SMTP temporário/retry, conexão recusada, limite de tentativas, expiração antes de retry, rejeição permanente, cancelamento, token expirado, lease/fencing, perda de resposta SMTP após aceitação real, falha de confirmação DB e indisponibilidade de reconciliação, SIGKILL após aceite SMTP, backlog com **dois processos Node distintos**, webhook com replay persistente e logs sem canários sensíveis. Falhas SMTP são introduzidas por relay TCP; a entrega final chega ao Mailpit real.

Recuperação cria uma mensagem sintética cifrada pendente antes do dump e pausa os mail workers. Na cópia descartável, preserva ciphertext, restaura banco/Storage, inicia Auth/PostgREST/Mailpit exclusivos e passa o keyring separadamente ao worker. Confirma claim, decifragem, link Auth da cópia e aceite SMTP. Cancela outras mensagens pendentes **somente na cópia**; ao terminar cancela a fixture da origem e retoma os workers. Configurações de URL do GoTrue eram absolutas e inicialmente apontavam à origem: o harness foi corrigido para redirects exclusivos da cópia. Tentativas iniciais falharam fechadas; o artefato final acima passou. Não é ensaio de KMS, backup offsite ou recuperação remota.

### Reproduzir localmente

Com Supabase Connect já iniciado e configurações locais ignoradas existentes:

```bash
python3 infra/promoven-connect/ops/start-mail-local.py
npm --prefix infra/promoven-connect/mail-worker test
node infra/promoven-connect/mail-worker/real-integration.mjs
node infra/promoven-connect/proxy/real-integration.mjs
# CONNECT_SUPABASE_CLI deve apontar para CLI instalada, sem instalação automática.
infra/promoven-connect/staging/validate-local.sh
```

O último comando termina com gate remoto **bloqueado de propósito**. Os testes reais usam apenas fixtures sintéticas; o harness de mail exige ausência de jobs pendentes alheios. Backups, chaves, env e screenshots ficam ignorados pelo Git e não devem ser publicados.

## Interface

Gestão de convites distingue criação, pendência, processamento, retry com data/tentativas, falha, cancelamento e “aceito pelo servidor” sem prometer entrega. Atualiza status a cada 2 s e mostra erro útil de consulta. Convites antigos não são reenviados automaticamente; exibem ausência de histórico na outbox. Identidade clara/verde e permissões administrativas preservadas.

Evidências responsivas e resultado E2E final: ver complemento de validação abaixo.

## Rollback e operação

1. Interromper novas criações/reenvios e parar **somente** `connect-mail-worker-local-1/2` com timeout 20 s. Preservar banco, logs sanitizados, keyring e env privados.
2. Se houver erro de UI, restaurar build compatível com API 202/outbox. Não reativar cliente antigo de SMTP síncrono enquanto houver mensagens pendentes.
3. Preferir correção de código/migração compensatória. Não remover a outbox, tokens, histórico ou chaves; não restaurar automaticamente EXECUTE das RPCs legadas.
4. Reconciliar mensagens com `dispatch_at` junto ao transporte antes de retomar envios. Não transformar estado ambíguo em retry manual nem reproduzir cegamente fila de backup.
5. Restaurar primeiro em ambiente descartável, usando DB, Storage e keyring correspondente; verificar Auth/RLS, tokens expirados/cancelados e recibos externos. Restore da origem requer decisão sobre perda de dados, separado deste ensaio.
6. Retomar bootstrap somente após corrigir a causa. Rotação de chaves exige instalar keyring antigo+novo nos workers antes de trocar a chave pública Edge; manter chaves antigas pelo prazo de backups. Não regenerar chaves para “corrigir” falhas de decifragem.

Nenhum rollback destrutivo foi executado. Não há deploy/DNS remoto para reverter.

## Limitações e próximo checkpoint

- Mailpit local validado não comprova entregabilidade, reputação, DNS de e-mail, SPF/DKIM/DMARC, bounce real ou SMTP remoto. Essas decisões aguardam provedor e autorização.
- Contrato de webhook ainda não possui endpoint exposto/provedor. Ativação exigirá transporte autenticado, gestão de segredo, redação de logs e testes do fornecedor.
- Credencial Auth administrativa e keyring local precisam gestão de segredos adequada antes de remoto. Renovar JWTs locais dentro de 24 h.
- Aprovação de privacidade, retenção de ciphertext/referências/auditoria e anonimização integral permanecem bloqueios. Não foi implementada a etapa PC-07B.3C.
- Congelar todos os escritores/ uploads continua necessário para backup consistente entre DB e Storage; pausar só mail workers não oferece snapshot distribuído de produção.
- Cancelamento em corrida com envio externo e exatamente uma entrega têm os limites descritos acima.

## Estado Git

Início: branch `master`, HEAD `8cfa7c39f59351c12bb6744f3aa5a8a11843e257`, árvore limpa. Alterações desta execução limitadas ao Connect e seus três documentos. Sem commit, push, deploy, DNS ou migração remota. Backups/credenciais/artefatos privados permanecem ignorados. O estado final é uma árvore modificada e arquivos novos prontos para revisão, sem staging Git automático.

## Complemento de validação final

- **E2E PASS**: **7/7**, duração **53,5 s**, suíte completa reexecutada após o ajuste de sincronização descrito abaixo. Convite real atravessa UI → proxy/HMAC → Edge → outbox → worker → Mailpit → Auth/aceite; cobre ainda catálogo, CRM, links, uploads, onboarding e publicação.
- **FAIL inicial corrigido**: o teste do CRM esperava um texto que também estava na textarea; avançava antes da atualização do histórico e perdia o preenchimento seguinte durante o reload. A espera foi restringida ao `article` do histórico persistido. Nenhuma regra do CRM foi relaxada.
- Uma execução intermediária também apresentou falha intermitente de import dinâmico do Vite dev na primeira navegação privada. A execução completa final repetiu a mesma asserção de proteção de rota, sem retry automático ou alteração do fluxo Auth. Essa instabilidade do servidor dev permanece observação do harness, não evidência de validação remota.
- **Visual PASS**: screenshots examinados nos três tamanhos: `apps/promoven-connect-web/test-results/visuals/brokers-390.png`, `brokers-768.png`, `brokers-1440.png`. Seletor de organização, formulários, ações e estados “Aceito pelo servidor de e-mail; recebimento não confirmado”/“Envio cancelado” legíveis. Assert de largura sem transbordamento passou. Somente contatos sintéticos.
- **Rede PASS**: `.local/network-evidence.json` confirma dois workers ativos, usuário `node`, filesystem read-only, sem portas publicadas, ligados exclusivamente à rede interna; Edge também exclusiva nessa rede.
- **Gate remoto BLOCKED esperado**: `check-release.mjs` retorna código 1 com `fullAnonymizationValidated`, `smtpRemoteDeliveryValidated`, `privacyPolicyApproved` e `mailWebhooksRemoteValidated` falsos; autorização de deployment e de dados reais continuam falsas.
- `git diff --check`, lint final e compilação Python dos scripts: **PASS**. Nenhum commit ou staging Git automático.
