# PC-07B.1.1 — normalização e privacidade

Estado: **parcial; gate integral não aprovado**. Implementação local, dados sintéticos, sem ações remotas. Base da execução: `a42e5879e91ce617db9d5c910562429d93d2badf` (`master`, limpo). Mudanças anteriores já estavam registradas nessa base; nenhum commit desta execução.

## Mídia implementada

Worker separado em `infra/promoven-connect/worker`, Sharp 0.35.5/libvips, lockfile e base Docker fixada por digest. Biblioteca consolidada necessária para decodificação real; não é adicionada ao dashboard ou Edge. Input PNG/JPEG/WebP é identificado pelo decoder e comparado ao MIME, decodificado integralmente, orientação aplicada e reencodificado PNG sem preservar EXIF/ICC/XMP. Apenas saída aprovada vai ao Storage; checksum e tamanho são da saída. Normalizador indisponível bloqueia upload, sem fallback ao original.

Referências de implementação: [constructor/limites Sharp](https://sharp.pixelplumbing.com/api-constructor/) e [opções de saída/metadados](https://sharp.pixelplumbing.com/api-output/). Não usar `keepMetadata`/`withMetadata` no caminho de produção; tais métodos aparecem apenas nos geradores de teste.

Limites: 5 MiB input/output; 8.000 por eixo; 20 milhões de pixels; uma página; um job simultâneo; libvips uma thread/cache desabilitado; decoder timeout 3 s e subprocesso morto em 5 s. Contêiner local sem porta publicada, read-only, sem capabilities, no-new-privileges, 384 MiB RAM, 1 CPU, 64 PIDs. Subprocesso V8 128 MiB; cgroup limita também memória nativa. Sem arquivos temporários de imagem; comunicação stdin/stdout e memória. Secret exclusivo de worker, validado no servidor.

Edge `asset-media` autentica usuário e chama worker; reserva/upload/finalização existentes preservados. Migração `20261023130000_normalized_media.sql` aceita saída compacta menor que 1 KiB e adiciona quota de organização de 1 GiB com lock antes do lock de projeto. Quotas anteriores 200 assets/200 MiB por projeto e publicação explícita continuam. Worker não recebe chaves Supabase, sessão de usuário ou tabelas Escobar.

Reprodução: `python3 infra/promoven-connect/ops/start-media-local.py` prepara segredo ignorado e contêiner dedicado; se já existe não reinicia automaticamente. Servir Edge Connect com caminho absoluto de `.env.functions.local`. `worker/compose.yaml` é alternativa local (não iniciar simultaneamente com o contêiner manual). Segredo deve coincidir nas duas pontas. Worker mantido intencionalmente ativo para não quebrar os uploads Connect; não é processo de teste órfão.

### Matriz de testes de mídia

| Item | Resultado/evidência |
| --- | --- |
| PNG/JPEG/WebP | 3 testes geram imagens, decodificam saída PNG e verificam orientação e ausência de EXIF. |
| MIME falso, truncamento, corrupção, erro de decoder | Rejeitados nos testes unitários/HTTP. |
| Dimensões e decompression bomb | 8.001 px e 25 milhões de pixels rejeitados. |
| Hash/output efetivamente diferente | Teste HTTP e E2E com checksum original diferente do persistido. |
| Input entre tenants/publicação/revogação | Regressão SQL existente e E2E privado/público preservada. |
| Concorrência worker | Duas requisições simultâneas: uma normalizada, outra 429. |
| Temporários | Caminho sem escrita e contêiner read-only; subprocesso encerrado. Não é varredura forense de memória. |
| Falha de escrita Storage | Quatro testes injetam falha no adaptador usado pela Edge: upload, finalização, exceção e limpeza. Verificam remoção/tombstone e estado cleanup_pending. Não equivalem a derrubar o provedor real. |
| Corrida de quota entre organizações/projetos | Teste com duas conexões confirmou espera no lock e recusa da segunda reserva após a primeira atingir a quota de organização. Fixtures sintéticas criadas/removidas pelo teste; corridas link/CRM também passaram. |

Cinco testes worker passaram. Teste E2E de mídia passou em 2,7 s na verificação final com hash da normalização; não atribuir todos os 16 cenários solicitados a cinco testes sem essa distinção.

## Mapa de dados pessoais e bloqueio de anonimização

| Local | Dados/referências | Consequência |
| --- | --- | --- |
| leads | Nome, contato, mensagem, próxima ação, motivo; IDs de projeto/unidade, receipt, datas | Substituir contato não rompe vínculos indiretos. |
| lead_activities/CRM | `detail` livre, autor, data, lead_id | Observações podem repetir contato/nome; histórico é imutável. |
| lead_attributions | Corretor, link, autorização e data vinculados ao lead | Preservar IDs mantém capacidade de associação com fontes externas. |
| auditoria | Actor/subject/detail, contexto e datas | Reidentificação possível por eventos, mesmo sem contato direto. |
| Storage | Imagens de projeto/unidade; conteúdo visual pode ter PII | Retirar EXIF não remove nomes visíveis dentro da imagem. Não há vínculo comprador→arquivo para exclusão garantida. |
| exportações | Cópias de contato/histórico entregues a suporte | Exigem destino, expiração e evidência de descarte externo. |
| logs | Novo padrão por allowlist; gateway/SMTP externos ainda dependem da operação | Não presumir todos os logs antigos sanitizados. |
| backups | Snapshots anteriores com todos os vínculos | Não apagar backups existentes; reaplicação de supressões requer ledger externo aprovado. |

Implementados `connect_privacy_preview(uuid)` e guard de hold (`20261023131000`, `20261023132000`): admin do tenant recebe versão, campos, contagens, referências indiretas e `executionEnabled=false`, sem expor conteúdo pessoal. O wrapper bloqueia aprovação/exportação enquanto qualquer pedido do lead estiver em hold; caminho interno sem execute para authenticated. Lock de lead serializa decisões. Aprovação independente e auditoria anteriores preservadas.

**Anonimização efetiva não implementada nem declarada aprovada.** Não foi criado bypass de triggers. O modelo atual não permite demonstrar eliminação dos vínculos de comprador em arquivos/observações externas preservando indiscriminadamente IDs, datas e atribuição. Isso exige uma decisão de minimização/agregação e um ledger de supressões independente dos backups. Redação parcial seria pseudonimização, não satisfação desse gate. Operação erase permanece recusada; nenhum teste destrutivo foi feito em dados existentes.

Plano seguro posterior: aprovar campos/relacionamentos a preservar, separar conteúdo pessoal de eventos comerciais, criar função de papel técnico restrito com plano/version/hash aprovado, validar concorrência/idempotência em fixtures descartáveis; persistir ledger mínimo de supressões fora do snapshot restaurado e reaplicá-lo antes de abrir Auth/Storage. Holds devem ser reavaliados e impedir o executor; não inventar prazo jurídico. Exportações anteriores e conteúdo visual exigem procedimento próprio. Não abrir restore com dados reais antes desse gate.

## Gates e rollback

285 asserções SQL/RLS passaram (7 novas de preview/caminho interno/hold); 15 contratos, 2 unitários web, build/lint/typecheck aprovados. 7 cenários E2E validados após reexecução dirigida de convites/mídia; uma tentativa iniciou durante reinicialização Edge e falhou no envio, corrigida. Corridas link/CRM passaram. Bundle sem Escobar/service_role/Three.js. Evidências de layout PC-07A renovadas pelos E2E 390/768/1440, sem mudança visual neste checkpoint.

Rollback de mídia: bloquear uploads, manter assets normalizados existentes; não reabilitar publicação de originais como fallback. Revogar RPC preview/wrapper somente com revisão das decisões pendentes. Não resetar banco, apagar backups nem modificar outros produtos.

Prosseguiu-se apenas com tarefas independentes de PC-07B.1.2/PC-07B.2, conforme autorização. Falhas/pendências acima impedem aprovação integral do PC-07B.1.1 e liberação de dados reais.
