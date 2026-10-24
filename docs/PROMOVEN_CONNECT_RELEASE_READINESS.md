# Promoven Connect — prontidão de release

Atualizado em 2026-10-23, checkpoint **PC-07C.1**. Referência vigente: [relatório de preflight](PROMOVEN_CONNECT_PC07C1_STATUS.md). As evidências PC-07B.3C abaixo são histórico local.

## Decisão atual

**Operação local sintética validada. Release remoto e compradores reais bloqueados.** Nenhum deploy foi autorizado ou executado; PC-07B.3C validou execução técnica sintética; não aprovou anonimização integral.

| Capacidade | Estado |
| --- | --- |
| Outbox persistente transacional e cifrada | PASS local |
| Worker isolado, concorrência, retries e recuperação | PASS local |
| SMTP/Mailpit e convite ponta a ponta | PASS local |
| Restore de outbox + chave separada + envio na cópia | PASS local |
| Proxy integrado a Supabase, HMAC e rede privada | PASS local PC07B3A, regressão repetida |
| Auth/Storage por HTTP após restore | PASS local |
| Normalização e falhas de persistência de mídia | PASS local |
| SMTP transacional remoto | BLOCKED / NOT RUN — provedor não configurado |
| Webhook remoto de entrega/bounce | BLOCKED / NOT RUN — contrato local apenas |
| SMTP customizado do Auth remoto | NOT RUN — configuração independente |
| Gestão remota de chaves/segredos e backup offsite | NOT RUN |
| Tratamento de registros e recursos inventariados | PASS local, somente fixtures sintéticas |
| Reaplicação de supressões após restore | PASS local, ledger externo e Storage reais |
| Anonimização integral | BLOCKED — cópias sem vínculo/rastreabilidade e referências externas |
| Política de retenção aprovada | BLOCKED |
| Processo de identificação aprovado | BLOCKED |
| Operação de exclusão real autorizada | NÃO CONCEDIDA |
| Tratamento de backups aprovado | BLOCKED — custódia/retenção/antirollback remoto pendentes |
| Autorização de deploy / compradores reais | NÃO CONCEDIDA |

A fonte executável é `infra/promoven-connect/staging/readiness.json`; `node infra/promoven-connect/staging/check-release.mjs` deve sair com código 1 enquanto os bloqueios existirem. PASS local não deve tornar gates remotos verdadeiros.

## Evidências e condições futuras

O relatório PC07B3B registra testes, incidentes encontrados/corrigidos, artefatos de resiliência e restore. Mensagem aceita pelo SMTP não significa entregue ao destinatário. Não existe promessa de exatamente uma entrega externa.

Antes de uma release de **produção com dados reais**: escolher fornecedor/ambiente Connect isolado; configurar TLS e credenciais de servidor; testar recibos/bounces, falhas e logs reais com endereços de teste autorizados; decidir rotação/backup de chaves e renovação de JWTs; aprovar privacidade/retenção e concluir os gates jurídicos/técnicos pendentes. SMTP Auth e SMTP comercial precisam validações separadas. Não copiar sessões, dados ou chaves de Escobar.

A existência desta lista não autoriza criar recursos, contratar, alterar DNS, migrar remotamente ou publicar. O rollback operacional está no [plano de deployment](PROMOVEN_CONNECT_DEPLOYMENT_PLAN.md) e no relatório do checkpoint.

## Evidência PC-07B.3C

341 assertions SQL/RLS, 8 E2E (52,3 s), Storage HTTP e restore `connect-recovery-1792796169` passaram. Journal externo confirmado é reaplicado antes de considerar uma cópia utilizável. Conteúdo livre e histórico cobertos foram removidos; auditoria/ledger continuam pseudonimizados. Isso não comprova eliminação de cópias baixadas, mensagens entregues ou assets sem vínculo a comprador. Ver [runbook](PROMOVEN_CONNECT_PRIVACY_RUNBOOK.md).

## PC-07C.1 — matrizes separadas e gates executáveis

O modelo v2 em staging/readiness.json conserva booleans antigos apenas como histórico. `check-release.mjs` usa evidências verificadas (arquivo/hash, alvo, escopo, data de até 7 dias, digest atual), autorização explícita com HEAD/digest/alvo e referência revisável à mensagem do usuário. Índice local é gerado pelo validate.mjs em staging/.local/evidence-index.json e não é enviado ao Git. Não existe aprovação registrada; approvedTargets está vazio. Sem prova remota e sem aprovação, exit 1 é o resultado correto.

| Gate | Estado atual | Condição para liberação |
| --- | --- | --- |
| syntheticStagingReady | **false / BLOCKED** | Regressões locais atuais + Auth/acesso restrito remoto, somente fixtures, RLS, proxy privado/TLS, backups, monitoramento, captação restrita, bloqueio de e-mail externo, custos, CSP/CORS e aprovação específica staging |
| productionReady | **false / BLOCKED** | Base operacional remota no alvo produção + privacidade/base legal/retenção/direitos, SMTP/recibos, backups, suporte, incidentes, autorização comercial e aprovação específica produção |
| realBuyerDataAllowed | **false / BLOCKED** | productionReady e autorização explícita adicional de compradores reais |

Staging não herda os gates de SMTP externo/anonimização integral/privacidade comercial da produção. Produção não exige Mailpit nem bloqueio de toda captação real, mas exige seu próprio alvo e aprovação. Aprovação de provisionamento PC-07C.2 e aprovação de abertura da demo são etapas distintas; a primeira não torna os três gates verdadeiros. [Checklist e matriz completos](PROMOVEN_CONNECT_STAGING_APPROVAL.md).

### Bloqueios técnicos remotos específicos

1. Provedor/conta/região/hosts, quotas e orçamento não aprovados nem inspecionados em conta; preços públicos pesquisados.
2. Managed Supabase Network Restrictions não isola APIs HTTPS/Edge; topologia local de Kong não é transferível automaticamente. Recomendado runtime self-hosted; alternativa Cloud + API privada própria requer adaptação.
3. Proxy atual HTTP/socket peer: TLS direto ou protocolo de peer confiável precisa implementação/ensaio remoto. Não usar XFF fornecido por clientes.
4. Quatro Edge Functions/mail worker mantêm local-only; modo staging-synthetic, URLs internas/externas, SMTP sink e acesso fechado precisam implementação autorizada. Não contornar definindo local remotamente.
5. CSP exata e teste no host final, backup offsite/ledger resistente a rollback, monitoramento acionável, custódia/rotação de segredos e ensaio remoto continuam NOT RUN.

Não há FAIL funcional remoto observado, pois nenhum ambiente remoto foi acessado. BLOCKED/NOT RUN não equivale a PASS nem a falha já medida. Para dados reais, todos os bloqueios jurídicos/técnicos históricos permanecem.

### Regressão final PC-07C.1

Onze grupos PASS locais no mesmo digest: 34 migrações limpas/incrementais, 341 SQL/RLS por contexto (1.364 assertions em quatro contextos), 42 casos unitários/contratos, 8 E2E em 51,3 s, três concorrências, HTTP real do proxy, 16 verificações de outbox, demo completa e restore em 20 s (HTTP 6,70 s). Build idêntico após cinco instalações offline por lockfile; 52 screenshots nas três larguras. Preflight: 36 PASS + CSP remota BLOCKED; localEvidenceComplete=true. Os três gates de liberação permanecem false. Evidências e limitações no [relatório PC07C1](PROMOVEN_CONNECT_PC07C1_STATUS.md).
