# Promoven Connect — plano de infraestrutura e operação

PC-07A, 23/10/2026. **Plano não executado.** Nenhum recurso remoto, deploy, DNS ou vínculo Supabase foi criado. PC-07B depende de autorização explícita e dos bloqueios abaixo.

## Topologia e recursos mínimos propostos

| Recurso | Preparação para piloto autorizado |
| --- | --- |
| Frontend | Projeto de hospedagem exclusivo Connect; SPA Vite, HTTPS, fallback de rotas. Acesso ao monorepo para dependência `packages/connect-contracts`; `npm ci`/build no app; saída `apps/promoven-connect-web/dist`. Não apontar build para maquette_web. |
| Supabase | Projeto dedicado Connect para staging sintético; produção futura em projeto distinto. Postgres, Auth, bucket privado e quatro Edge Functions (`broker-invite`, `asset-media`, `broker-link`, `public-interest`). Sem banco/sessão/Storage Escobar ou leads B2B. |
| Capacidade inicial | Hipótese de planejamento: 1 incorporadora, 2 projetos, 50 unidades, 5 corretores; sem 3D. 100 imagens de 2 MB ≈ 200 MB; tráfego depende de acessos, não apenas volume armazenado. Medir antes de aumentar capacidade. |
| E-mail | SMTP transacional próprio para Auth; transporte autenticado/TLS ou API do provedor para convites comerciais. Verificar domínio remetente, SPF/DKIM/DMARC, entrega, expiração, reenvio, bounce e cotas. Mailpit não é transporte remoto. |
| Rede | `connect.promoven.online` no provedor separado; manter `www` intacto. Staging com host fixo separado e acesso restrito; nunca wildcard de previews no Auth. |
| Operação | Responsáveis por suporte, banco, privacidade e incidente nomeados antes de liberar clientes; MFA nas contas de provedores, acesso mínimo e segredos separados por ambiente. |

As Edge Functions atuais recusam execução fora de `CONNECT_DELIVERY_MODE=local`. Não basta trocar variáveis para publicar: PC-07B precisa implementar e validar o transporte remoto, CORS/redirects, proxy confiável do rate limit e processamento de mídia. Não simular `local` no ambiente remoto para contornar o bloqueio.

## Custos e limites

Referências consultadas em 23/10/2026; orçamento em USD, sem impostos, câmbio, excedentes ou promessa de preço fixo.

