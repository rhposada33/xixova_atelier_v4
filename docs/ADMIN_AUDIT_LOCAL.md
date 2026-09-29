# Auditoria administrativa — proposta local

Esta entrega não foi aplicada em staging ou produção. A migração
`20260915010000_read_admin_audit.sql` acrescenta somente uma RPC de leitura,
um índice e um helper privado de projeção segura. Não altera logs existentes.

## Contrato

`public.admin_list_audit_logs(p_organization_id uuid default null,
p_project_id uuid default null,p_action text default null,
p_resource_type text default null,p_actor_id uuid default null,
p_date_from timestamptz default null,p_date_to timestamptz default null,
p_page integer default 1,p_page_size integer default 25)`.

Retorna `id`, nomes de organização/projeto/recurso/ator, ação, tipo de recurso,
momento, valores anteriores/novos projetados, motivo redigido e `total_count`.
Os identificadores UUID são internos ao contrato, não são o texto principal da UI.
A paginação é remota, limitada a 100 linhas, com ordenação estável
`created_at desc,id desc`. O total é recebido na primeira linha; uma página
fora do alcance retorna vazia e total 0.

## Permissões efetivas

| Papel | `admin_list_audit_logs` | `admin_audit_logs` direto |
|---|---|---|
| `platform_admin` com perfil ativo | Todas as organizações, inclusive suspensas | Nenhuma leitura/escrita de cliente |
| `organization_admin` com perfil e membresia ativos | Apenas organizações próprias `active` | Nenhuma leitura/escrita de cliente |
| `seller`, `viewer`, inativo, `anon` | Negado | Negado |

O filtro por organização estrangeira responde `not_found`. A RPC é
`SECURITY DEFINER`, `search_path=''`, e a execução é concedida somente a
`authenticated`; a função revalida perfil e role. Não há grants de escrita.
`admin_audit_logs` continua imutável. A leitura direta anterior de
`authenticated` é revogada, com testes pgTAP atualizados para verificar pela
RPC. As políticas de RLS existentes não são relaxadas.

## Projeção e privacidade

PostgreSQL e React aplicam allowlists explícitas de campos comerciais e
escalares. Emails em nomes/motivos/valores conhecidos são redigidos; chaves
desconhecidas, objetos aninhados, tokens, hashes, `operation_id`, metadata Auth,
payloads de importação e erros técnicos não são devolvidos nem renderizados.
Os eventos de convite exibem “Registro administrativo”, nunca destinatário.

Os nomes das ações vêm dos identificadores realmente persistidos nas migrações.
O evento `membership.bootstrap` é mostrado quando registrado por um bootstrap
controlado; não é gerado automaticamente por esta migração. `Histórico` mantém
o inventário em `/portal/history` e abre a auditoria estrutural em
`/portal/history/admin`.

O filtro “Responsável” usa a RPC restrita `admin_list_audit_actors` com busca
por nome e limite de 50 opções; não exige digitar UUID. Em volumes maiores,
a busca permite localizar atores fora das primeiras opções. O catálogo não
expõe emails ou atores de outras organizações ao administrador local.

## Aplicação futura

Exige autorização separada para staging, preflight/diff, backup e validação.
Nenhum `supabase db push` remoto foi executado nesta entrega.
