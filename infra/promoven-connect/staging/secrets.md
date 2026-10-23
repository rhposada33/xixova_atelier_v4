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
