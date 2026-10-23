# Promoven Connect — matriz de segurança (PC-00)

Estado: proposta; nenhuma política RLS, grant ou Storage Connect existe ainda. Segurança é bloqueio de release. A matriz abaixo é contrato para PC-01 e checkpoints seguintes, não afirma que os acessos já funcionem.

Legenda: `L` ler, `C` criar, `A` alterar, `—` negar. Todo acesso interno é limitado ao tenant ativo; `broker` sempre requer autorização **ativa** ao projeto. `platform_admin` usa fluxo de suporte auditado, não um bypass de PII na aplicação normal.

| Recurso | Admin org | Gerente | Corretor ativo | Visitante | Mecanismo |
| --- | --- | --- | --- | --- | --- |
| Organização e membros | L/C/A | L | — | — | RLS por vínculo ativo; funções de gestão. |
| Projeto em rascunho | L/C/A | L/C/A | — | — | RLS/RPC por tenant. |
| Projeto publicado, campos públicos | L/A | L/A | L | L | Projeção pública explícita, sem colunas privadas. |
| Unidade, preço privado e disponibilidade interna | L/C/A | L/C/A | L no projeto autorizado, conforme concessão | — | RLS e projeção privada; preço nunca por RPC pública padrão. |
| Unidade, campos publicados | L/A | L/A | L | L | Projeção pública por projeto/unidade publicados. |
| Material privado | L/C/A | L/C/A | L se autorizado | — | Bucket privado e URL assinada curta após verificação. |
| Convite de corretor | L/C/A | L/C/A | aceitar somente próprio | — | Endpoint/RPC transacional, token hash e Auth. |
| Autorização de corretor | L/C/A | L/C/A | L da própria | — | Revogação por gestor; RLS não recursiva. |
| Link atribuído | L/C/A no projeto | L/C/A no projeto | L/C/A próprio se ativo | resolver somente projeção pública | Token opaco e revogável, hash em banco. |
| Lead com PII | L/A na org | L/A na org | L/A permitido dos próprios | C por endpoint validado | Sem `SELECT` anon ou escrita genérica do browser. |
| Atividade de lead | L/C | L/C | L/C em lead próprio permitido | — | Append-only para autores; sem editar histórico. |
| Auditoria | L restrita | L restrita | — | — | Somente servidor insere; sem update/delete de app. |
| Métricas | L da org | L da org | L pessoal | — | Agregação com escopo imposto no servidor. |

## Regras de implementação

1. Habilitar RLS em toda tabela exposta e usar grants mínimos por `anon`, `authenticated` e `service_role`. Regras `USING` e `WITH CHECK` cobrem leitura e escrita; revogar escrita genérica em ownership, preço, autorização e atribuição. Testar SQL efetivo, não apenas filtro React.
2. Helper de autorização fica em schema não exposto (`private`), com `SECURITY DEFINER` apenas quando indispensável, `search_path=''`, identificadores qualificados e `EXECUTE` concedido explicitamente. Evitar consultar a própria tabela protegida de forma recursiva; usar funções auditadas e testes de cross-tenant.
3. Na API, validar JWT contra o projeto Connect e reconsultar membership/autorização dentro da operação. `organizationId`, `projectId`, `brokerId` ou status fornecido pelo cliente não provam permissão.
4. Tokens de convite/link são aleatórios de pelo menos 128 bits de entropia (preferir 256), guardados somente por digest; comparação e consumo transacionais. Convite curto e uso único. Compartilhamento revogável; não incluir tokens em analytics, logs, referrers externos ou screenshots.
5. Formulário público usa validação de esquema, tamanho máximo, idempotência por chave, rate limit por identificador derivado com HMAC e resposta que não revela existência de pessoa/projeto privado. Registrar consentimento/versão do aviso. PII jamais entra em evento analítico.
6. Storage separa buckets públicos de privados. Política de objeto confere organização, projeto e autorização ativa; URL assinada curta é emitida pelo servidor e expira. Após revogação, novas URLs falham; URLs já emitidas expiram no prazo documentado. Para documento altamente sensível, proxy autenticado pode ser necessário.
7. Preços em `numeric`, mutações por versão esperada, auditoria append-only. Erro de versão é `409`. Importação e revogação são atômicas. Backup, rollback e revisão de migração antecedem qualquer ambiente remoto.

## Ameaças e testes negativos obrigatórios

| Ameaça | Controle | Prova automatizada mínima |
| --- | --- | --- |
| Membro A lê/edita projeto B | RLS, FK de tenant, verificação no endpoint | Dois tenants; `SELECT`, RPC e mutation de B negados para A. |
| Corretor revogado lê inventário via sessão antiga | Estado ativo consultado a cada acesso | Revogar e repetir leitura e geração de link com mesmo JWT. |
| Corretor troca IDs no payload | Derivar ator de Auth/token | Payload com `brokerId`/`organizationId` alheios rejeitado. |
| Convite aceito duas vezes ou por e-mail errado | Hash, lock, Auth e-mail verificado, estado único | Duplo aceite concorrente, token vencido e outra conta falham. |
| Link revogado ainda atribui lead | Resolução transacional de autorização/link | Revogar antes de submit e sob corrida; zero atribuições novas. |
| Conteúdo não publicado vaza no público | View/RPC de projeção explícita | `anon` não lê preço privado, documento ou unidade oculta. |
| `service_role`/segredo vai ao bundle | Separação de runtime e scanner do build | Buscar `sb_secret_`, `service_role`, DSN e tokens no artefato. |
| CSV cria linha em tenant estranho ou atualização parcial | IDs derivados e transação com hash/versão | Linha adulterada e conflito abortam lote sem auditoria órfã. |
| Lead duplicado por retry/concorrência | Chave de idempotência e lock | Mesmo payload resulta num lead; payload diferente retorna `409`. |
| Storage privado expõe objeto por path adivinhado | Bucket privado + policy + endpoint | `anon`, outro tenant e corretor revogado recebem negação. |

## Política de release

PC-01 só aceita Auth, papéis e isolamento multi-tenant após testes SQL negativos em banco Connect local. PC-03 exige testes de convite/revogação. PC-05 exige testes de vazamento público, idempotência e atribuição. PC-07 repete matriz em ambiente de staging dedicado com contas sintéticas, verifica bundle e URLs de Storage, acessibilidade, telemetria sem PII e rollback. Produção permanece bloqueada até aprovação explícita e decisões legais/comerciais resolvidas.