- Supabase Free: 500 MB de banco, 1 GB Storage, 5 GB egress; projetos podem pausar após uma semana inativos. Pro parte de US$25/mês, com primeiro projeto incluído, 8 GB de disco por projeto, 100 GB Storage, 250 GB egress e backups diários de sete dias. Projeto adicional parte de US$10/mês. Confirmar computação/cotas na contratação. [Preços Supabase](https://supabase.com/pricing).
- Vercel Pro parte de US$20/mês e possui cobrança de uso/assentos; estimativa base de um operador, sem extras. [Preços Vercel](https://vercel.com/pricing). Hobby é voltado a uso pessoal não comercial; não o adotar como base de operação comercial. [Limites Hobby](https://vercel.com/docs/plans/hobby).
- Estimativa base: US$45/mês (um Supabase + um assento/hospedagem Pro), ou a partir de US$55 com um projeto Supabase adicional. Acrescentar SMTP, backup de objetos, monitoramento, domínio e excedentes, ainda sem fornecedor contratado. Reservar orçamento e alertas em 50/80/100% da cota escolhida.
- SMTP padrão Supabase é restrito, sem SLA e limitado atualmente a duas mensagens/hora; não sustenta o piloto comercial. [SMTP oficial](https://supabase.com/docs/guides/auth/auth-smtp).

Free serve a avaliação sintética, sem assumir backups/PITR, log drains ou SLA pagos. Não há benchmark de carga, concorrência massiva ou custo medido remotamente neste checkpoint.

## Variáveis e segredos

| Camada | Variáveis |
| --- | --- |
| Web pública | `VITE_CONNECT_ENV`, `VITE_CONNECT_SUPABASE_URL`, `VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY`. URL/chave pública somente do ambiente Connect correspondente. |
| Edge injetadas pelo runtime | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; nunca prefixo VITE, navegador, Git ou logs. |
| Edge Connect | `CONNECT_APP_ORIGIN`, `CONNECT_PUBLIC_SUPABASE_URL`, `CONNECT_DELIVERY_MODE`, `CONNECT_LEAD_RATE_SECRET` (aleatório, ≥32 caracteres). |
| Transporte local existente | `CONNECT_SMTP_HOST`, `CONNECT_SMTP_PORT`. Transporte de produção ainda precisa contrato próprio de credenciais e TLS/API. |
| Testes locais | `.env.e2e.local`, `.env.functions.local`, `.env.local` ignorados; somente identidades sintéticas. |

Frontend não recebe segredo de rate limit, SMTP nem service role. Landing e Escobar mantêm ambientes atuais. Rotacionar credenciais por ambiente; não copiar `.env.local` para produção. Cadastro público continua bloqueado; provisionamento inicial deve usar operador autorizado.

## DNS, Auth e publicação futura

1. Revisar orçamento, políticas, responsáveis e autorização PC-07B. Registrar identificadores explícitos dos recursos Connect antes de qualquer ação.
2. Criar staging isolado e testar schema integral/migrações em banco vazio e atualização de snapshot sintético. Executar pgTAP, contratos, E2E e concorrência. Não importar dumps Escobar.
3. Configurar HTTPS e DNS **somente** do subdomínio Connect, conforme valor fornecido pelo host. Não inventar IP/CNAME. Registrar zona/TTL anterior e plano de reversão. `www` permanece inalterado.
4. Auth: site URL do host do ambiente, redirects exatos `/reset-password` e `/accept-invitation`; verificar links de convite, PKCE, retorno interno, expiração e recuperação. Não autorizar hosts de terceiros ou todas as previews. Não transportar sessão entre domínios.
5. Fallback SPA para `/login`, `/forgot-password`, `/reset-password`, `/accept-invitation`, `/connect/*`, `/p/*`, `/s/*`; assets inexistentes não devem virar HTML. Cabeçalhos `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, política CSP testada com os endpoints Connect e fontes atuais, cache privado/no-store para conteúdo sensível.
6. Smoke test sem login e com admin/gerente/corretor/outro tenant. Verificar preço oculto, URL assinada, revogação, 409, captura idempotente, SMTP e logs sanitizados. Só depois propor entrada na landing em deploy próprio.

## Logs, monitoramento e rate limit

Registrar ID de requisição, rota normalizada, status, duração e código de erro, sem nome, telefone, e-mail, mensagem, Authorization, token de convite/share ou URL assinada. Redigir `/s/:token` no proxy e ferramentas de erro; impedir captura de payloads. Analytics do CRM usa agregados autorizados; não instalar rastreadores de comprador por padrão.

Alertar falhas Auth/SMTP, 5xx, saturação DB, Storage, conflitos anormais, rejeições 429, backlog e falha de backup. Metas iniciais propostas: aviso se 5xx >1% em 5 minutos e entrega de e-mail falhar repetidamente; calibrar com tráfego real autorizado. Medidas não estão implantadas.

Limite atual: 30 tentativas/hora por HMAC da origem, mais honeypot e idempotência. Antes do remoto, definir proxy que remova cabeçalhos fornecidos pelo cliente e injete origem confiável; testar spoofing e rotação da chave. Implementar expurgo autorizado das tabelas de rate/idempotência conforme prazo aprovado. Mídia exige pipeline de reencode/remoção de metadados e avaliação de varredura, preservando checksum e autorização.

## Privacidade e atendimento operacional — proposta para aprovação

A incorporadora deve definir finalidade/base legal e sua posição como controladora; Promoven e fornecedores devem ter responsabilidades contratuais verificadas. O papel do corretor, destinatários e limites de uso do contato dependem do acordo comercial. Esta descrição não é declaração de conformidade jurídica.

| Dados | Prazo técnico proposto, ainda não aprovado | Responsável/ação |
| --- | --- | --- |
| Leads sem atividade/encerrados | Revisão após 180 dias; exclusão/anonimização em prazo decidido pelo controlador, considerando obrigações e litígios | Responsável da incorporadora aprova; operador executa procedimento revisado. |
| Auditoria e atribuição | Proposta de 12 meses, sujeita à necessidade e base legal; minimizar contatos livres | Privacidade aprova exceções e descarte. |
| Logs operacionais sanitizados | Proposta 30 dias; logs de provedor podem ter limite menor | Operação define exportação/custo e expurgo. |
| Rate keys/idempotência | Proposta 48 h para rate e 7 dias para retries; avaliar efeito na garantia contra duplicidade | Engenharia implementa apenas após decisão. |
| Backups | Janela proposta 7–30 dias conforme serviço; dados excluídos não devem retornar à operação após restore | Operação mantém registro mínimo de exclusões a reaplicar. |

Nenhum job de retenção foi implementado. Não coletar compradores reais até aprovar aviso, base legal, versão, canal de contato e prazos. O aviso técnico `2026-10-23` não equivale à aprovação. Corretores só recebem leads no escopo autorizado; revogar acesso não apaga atribuição histórica.

Pedidos de acesso/correção/exclusão: suporte abre protocolo sem PII desnecessária; verifica identidade por canal aprovado; controlador decide alcance e prazo legal aplicável; operador exporta apenas dados do titular e relações autorizadas, por canal seguro com expiração; revisão por segunda pessoa; registra conclusão com identificador e tipo de ação, não cópia do contato. Exclusão demanda avaliar retenção obrigatória, backups e relações; triggers de histórico imutável não devem ser desligadas ad hoc. Projetar procedimento privilegiado específico, auditado e testado em staging antes de dados reais. Não existe botão de exclusão de titular neste checkpoint.

## Backup, restauração e incidente

Backup de banco não inclui os objetos do Storage; planejar cópia criptografada dos arquivos e manifesto/checksums separadamente. [Documentação de backups](https://supabase.com/docs/guides/platform/backups). Guardar configurações, migrações e referências de segredos sem expor valores. Restringir acesso e testar restauração em ambiente isolado. Meta proposta RPO 24 h/RTO 4 h, **não validada**. O ensaio deve restaurar DB + assets, verificar RLS/Auth, reaplicar exclusões e invalidar sessões/links quando necessário.

Incidente: operador interrompe captação/escritas afetadas, preserva evidência sanitizada, revoga acesso/segredo comprometido, identifica tenants e intervalo, aciona responsável de privacidade para avaliar comunicações e prazos legais. Restaurar snapshot isolado, corrigir causa e repetir testes negativos antes de reabrir. Manter registro de decisão e post-mortem; nunca restaurar outro produto para corrigir Connect.

## Rollback

Guardar deploy anterior imutável e backup Connect antes de migração. Migrações aditivas primeiro, UI depois. Erro de UI: reativar build anterior compatível. Erro de schema/dados: bloquear escritas, preferir migração compensatória revisada; restauração requer avaliação de perda desde backup e validação em ambiente isolado. Retirar somente CTA Connect da landing se necessário, sem desfazer seu conteúdo. DNS: restaurar apenas registro Connect anterior e aguardar TTL, sem confiar nisso como revogação de acesso. Não usar `db reset` em dados preservados.

No PC-07A local, basta retirar rota/CTA de onboarding e revogar execução das duas RPCs novas se necessário; manter organizações, membros adicionados e auditoria. Não executar rollback destrutivo automático da migração. Não há deploy remoto a reverter.

## PC-07B.1 — configuração local preparada

Implementados wrapper de Edge, logs por allowlist, limite de corpo em streaming e contrato de proxy HMAC. O proxy futuro deve remover `x-connect-*` recebido do cliente e assinar `timestamp\nclient\nmethod\npathname\nsha256(body)` com segredo exclusivo, usando timestamp em milissegundos (janela 60 s). A assinatura é verificada no servidor; `x-real-ip`/`x-forwarded-for` não determinam mais a chave de rate limit. Sem assinatura válida, o modo remoto falha fechado; a trava `local_only` permanece, portanto não há autorização de deployment. Em local, o bucket de rate limit é compartilhado (30/h), sem confiar em IP forjado. O gateway remoto deverá também limitar conexões/corpos antes da Edge e impedir acesso direto que contorne sua política.

Templates: `infra/promoven-connect/staging/environment.example` e `apps/promoven-connect-web/vercel.json`. Vercel deve permitir dependência fora da raiz do app (`packages/connect-contracts`). Não foi executado deploy/CLI Vercel. Staging continua com delivery disabled. Validar matcher de fallback no provedor e adicionar CSP com fontes/endpoints exatos antes de liberar. Auth usa rotas reais: `/reset-password` e `/invite/**` local; reduzir o wildcard a rotas necessárias no host remoto dedicado. Nenhum redirect de Escobar deve ser autorizado.

Health: usar GET do frontend estático e sondagem autenticada sintética de leitura, além de sucesso SMTP e Storage. Logs `edge.request` contêm somente serviço fixo, requestId gerado, status e duração. Agregar 5xx/429 e latência por serviço; alerta futuro >1% 5xx/5 min, falhas repetidas de e-mail/upload, backup vencido. Logs de gateway/provedor continuam exigindo redação de URLs `/s/*`, cabeçalhos e bodies. Não usar exports de privacidade como eventos analíticos.

Runbook local de recuperação: suspender escritores Connect antes da cópia consistente; executar `infra/promoven-connect/ops/recovery-local.sh`. Script fixa origem Connect, cria contêiner novo sem rede/portas/volumes existentes, restaura e remove somente esse contêiner. Backups privados (umask 077) em `ops/artifacts`, ignorados; não enviar ao Git ou provedores. Cópia DB e Storage não é snapshot distribuído: sem pausa de uploads/escritas há risco de divergência. Não usar diretamente para backup de produção. Credenciais de roles não são copiadas; restauração de login real requer gestão separada de segredos. Banco é integral, Storage inclui inventário e hashes; ensaio não restaura um serviço Auth/Storage completo via HTTP.

Privacidade: `connect_privacy(leadId, action, ticket)` exige administrador do tenant; ações request → approved/hold por outro administrador → export. Ticket é identificador opaco (sem contato/nome). O suporte verifica identidade fora da RPC e documenta base legal no sistema restrito de solicitações. Export contém contato e histórico: entregar por canal seguro, nunca logs ou analytics. Registro/auditoria não inclui conteúdo exportado. Hold documenta preservação pendente no ticket externo. Exclusão/anonimização falha fechado: falta procedimento jurídico/técnico que trate PII em atividades imutáveis e backups; não remover somente o contato e alegar exclusão completa. Revisão de retenção parametrizável em `ops/retention-review.sql`, somente leitura, com contexto Auth de admin; nenhum agendamento ou exclusão automática. Não executar a consulta como service role para usuários finais.

Custos continuam estimativas PC-07A (base US$45/mês e adicionais), sem contratação ou nova medição remota. Acrescentar escolha de proxy e processamento de imagens, armazenamento/criptografia de backups e observabilidade. Reconfirmar preços na autorização da contratação. Reencodificação/antivírus de mídia, SMTP remoto, política de eliminação e restore HTTP completo permanecem gates antes de dados reais.
