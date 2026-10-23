# Matriz de staging (não implantado)

| Valor | Destino | Regra |
| --- | --- | --- |
| VITE_CONNECT_SUPABASE_URL / PUBLISHABLE_KEY | Web | Público; projeto Connect dedicado. |
| VITE_CONNECT_FUNCTIONS_URL | Web | Endereço público do proxy; sem segredo. |
| CONNECT_RATE_TOKEN | Proxy | JWT role connect_proxy, somente execução do limitador; local expira em 24 h. |
| CONNECT_RATE_URL / CONNECT_PROXY_UPSTREAM | Proxy | Endereços fixos privados; nunca entrada de cliente. |
| SUPABASE_SERVICE_ROLE_KEY | Edge | Somente servidor, segredo por ambiente. |
| CONNECT_PROXY_SECRET | Proxy / Edge | ≥32 bytes aleatórios, distinto de rate/worker. |
| CONNECT_LEAD_RATE_SECRET | Edge | HMAC de origem para quota persistida. |
| CONNECT_WORKER_SECRET | Edge / worker | ≥32 bytes aleatórios; worker sem portas públicas. |
| CONNECT_MEDIA_WORKER_URL | Edge | Origem interna fixa autorizada, nunca fornecida pelo usuário. |
| SMTP/API credentials | Adaptador futuro | Não configuradas, transporte remoto desabilitado. |
| JWT de recuperação | Stack descartável | Gerado por ensaio, nunca produção; destruído com contêineres. |

Rotação: instalar novo segredo no emissor/verificador em janela controlada; bloquear tráfego durante troca quando não houver versão dupla; testar rejeição da chave antiga. Não usar deploy de frontend para distribuir segredos. Logs de diagnóstico por código/requestId, sem valores. Nenhum envio externo foi configurado.

Auth: origem/redirects exatos do host staging dedicado, `/reset-password` e `/invite`; sem wildcard de previews de terceiros. Signup desabilitado. Configuração Supabase local vigente em `../supabase/config.toml`; migrations/bucket/grants exclusivos de Connect. Não copiar config da raiz do repositório.

SMTP: escolher provedor autenticado TLS/API, SPF/DKIM/DMARC e remetente Connect após autorização. Contrato de envio deve usar ID único de convite/versão, template pt-BR e estados pending/accepted/failed/unknown/bounced. Timeout ambíguo não permite retry cego; reconciliar ID antes de reenvio. Bounce deve ser assinado/verificado e sem payload pessoal nos logs. Transporte atual é apenas Mailpit local com deadline 8 s; outbox/retry/bounce remoto ainda não implementados.

Deploy: projeto Vercel separado, root apps/promoven-connect-web com acesso a packages/connect-contracts; npm ci/build, output dist. `vercel.json` contém headers e fallback. Nenhum comando de deploy faz parte dos gates locais. DNS connect.promoven.online fica pendente; www/landing, Escobar e leads B2B não mudam. Rollback restaura artefato Connect compatível e bloqueia endpoints problemáticos, sem reset de banco ou troca de DNS de outros produtos.

## Outbox PC-07B.3B

Edge recebe somente `CONNECT_MAIL_PUBLIC_KEY` (SPKI base64) e `CONNECT_MAIL_KEY_ID`. Worker recebe keyring `CONNECT_MAIL_PRIVATE_KEYS` (PKCS8 base64), JWT restrito `CONNECT_MAIL_WORKER_TOKEN` (24 h local), e `CONNECT_AUTH_SERVICE_KEY` privilegiada para gerar links de identidade. Esse último segredo permanece servidor: a role de banco dedicada não substitui a credencial administrativa exigida pelo Auth.

Envelope RSA-OAEP SHA-256 + AES-256-GCM; AAD vincula mensagem/template. Rotação: instalar keyring antigo+novo no worker, trocar chave pública/kid da Edge e preservar chaves antigas enquanto houver filas/backups a recuperar. Backup de chaves em cofre separado do dump; perda da chave torna payload irrecuperável. Não regenerar chaves para tentar abrir um backup antigo. Arquivos locais 0600 em diretório 0700 são somente mecanismo de desenvolvimento, sem alegação de KMS de produção.

Mailpit fica em rede privada. Worker local recusa destinatários fora de `@test.local`/`@example.invalid`. SMTP de Auth continua configurado separadamente. Nenhum provedor remoto/webhook foi ativado. `mail-worker/webhook.mjs` valida HMAC/timestamp/corpo antes de RPC com deduplicação persistente; não existe listener público. Mensagem SMTP aceita não comprova entrega à caixa do destinatário.

## PC07B3C — supressões locais

O worker de privacidade não aceita deployment remoto nem agenda automática. Role `connect_privacy_worker` sem login/sem JWT público, RPCs restritas; operador local usa Storage administrativo apenas no servidor. `privacy-worker/.local/ledger` não entra no snapshot DB nem no bundle: manter journal, head e recibos atuais separados dos backups restauráveis. `ledger.key` serve à correspondência de contato (réplica SQL privada); `ledger.anchor.key` autentica head/recibos e **nunca** é copiada ao DB. Ambas 0600, diretório 0700. Ausência/corrupção bloqueia execução/restore. Não regenerar, destruir ou trocar essas chaves sem migração revisada. Proteção WORM/antirollback do host, custódia remota e retenção ainda não aprovadas. Ver `docs/PROMOVEN_CONNECT_PRIVACY_RUNBOOK.md`.
