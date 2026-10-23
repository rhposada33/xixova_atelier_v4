# Promoven Connect — checkpoint PC-05

Data: 23/10/2026. Estado: **PC-05A e PC-05B implementados e validados apenas no Supabase Connect local, com dados sintéticos**. Não houve deploy, DNS, migração remota, commit ou push. Landing Promoven, Escobar, Supabase de leads comerciais e pipelines Blender permanecem intactos.

## PC-05A: mídia Connect

- Bucket `connect-media-private` privado, dedicado ao projeto Connect local. Upload via Edge Function `asset-media`, que verifica JWT, permissão administrativa na organização, tipo, assinatura e estrutura PNG/JPEG/WebP, tamanho máximo de 5 MB, ausência de metadados JPEG/EXIF e cota configurável em `connect_media_limits`. Reserva SQL, upload Storage e confirmação vinculam checksum SHA-256, tamanho, mídia, projeto e unidade. Upload direto pelo cliente é negado. Arquivos pendentes não aparecem no catálogo.
- `project_assets` registra papel (`cover`, `gallery`, `floor_plan`), estado, tamanho, checksum, versão e publicação. Publicar, retirar publicação, substituir e excluir são operações explícitas com controle otimista e auditoria. Exclusão gera tombstone. A entrega usa URL assinada de **60 segundos**, após nova autorização. O manifesto não expõe `storage_path`.
- Acesso público exige projeto e organização ativos, asset pronto e publicado, flag pública `images` ou `floorPlans` e, para mídia de unidade, unidade disponível e publicada. Administradores podem pré visualizar mídia privada; corretores só obtêm mídia pronta e publicada com autorização vigente. O catálogo 2D preserva placeholder quando não há mídia.
- Cards e detalhes privados exibem mídia autorizada. A página pública usa apenas manifesto e URL curta dos assets publicados.

## PC-05B: links e captação

- `broker_links` guarda hash SHA-256 do token opaco gerado com 256 bits de entropia no servidor, organização/projeto/unidade, corretor e autorização de origem, versão, estado e validade. O servidor deriva `broker_user_id` do JWT; o navegador não informa esse ID. A URL é devolvida somente na criação e omitida da listagem administrativa. O corretor pode criar links de projeto ou unidade, copiar, abrir compartilhamento WhatsApp, listar estado e revogar. Perda de autorização invalida links ativos por trigger e por revalidação na leitura/submissão.
- `/s/:shareToken`, `/p/:publicSlug` e `/p/:publicSlug/u/:unitCode` funcionam sem login. Mostram projeção pública de projeto e unidades publicadas, preço apenas com visibilidade pública, mídia publicada e identificação profissional limitada a nome/CRECI. `Referrer-Policy: no-referrer` cobre a aplicação; o link WhatsApp é ação explícita. A rota pública usa chunk separado do portal autenticado.
- `public-interest` aceita nome, contato, mensagem opcional, unidade, consentimento com aviso versionado e chave de idempotência. Aplica validação de forma/tamanho, honeypot e contador horário com chave HMAC. Devolve apenas `receiptId`. A RPC transacional revalida publicação, unidade, organização, link e autorização, cria `leads`, atribuição histórica imutável em `lead_attributions`, atividade inicial, auditoria e registro de idempotência. Reenvio idêntico devolve o mesmo recibo; payload divergente com a mesma chave gera conflito. Ordem de bloqueio é autorização → link, compatível com suspensão concorrente.
- `/connect/leads` mostra leads da organização a gerente/administrador; `/connect/broker/leads` mostra apenas os atribuídos ao corretor com acesso atual. Não há edição de atribuição, comissões, reserva ou funil CRM.

## Arquivos e migrações locais

| Área | Arquivos |
| --- | --- |
| Banco | `infra/promoven-connect/supabase/migrations/20261023080000_connect_media.sql`, `20261023081000_media_service_columns.sql`, `20261023082000_broker_media_publication.sql`, `20261023090000_links_leads.sql`, `20261023091000_link_lock_and_public_media.sql`, `20261023092000_public_media_visibility.sql`, `20261023093000_public_catalog_active_org.sql` |
| Edge | `infra/promoven-connect/supabase/functions/asset-media/index.ts`, `broker-link/index.ts`, `public-interest/index.ts` |
| Contratos | `packages/connect-contracts/src/media.ts`, `share.ts`, exportações em `index.ts` |
| Web | `src/mediaApi.ts`, `shareApi.ts`, `PrivateApp.tsx`, `pages/Media.tsx`, `PublicCatalog.tsx`, `ShareLinks.tsx`; integração em `main.tsx`, `Portal.tsx`, `Projects.tsx`, `BrokerCatalog.tsx`, `style.css` |
| Testes | `supabase/tests/database/media.test.sql`, `links_leads.test.sql`; `apps/promoven-connect-web/tests/media.spec.ts`, `brokers.spec.ts`, `link-concurrency.mjs` |

