# Registro da execução autônoma Connect

Data: 23/10/2026. Base `master`, commit `a42e5879e91ce617db9d5c910562429d93d2badf`; checkout limpo no início. Nenhum commit/push/merge/rebase nesta execução. Pedido recebido termina na seção 3.2 (“Headers”); não foram presumidas instruções além do arquivo. AGENTS e contexto PC-00–07B.1 revisados, implementação confirmada nos arquivos/contêineres; não se repetiu auditoria integral dos sistemas isolados.

## Estado final por checkpoint

| Checkpoint | Entrega | Estado |
| --- | --- | --- |
| PC-07B.1.1 | Worker Sharp integrado, limites, quota de organização, preview e guard de legal hold | **Parcial**: anonimização integral bloqueada. |
| PC-07B.1.2 | Proxy HTTP testável, restore HTTP Auth/Storage/Mailpit, observabilidade/configuração | **Parcial**: proxy ainda não integrado ao Supabase real; SMTP remoto/outbox/bounce não implementados. |
| PC-07B.2 | Templates, matriz de segredos, sequência de validação, gate de release | **Preparação local entregue; release bloqueado**. |

A continuação entre checkpoints ocorreu somente nas tarefas independentes, conforme exceção explícita do pedido. Não se declarou aprovação integral de gates incompletos.

## PC-07B.1.1

Arquivos: `infra/promoven-connect/worker/*`, Edge `asset-media/index.ts`, migrações `20261023130000_normalized_media.sql`, `20261023131000_privacy_preview.sql`, `20261023132000_privacy_hold_guard.sql`; teste SQL privacy, E2E media e `tests/media-quota-concurrency.mjs`; bootstrap `ops/start-media-local.py`.

Decisões: Sharp 0.35.5/libvips no servidor isolado (dependência justificada para decodificação integral), PNG como saída; checksum somente da saída, sem publicação de original/fallback; subprocesso com deadline e cgroup; quota organização com lock; preview sem PII e hold conservador. Não desativar trigger imutável nem chamar pseudonimização de anonimização.

Resultados: cinco testes worker passaram, cobrindo formatos/orientação/metadados, input inválido/excessivo, servidor autenticado, hash e concorrência. E2E mídia final 2,7 s com checksum distinto do original. Corrida SQL com duas conexões verificou espera no lock e rejeição da segunda reserva ao atingir quota. Fixtures desse teste removidas somente pelos IDs criados por ele. 285 asserções SQL/RLS passaram, incluindo preview/hold e bloqueio do caminho interno.

Riscos/bloqueios: anonimização integral exige redesenho de conteúdo pessoal vs eventos e plano de vínculos indiretos/backups/exportações/Storage; executor permanece desabilitado. Falhas de upload/finalização/transporte/limpeza foram injetadas em quatro testes do adaptador usado pela Edge; compensação validada e cleanup_pending explícito. Não foi derrubado o serviço Storage real. Nenhum comprador real, backup apagado ou operação de eliminação executada.

## PC-07B.1.2

Arquivos: `proxy/{proxy,proxy.test}.mjs`; `ops/recovery-http.py`, extensão de `recovery-local.sh`; deadline SMTP em `broker-invite/index.ts`; templates de alertas/segredos.

Resultados: quatro helpers operacionais e um teste HTTP de proxy passaram. Proxy usa Unix socket, assinatura HMAC, endereço de conexão, allowlist de headers, CORS exato, limites e logs sem URL/token. Backend é contrato sintético, não Edge real; rate local é uma réplica em memória, não quota distribuída.

### Recuperação final verificável

Artefatos privados/ignorados: `infra/promoven-connect/ops/artifacts/connect-recovery-1792756487/`.

- Dump/roles sem senhas, objetos e inventário; hashes do arquivo e dos objetos restaurados iguais.
- Contagens conferidas; nove arquivos SQL/RLS executados na cópia (285 asserções na versão final).
- Auth restaurado responde health, autentica usuário sintético e valida chamada `/user`.
- Storage restaurado nega leitura privada anônima; gera URL assinada; entrega bytes com SHA-256 correspondente ao metadata restaurado.
- Recuperação de acesso gera mensagem no Mailpit **novo e descartável**. Não houve envio externo. Não foi exercitada a troca de senha por esse link na cópia; troca/recuperação completa na stack local original segue coberta pelo E2E PC-01.
- Chave JWT nova por ensaio; chaves assimétricas da fonte removidas da configuração da cópia. Credenciais de roles alteradas somente no DB descartável. Rede interna sem portas publicadas; probe executado dentro dela.
- Tempo completo **13 s**; fase HTTP **4,62 s**. Amostra local, não RTO/SLA remoto. Propostas de RPO/RTO continuam sujeitas a ensaio operacional.
- Contêineres, probe e rede de recuperação removidos; backups existentes e novos preservados.

