# Promoven Connect — prontidão de release

Atualizado em 2026-10-23, checkpoint PC-07B.3C. Referência: [relatório técnico](PROMOVEN_CONNECT_PC07B3C_STATUS.md).

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

Antes de solicitar uma release futura: escolher fornecedor/ambiente Connect isolado; configurar TLS e credenciais de servidor; testar recibos/bounces, falhas e logs reais com endereços de teste autorizados; decidir rotação/backup de chaves e renovação de JWTs; aprovar privacidade/retenção e concluir os gates jurídicos/técnicos pendentes. SMTP Auth e SMTP comercial precisam validações separadas. Não copiar sessões, dados ou chaves de Escobar.

A existência desta lista não autoriza criar recursos, contratar, alterar DNS, migrar remotamente ou publicar. O rollback operacional está no [plano de deployment](PROMOVEN_CONNECT_DEPLOYMENT_PLAN.md) e no relatório do checkpoint.

## Evidência PC-07B.3C

341 assertions SQL/RLS, 8 E2E (52,3 s), Storage HTTP e restore `connect-recovery-1792796169` passaram. Journal externo confirmado é reaplicado antes de considerar uma cópia utilizável. Conteúdo livre e histórico cobertos foram removidos; auditoria/ledger continuam pseudonimizados. Isso não comprova eliminação de cópias baixadas, mensagens entregues ou assets sem vínculo a comprador. Ver [runbook](PROMOVEN_CONNECT_PRIVACY_RUNBOOK.md).