As sete migrações foram aplicadas **somente** no banco Connect local (`supabase_db_promoven_connect_local`). As funções Edge PC-05 foram servidas localmente. Nenhuma tabela ou chave é compartilhada com Escobar ou com o banco de leads da landing.

## Segurança e resultados

| Verificação | Resultado |
| --- | --- |
| SQL/RLS | **229 asserções** pgTAP passaram: 164 anteriores, 24 de mídia e 41 de links/leads. Incluem acesso entre tenants, Storage direto negado, asset privado, corretor revogado, unidade não publicada, preço público oculto, token inválido/expirado/revogado, suspensão de organização e corretor, leitura alheia e idempotência. |
| Corrida real de banco | `node tests/link-concurrency.mjs`: duas conexões; suspensão bloqueia submissão, que termina `P0002`, sem lead ou deadlock. |
| Contratos | Typecheck e **13** testes passaram. |
| Web | Build TypeScript/Vite, lint e **2** testes unitários passaram. |
| E2E | **6** testes passaram: PC-01 a PC-04, convite Mailpit, mídia Storage, link de unidade e projeto, catálogo público anônimo, interesse, lead visível ao administrador e corretor, revogação. |
| Bundle | Busca nos arquivos de produção sem `escobar`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY` ou Three.js. O chunk `PublicCatalog` não contém rotas ou RPCs administrativas. |
| Layout | Catálogo público, links e leads inspecionados em **390, 768 e 1440 px**, sem rolagem horizontal indevida. |

Capturas locais ignoradas pelo Git: [catálogo público 390](../apps/promoven-connect-web/test-results/visuals/public-share-390.png), [768](../apps/promoven-connect-web/test-results/visuals/public-share-768.png), [1440](../apps/promoven-connect-web/test-results/visuals/public-share-1440.png), [links 390](../apps/promoven-connect-web/test-results/visuals/broker-links-390.png), [leads 390](../apps/promoven-connect-web/test-results/visuals/admin-leads-390.png). As telas de links e leads também têm capturas nas outras duas larguras.

## Privacidade, retenção e limites

Este fluxo está liberado **apenas para dados sintéticos locais**. Antes de aceitar dados reais, o responsável pelo produto e privacidade deve aprovar aviso de privacidade, base legal, prazo de retenção, pedidos de exclusão/acesso, destinatários do contato, política de compartilhamento com corretor e rotina de limpeza/backup. A versão `2026-10-23` identifica o aviso técnico do formulário, não substitui a aprovação jurídica. Não há exclusão automática de leads neste checkpoint. PII não entra em URL, analytics ou recibo. O painel limita a consulta a 100 registros recentes por chamada; paginação e gestão de ciclo de vida ficam para PC-06.

O rate limit local é 30 tentativas por hora por chave HMAC de origem. Em produção, o IP deve vir exclusivamente de proxy confiável; cabeçalhos enviados pelo visitante não podem ser tratados como verdade. A proteção usa honeypot e idempotência, sem CAPTCHA. URLs assinadas já emitidas podem continuar válidas até 60 segundos após revogação; nenhuma nova URL será emitida. A validação de formato verifica estrutura e assinatura de PNG/JPEG/WebP, mas não reencoda a imagem nem faz varredura antivírus; estabelecer processamento de mídia e observabilidade antes de uso remoto. O token `/s` ainda permanece na URL durante a navegação da página; `no-referrer` impede envio automático a terceiros. Uma sessão pública sem token visível pode ser considerada no endurecimento para produção.

## Contrato 3D opcional

Sem visor 3D, Three.js, Blender ou GLB neste checkpoint. Um manifesto futuro por projeto deve carregar `{ projectId, assetId, format, version, visibility, checksum, authorizedUrl }`. `authorizedUrl` será efêmera e emitida somente após autorização revalidada; `storage_path` e chaves privadas não entram na resposta. O catálogo 2D permanece funcional quando o manifesto está ausente. A interface e o carregamento sob demanda estão detalhados no plano de integração.

## Estado do Git e rollback

Os caminhos PC-05 listados acima estão modificados ou não rastreados no checkout; alterações anteriores foram preservadas. Nenhum commit, push ou publicação foi feito. Capturas, `.env.functions.local` e `.env.e2e.local` são locais/ignorados.

Rollback local: parar `broker-link`, `public-interest` e `asset-media`; retirar rotas PC-05 da aplicação; bloquear novas submissões antes de qualquer reversão de banco. Fazer backup do Connect local; preservar leads, atribuições e auditoria para avaliação de retenção. Uma migração compensatória revisada deve remover primeiro permissões/RPCs PC-05, depois triggers, tabelas e colunas de mídia conforme dependências. Apagar o bucket somente após decidir destino dos assets. Não executar `db reset`, não tocar dados PC-01 a PC-04 e não restaurar Escobar ou leads comerciais. Não há deploy remoto a reverter.

## Pendências PC-06

Funil e atividades comerciais, paginação de leads, gestão de retenção após política aprovada, observabilidade e controles operacionais de produção pertencem a checkpoint separado. Nenhum trabalho PC-06 foi iniciado.
