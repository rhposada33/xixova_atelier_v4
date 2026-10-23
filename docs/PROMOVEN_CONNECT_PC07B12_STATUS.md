# PC-07B.1.2 — operação local

Estado: preparação parcial com testes locais; **gate integral bloqueado** por integração final de proxy/SMTP e pendências PC-07B.1.1. Nenhum serviço remoto provisionado.

## Proxy

`infra/promoven-connect/proxy/proxy.mjs` implementa proxy HTTP Node sem dependência externa, backend por Unix socket em diretório privado. Identidade vem de socket.remoteAddress; headers internos/forwarding do cliente são descartados por allowlist. HMAC vincula corpo, método, caminho, origem confiável e timestamp; CORS exige origem exata; limite de corpo, headers/timeouts, rate limit por endereço, ID de requisição e log somente de campos fixos.

Teste HTTP real local passou: header/IP forjado não controla identidade, requisição válida, cliente sem Authorization recebe 401 do backend, excesso de corpo 413, rate limit 429, CORS incorreto 403, replay com mesma chave resulta duplicidade reconhecida pelo backend, tokens não entram em logs. O backend de ensaio só escuta Unix socket (nenhuma porta TCP de bypass). Testes de HMAC existentes cobrem assinatura/corpo alterados e timestamp vencido. Quatro testes de helpers e um teste HTTP aprovados.

**Limites:** backend do teste é contrato autenticado sintético, não o Supabase Connect. Falta adaptador de socket/rede interna para Edge e isolamento do endpoint real; API local 56321 permanece conforme configuração anterior. Rate limit no proxy é memória de uma réplica e perde estado ao reiniciar; rate persistido SQL continua na captação, mas integração completa ainda exige teste. Não alegar limite distribuído nem proteção de bypass no host remoto. Rate/Idempotência reais da captação são cobertos pela regressão PC-05. Injeção específica de falha de backend e replay por múltiplas réplicas pendentes.

## Recuperação HTTP

`ops/recovery-local.sh` chama `ops/recovery-http.py` após restore de DB/objetos, hashes/contagens e pgTAP. O runner conecta **somente o contêiner descartável criado pelo ensaio** a rede Docker interna nova, sem portas publicadas; inicia Auth/Storage (e Mailpit na versão ampliada), ajusta credenciais de roles na cópia e usa probe Node dentro dessa rede. Fonte é somente Connect local. JWT/credenciais do ensaio são sintéticos; não há conexão a Cloud. SMTP não pode sair da rede interna.

Evidência já obtida antes da extensão final: `ops/artifacts/connect-recovery-1792756075/http-result.json`: Auth health/login/user aprovados; leitura privada anônima negada; URL assinada entregou objeto restaurado; 13 s no ensaio completo e 4,5 s na fase HTTP. Ver o registro autônomo para resultado final de checksum HTTP/recuperação por Mailpit. Não houve restore em banco existente. Artefatos privados ignorados; backups anteriores preservados.

Tentativas rejeitadas: contagem de origem mudou enquanto E2E escrevia; separadas as execuções. Rede none não aceitava conexão adicional; removida apenas no contêiner descartável. Bootstrap Auth exigiu pg_hba na cópia; Storage exigiu banco auxiliar conforme versão 1.82.1. Correções ocorreram somente no ambiente temporário. Logs de falha persistem como códigos sanitizados; não há dump de envs/tokens.

Recuperação HTTP não equivale a recuperar deployment inteiro: frontend/Edge/proxy restaurados, rotação de sessões reais, SMTP remoto e replay de supressões continuam gates separados. Proposta RPO 24 h/RTO 4 h não é SLA; tempos acima são uma amostra local. Pausar escritores antes de backup DB+Storage; cópia sequencial não garante snapshot distribuído.

## SMTP/observabilidade

Mailpit continua único transporte de convites. Adicionado timeout 8 s que fecha conexão; template pt-BR preservado. Não houve e-mail real. Contrato preparado para provedor em `staging/secrets.md`: TLS/API autenticada, ID de convite/versão, estado ambíguo, reconciliar antes de retry, bounce assinado, DNS SPF/DKIM/DMARC futuro. Outbox/retry/bounce remoto **não implementados** e não aprovados.

Worker tem `/health`; Edge e proxy emitem requestId/status/duração por allowlist. `staging/alerts.json` define limites propostos, labels permitidas e transporte desabilitado. Não há envio a provedor externo nem agregador ativo. Falhas de SMTP/Storage/Auth seguem códigos de serviço; importações possuem auditoria SQL existente. Alertas e thresholds exigem calibragem autorizada.

## Operação e rollback

Incidente: bloquear endpoint afetado; registrar IDs/status/intervalo sem conteúdo; preservar backups; revogar segredo por ambiente; verificar tenant e escopo; corrigir em cópia; repetir testes negativos antes de reabrir. Privacidade decide comunicações aplicáveis, sem prazos legais inventados.

Rotação descrita na matriz de segredos. Para indisponibilidade, verificar primeiro worker health, conectividade interna, deadline, Auth e Storage, sem imprimir secrets. Rollback da aplicação preserva schema compatível; schema só por compensação revisada. Não usar db reset. Fixtures com prefixo próprio podem ser descartadas apenas por procedimento restrito ao ensaio; o runner remove só nomes gerados por ele e não apaga backups. Não executar prune global.

Testes de regressão/qualidade estão no relatório PC-07B.1.1 e registro autônomo. Nenhum commit/push/deploy. Continuação limitada à preparação independente de PC-07B.2.

## Evidência final ampliada

`ops/artifacts/connect-recovery-1792756487/http-result.json`: Auth health/login/user, Storage HTTP privado negado, objeto assinado entregue, checksum HTTP verificado e mensagem de recuperação recebida no Mailpit descartável — todos true. 13 s total / 4,62 s fase HTTP. Chave JWT própria, sem copiar chaves assimétricas da fonte. Credenciais/pg_hba alteradas somente no descartável. Não foi feita troca de senha pelo link na cópia. O runner executou também os nove arquivos SQL com 285 asserções e descartou Auth/Storage/Mailpit/probe/rede. Continua sem comprovar deployment frontend/Edge/proxy ou SMTP remoto restaurados.