Correções com evidência: cópia durante E2E foi recusada por diferença de contagens; execução final sem escritores. Conexão de rede none, pg_hba e configuração auxiliar do Storage foram corrigidas somente na cópia. CLI antiga precisou caminho absoluto do env-file para servir Edge; convite executado durante reinicialização falhou, reexecução passou. Nenhuma falha ambiental foi rotulada como teste aprovado.

SMTP: template pt-BR/timeout local e contrato futuro preparados, Mailpit exercitado. TLS/API de provedor, outbox com reconciliação, retry/bounce e DNS de remetente continuam bloqueados/fora do ambiente local disponível. Não contratado fornecedor.

## PC-07B.2

Artefatos: `staging/{environment.example,secrets.md,alerts.json,readiness.json,check-release.mjs,validate-local.sh}`; configuração Vercel existente preservada; Dockerfile/compose worker. Blueprint com Connect separado de landing/Escobar/leads B2B. `validate-local.sh` faz restore somente depois dos escritores; componentes executados individualmente, não repetido runner inteiro sem alteração relevante.

`check-release.mjs` foi executado e retornou bloqueio (exit 1) como esperado. Gates falsos: anonimização integral, integração proxy↔Supabase, SMTP remoto, política aprovada. Autorização remota/dados reais permanece false. Não marcar manualmente true sem evidência e autorização.

## Regressões e qualidade

- SQL/RLS: **285** aprovadas.
- Contratos: **15** + typecheck aprovados.
- Unitários web: **2** aprovados.
- Worker: **5** aprovados.
- Helpers/proxy: **5** aprovados (4 + 1).
- E2E: seis passaram na suíte inicial; convites passou na reexecução depois do runtime pronto; verificação final de convites + mídia normalizada passou (2 testes em 36 s). Total de sete cenários cobertos, sem ocultar a falha inicial.
- Concorrência: links, CRM e quota de mídia aprovados.
- Build TypeScript/Vite e lint aprovados; nova mensagem do teste de quota ajustada ao lint Node do repo.
- Bundle sem Escobar/service_role/SUPABASE_SERVICE_ROLE_KEY/three.js; `git diff --check` aprovado.
- Checks responsivos 390/768/1440 e capturas renovados pelos E2E; nenhuma UI alterada. Não houve nova auditoria com leitor de tela.

## Operação deixada no ambiente

Worker `connect-media-worker-local` e Edge Connect mantidos ativos de propósito para suportar uploads normalizados. Nenhum processo de teste/contêiner de recuperação permaneceu. Segredos locais ignorados (worker e Edge), sem valores em relatórios. `node_modules`, capturas, relatórios e backups ignorados. Não reiniciado serviço de outra aplicação, não realizado prune, não modificado Escobar, landing, leads B2B, cenas ou Blender.

## Próximas decisões/gates

1. Modelo aprovado de anonimização com vínculos indiretos, ledger de supressões fora do snapshot e política para conteúdo livre/arquivos/exportações; executar somente fixtures descartáveis até aprovação jurídica.
2. Integrar proxy ao backend real em rede sem bypass e validar rate entre réplicas, falhas e reinício.
3. Ensaiar reconciliação operacional de cleanup_pending e outage do provedor antes de release.
4. Implementar outbox/reconciliação SMTP e bounce com provedor somente após autorização; nenhum e-mail real nesta execução.
5. Só então reavaliar release/staging remoto em autorização separada.

Relatórios: [PC-07B.1.1](PROMOVEN_CONNECT_PC07B11_STATUS.md), [PC-07B.1.2](PROMOVEN_CONNECT_PC07B12_STATUS.md), [PC-07B.2](PROMOVEN_CONNECT_PC07B2_STATUS.md). Limites e rollback por checkpoint estão nesses arquivos e no deployment plan. A preparação local não é uma liberação comercial.

## Complemento final de persistência

`_shared/media-persistence.mjs` é usado pela Edge após normalização/reserva. `ops/media-persistence.test.mjs`: quatro casos de falha aprovados (upload/finalize/throw/cleanup); remoção de objeto e tombstone solicitados, código seguro sem detalhes do provedor. Gate de injeção validado em teste de adaptador, sem afirmar teste de outage real. Artefatos sem PII.

Após extração da persistência, o E2E de upload real foi repetido: **1 passou, 3,1 s (5,0 s de execução)**. O verificador final retorna bloqueio apenas para anonimização integral, integração proxy/Supabase, SMTP remoto e política de privacidade. Não existe liberação de release nesta execução.
