# Promoven Connect — PC-06

Estado: **auditoria inicial em andamento; implementação não concluída**. Ambiente autorizado: Connect local, exclusivamente dados sintéticos. Este documento não declara aprovação dos critérios de aceite do PC-06.

## Estado verificado antes do desenvolvimento

- O checkout contém alterações e arquivos não rastreados do PC-05. Foram preservados.
- `leads` já preserva contato, projeto, unidade, origem, aviso de privacidade e recibo. O status está restrito a `new`; ainda não há versão otimista, próxima ação, responsável operacional ou encerramento.
- `lead_attributions` mantém o vínculo histórico com corretor, autorização e link. Não deve ser reutilizada para transferência operacional.
- `lead_activities` aceita somente o evento `received`. Ainda não oferece autoria humana, observações ou mudanças de estágio.
- `connect_leads` restringe leitura por gestor da organização ou corretor atribuído com autorização vigente, mas retorna até 100 registros sem paginação navegável ou filtros comerciais.
- `share.ts` tipa somente status `new`. A interface atual é um painel básico de consulta.
- Executado novamente `npx supabase test db` em `infra/promoven-connect`: **229 asserções passaram em seis arquivos**. Esse resultado confirma a base SQL PC-01 a PC-05, não valida funcionalidades PC-06.

## Alterações estritamente necessárias

1. Estender as tabelas existentes com versão, estágio comercial, última atividade, próxima ação, acompanhamento e encerramento; manter origem e atribuição histórica imutáveis.
2. Acrescentar histórico append-only com autor, instante, evento, motivo e valores anterior/novo. Preservar `received` para compatibilidade com a captação PC-05.
3. Centralizar autorização de leitura/escrita e bloqueios de autorização antes do lead, para serializar alterações com revogação. Conflitos de versão devem usar `PT409`.
4. Implementar RPCs paginadas de listagem/detalhe/histórico, mutações comerciais, acompanhamento e transferência explícita auditada. Rejeitar campos de tenant e atribuição em mutações genéricas.
5. Implementar agregações SQL com filtros autorizados e intervalo temporal explícito. Usar `America/Sao_Paulo` na apresentação e limites UTC na consulta. Lead ganho indica encerramento comercial registrado, sem provar venda ou alterar unidade.
6. Criar contratos/validadores compartilhados e telas de lista, detalhe, Kanban e analytics para gestores e corretores. Substituir a navegação móvel extensa por controle acessível.
7. Cobrir isolamento, revogação, histórico imutável, transferência, concorrência, paginação e agregações; repetir E2E PC-01 a PC-05 e validar 390/768/1440 px.

## Política proposta para implementação

Gestores mantêm acesso aos leads de sua organização após revogação do corretor. O corretor revogado perde acesso a contato e histórico privado. A origem histórica permanece intacta. Qualquer responsável operacional distinto exige campo separado e transferência explícita por gestor, com validação da autorização do destinatário e auditoria. Não transferir automaticamente origem ou responsabilidade.

## Pendências e limites

Pipeline, acompanhamento, histórico comercial, transferência, filtros/paginação, Kanban, analytics e seus testes ainda não foram implementados neste checkpoint. E2E, build, lint, contratos e capturas PC-06 permanecem pendentes. Não foram criadas migrações PC-06 nem alterado o banco neste início de auditoria.

Privacidade e retenção continuam limitadas ao uso sintético local conforme PC-05. Nenhum recurso remoto, deploy, commit ou push foi executado. PC-07 não iniciado.

## Rollback deste estado

Este início de PC-06 acrescentou somente este relatório. Não há migração ou funcionalidade PC-06 a reverter; preservar integralmente as alterações anteriores do PC-05. O plano de rollback de uma futura implementação deverá identificar suas migrações e manter histórico, atribuições e auditoria.
