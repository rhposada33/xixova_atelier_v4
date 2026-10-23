# Promoven Connect — PC-07B.1

23/10/2026. Hardening local implementado e ensaiado; **não liberado para staging remoto ou compradores reais**. PC-07B.2 não iniciado. Sem commit, push, deploy, link Supabase, DNS ou criação Cloud. Alterações PC-07A modificadas/não rastreadas foram preservadas. Contexto PC-00–07A e planos anteriores mantidos; não se repetiu auditoria integral dos sistemas isolados.

## Controles implementados

- Wrapper comum nas quatro Edge Functions: leitura de corpo com teto em streaming (inclusive sem Content-Length), limite 8.192 bytes nas operações JSON e 5.300.000 no multipart; erros inesperados retornam resposta genérica. Upload continua limitado a 5 MiB efetivos.
- Request ID gerado pelo servidor, duração/status e serviço fixo em JSON. Não registra URL, corpo, cabeçalhos, destinatários, exceção ou token. Respostas no-store, nosniff e no-referrer. Falhas SMTP/Storage aparecem como status de serviço, sem PII. Importações SQL continuam auditadas pelos eventos existentes; não foi criado coletor de métricas externo.
- Contrato de origem autenticada por HMAC SHA-256 com timestamp, identidade do cliente, método, caminho e hash do corpo. Janela de 60 s; assinatura alterada/expirada recusada. Segredo de proxy independente do segredo do rate limit. Headers de IP fornecidos pelo cliente não determinam rate key; header interno é removido antes de reconstruir a requisição.
- Ambiente local usa bucket compartilhado de rate limit 30/h. Remoto exige assinatura mas continua bloqueado pela trava de delivery local existente. Proxy confiável ainda não provisionado; exige remoção de headers externos, limites na borda e teste de bypass. Assinatura sozinha não elimina replay dentro da janela; idempotência permanece obrigatória.
- JWT continua validado por `auth.getUser()` antes das operações privadas; RLS/grants e autorizações anteriores preservados. Campos não textuais no formulário público são recusados com 422.

## Mídia

Validador extraído em `_shared/media.mjs`. PNG passa a exigir CRC dos chunks; WebP exige dimensões reais VP8/VP8L/VP8X, máximo 8.000 por eixo/20 milhões de pixels, e recusa animação/metadados. PNG/JPEG preservam limites e rejeição de metadados; MIME/assinatura e estrutura são verificados. Quotas PC-05 continuam transacionais por projeto (200 assets/200 MiB), bucket privado e publicação explícita; URLs assinadas de 60 s preservadas.

**Limite:** não foi instalado decodificador/reencodificador de imagem. A Edge local não possui pipeline de normalização completo verificado; os parsers não demonstram validade integral do fluxo comprimido. EXIF é recusado, não reencodificado/removido de arquivos aceitos. Não há antivírus. A liberação remota deve exigir worker/decoder confiável com memória/CPU limitadas, saída normalizada, checksum e testes de imagens adversariais. Não confundir validação estrutural com sanitização integral. Documentos privados e assets Escobar/Blender não foram alterados.

## Privacidade e retenção

Migração `20261023120000_operational_privacy.sql` adiciona tabela privada/RLS de solicitações e RPC `connect_privacy`. Administrador do tenant abre protocolo opaco; outro administrador aprova ou marca hold; export só ocorre aprovado e gera auditoria sem payload. Contém lead, atividades e atribuição para revisão/entrega controlada. Identidade do solicitante e obrigação aplicável devem ser verificadas no processo restrito de suporte, não inferidas da RPC.

Ações de eliminação falham fechado (`55000`), pois histórico imutável pode conter PII e backups precisam tratamento coordenado. **Anonimização completa não implementada.** Não se desativaram triggers nem apagaram dados reais/sintéticos. `ops/retention-review.sql` oferece revisão somente leitura, parametrizada por idade de criação (30–3650 dias), organização e offset, usando a RPC CRM existente. Não é regra jurídica aprovada nem job automático; o operador deve avaliar última atividade, obrigações e hold antes de qualquer decisão. Configuração durável e execução de retenção ficam pendentes.

## Backup e restauração

`ops/recovery-local.sh` fixa fonte DB/Storage Connect; gera dump PostgreSQL, roles sem senhas, arquivo de objetos, inventário e SHA-256 em diretório privado ignorado. Cria contêiner descartável exclusivo, sem rede/portas/volumes compartilhados, restaura DB e arquivos, compara hashes/contagens e executa os nove arquivos pgTAP no restaurado. Remove apenas o contêiner criado pelo script. Nenhum restore em banco existente.

