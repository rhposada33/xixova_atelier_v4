# PC-07B.2 — preparação de staging

Estado: **preparação local entregue; release bloqueado**. Não houve staging remoto implantado, domínio, DNS, contratação ou deploy. A execução limita-se ao pedido recebido, que termina na seção 3.2 em “Headers”.

## Artefatos reproduzíveis

- `infra/promoven-connect/staging/environment.example`: ambientes separados, delivery desabilitado, endpoints internos, chaves por serviço.
- `staging/secrets.md`: matriz de segredos, redirects, SMTP, rotação e responsabilidade de cada camada.
- `apps/promoven-connect-web/vercel.json`: configuração Vite, headers e fallback já preparados; não testados no provedor remoto. Build local aprovado.
- `infra/promoven-connect/supabase/config.toml` e migrations: configuração exclusiva Connect, signup bloqueado, bucket privado e schema/RLS próprios. Nenhum arquivo Supabase Escobar reutilizado.
- `worker/Dockerfile`, lockfile, compose e bootstrap local: normalizador reproduzível e limitado, sem porta publicada.
- `proxy/proxy.mjs` e testes: contrato de proxy por Unix socket, ainda sem adaptação ao backend Supabase.
- `ops/recovery-local.sh` / `recovery-http.py`: restore DB/objetos/Auth/Storage e Mailpit em rede descartável.
- `staging/alerts.json`: thresholds propostos, notificações desabilitadas.
- `staging/readiness.json` / `check-release.mjs`: gates explícitos; exit 1 enquanto houver bloqueios ou ausência de autorização remota.
- `staging/validate-local.sh`: sequência SQL → helpers/worker → contratos/build/lint → E2E/concorrência → restore. Backup só inicia depois de terminar escritores de teste. Runner preparado; componentes foram executados durante esta execução, sem repetir toda a sequência desnecessariamente.

## Gates

Normalização integrada, Auth HTTP e Storage HTTP restaurados têm evidências locais. Continuam falsos: anonimização integral, integração de proxy com Supabase, SMTP remoto, política de privacidade e injeção específica de falha de escrita Storage. Verificador executado e recusou liberação conforme esperado. O arquivo não é autorização para marcar booleans manualmente sem evidência.

Não há prazo legal inventado, conformidade afirmada ou dados reais de compradores. Um build compilável e um restore sintético não liberam um piloto comercial. Testes/adaptações remotos exigem autorização separada.

## Arquitetura e operação

`www.promoven.online` permanece marketing/demonstração; `connect.promoven.online` é somente alvo futuro da app Connect. Auth, banco, RLS, Storage, SMTP e proxy exclusivos do Connect. Landing, Escobar, leads B2B e Blender não foram alterados. Não transportar sessões/chaves entre domínios/produtos.

Custos e provedores continuam propostas do deployment plan; nenhuma compra ou novo recurso externo. Antes de contratar, revisar valores atuais, cotas de SMTP/egress/Storage, processamento e retenção de backups. Gate local não depende de serviço pago.

Rollback: manter app anterior compatível, bloquear uploads/captação antes de substituir serviço, não publicar original quando worker falhar; preservar schema/auditoria/backups. Reverter somente configuração Connect. Não realizar rollback por reset de banco nem restauração de outro produto.

Estado do Git: mudanças desta execução sem commit/push; base limpa a42e587. Novos relatórios e arquivos constam no registro autônomo. Artefatos de teste, backups, node_modules e envs ignorados; worker/Edge locais mantidos para suportar a implementação. Contêineres/probes de recuperação são descartados pelo runner. Nenhum avanço remoto foi executado.