Último ensaio: **8 segundos**, artefatos `infra/promoven-connect/ops/artifacts/connect-recovery-1792753679/`; hashes equivalentes, contagens equivalentes, SQL sem `not ok`. Amostra local, sem garantia de RTO remoto. Ensaio anterior simples mediu 5 s. Falhas iniciais de restauração de atributos/grantor de roles e search_path pgTAP foram corrigidas para o bootstrap descartável; não alteraram roles da origem. Sem senhas de roles, recuperação de credenciais deve ser feita separadamente.

Consistência DB/Storage exige pausa de escritores antes do backup operacional; cópia sequencial não é snapshot distribuído. O teste verifica arquivos/banco, não uma stack Auth/Storage HTTP restaurada. Criptografia/exportação externa, RPO, recuperação de segredos e procedimento de desastre completo permanecem pendentes.

## Configuração preparada

- `apps/promoven-connect-web/vercel.json`: build/output, headers e fallback SPA preservando assets.
- `infra/promoven-connect/staging/environment.example`: placeholders separados, delivery disabled, segredo exclusivo de proxy.
- Plano de deployment atualizado com contrato de proxy, health/alertas, privacidade, retenção e runbook.
- SMTP remoto, DNS, redirects e provedor permanecem planejamento. Estimativas de custo PC-07A mantidas, sem contratação; reconfirmar antes de autorizar serviços. Ainda são necessários SMTP, proxy, processamento de imagens, armazenamento seguro de backup e monitoramento.

Nenhuma dependência de runtime foi adicionada. A tentativa `npx supabase` encontrou pacote CLI sem binário compatível; foi utilizado CLI 2.118.0 já instalado para os testes. Migração aplicada com psql no contêiner Connect identificado e registrada no ledger local, sem execução remota. Deno standalone indisponível; funções exercitadas no Edge runtime local e helpers puros em Node. Não declarar typecheck Deno independente aprovado.

## Resultados

| Verificação | Evidência |
| --- | --- |
| SQL/RLS | **278** asserções, incluindo 8 novas de privacidade; todos os arquivos também executados no banco restaurado. |
| Helpers operacionais | **4** testes Node: corpo excedido, proxy válido/alterado/expirado/spoofing, logs/headers seguros, mídia forjada. |
| Contratos / web unitários | **15 / 2** aprovados. |
| Build/TypeScript/lint | Aprovados para web e typecheck de contratos; `git diff --check` aprovado. |
| E2E | **7 aprovados em 46,6 s**, incluindo mídia privada/pública, publicação, convite/SMTP local, links, CRM, onboarding e Auth. |
| Concorrência | Scripts de link/CRM aprovados; revogação concorrente sem deadlock. |
| Responsividade | Checks E2E em 390/768/1440 e screenshots renovados em `apps/promoven-connect-web/test-results/visuals`; nenhuma mudança de UI neste checkpoint. |
| Bundle | Sem correspondência Escobar/service_role/SUPABASE_SERVICE_ROLE_KEY/three.js. |
| Restore | DB, objetos, hashes, contagens e SQL/RLS no contêiner descartável, 8 s. |

Logs sanitizados observados no runtime local durante o E2E. O próprio gateway ainda emite logs de roteamento/validação; sua política remota exige revisão. Não houve teste de carga, provedor remoto, leitor de tela ou validação completa de CSP.

## Arquivos e rollback

Mudanças PC-07B.1: quatro `functions/*/index.ts`, novos `_shared/{operations,media}.mjs`, migração/SQL de privacidade, `ops/{operations.test.mjs,recovery-local.sh,retention-review.sql,.gitignore}`, template staging, vercel.json, este relatório e deployment plan. Alterações PC-07A continuam intactas e sem commit.

Rollback: bloquear endpoints afetados, restaurar implementação local anterior compatível; não relaxar autenticação para recuperar serviço. Revogar execute da RPC de privacidade se necessário, preservando solicitações e auditoria; migração compensatória revisada após backup. Não apagar tabela/histórico nem fazer db reset. Retirar configuração de hosting não aplicada é reversível sem DNS. Backups contêm dados sensíveis mesmo sintéticos; manter acesso restrito e descarte deliberado, nunca Git.

## Encerramento do checkpoint

Melhorias locais e evidências entregues. Gates restantes explicitamente bloqueados: reencodificação/normalização de mídia, anonimização/retention executor com revisão jurídica, SMTP remoto, proxy implantado, observabilidade externa e restore HTTP completo. Não tratar estes itens como aprovados nem como autorização para PC-07B.2. Nenhum comprador real utilizado.
