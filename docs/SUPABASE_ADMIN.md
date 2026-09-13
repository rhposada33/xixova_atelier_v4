# Portal administrativo Escobar — checkpoint A

Este documento descreve a camada local de dados e segurança da segunda fase. Nenhuma migração deste checkpoint foi enviada ao projeto remoto.

## Modelo aditivo

- `profiles`: apresentação e bloqueio operacional do usuário. O e-mail continua exclusivamente em `auth.users`.
- `platform_admins`: administração global, independente de qualquer vínculo organizacional.
- `organization_members.active`: permite suspender um vínculo sem apagá-lo.
- `units.version`: controle de concorrência otimista.
- `units.reserved_by` e `units.reserved_at`: estado operacional da reserva.
- `reserved_until`: continua opcional. A migração não altera valores existentes e não cria expiração automática.
- `unit_audit_logs`: registro imutável de preço, status e publicação.

O trigger de `auth.users` cria o perfil automaticamente. Usuários autenticados podem atualizar somente `full_name` e `avatar_url`; não podem ativar o próprio perfil.

## Autorizações

| Operação | Platform admin | Organization admin | Seller | Viewer |
|---|---:|---:|---:|---:|
| Ler inventário e resumo | Organizações ativas | Organizações vinculadas | Organizações vinculadas | Organizações vinculadas |
| Alterar preço | Sim | Sim | Não | Não |
| Publicar ou ocultar | Sim | Sim | Não | Não |
| Disponível → reservada | Sim | Sim | Sim | Não |
| Reservada → disponível | Sim | Sim | Somente reserva própria | Não |
| Reservada → vendida | Sim | Sim | Não | Não |
| Disponível → vendida | Sim | Sim | Não | Não |
| Vendida → disponível | Sim | Sim | Não | Não |
| Auditoria completa | Sim | Sim | Não | Não |
| Atividade própria de reservas | Sim | Sim | Sim | Não |

Platform admins não precisam constar em `organization_members`. Para os demais papéis, perfil, organização e vínculo precisam estar ativos.

## Superfície efetiva do banco

| Objeto | Papel PostgreSQL | Permissão | Proteção e dados visíveis |
|---|---|---|---|
| Tabelas de inventário | `authenticated` | `SELECT` | RLS limita a organizações ativas autorizadas |
| `profiles` | `authenticated` | `SELECT`; `UPDATE(full_name, avatar_url)` | Somente o próprio perfil |
| `platform_admins` | `authenticated` | `SELECT` | Somente o próprio vínculo global |
| `unit_status_history` | `authenticated` | `SELECT` | Administradores veem o escopo; seller vê somente ações próprias |
| `unit_audit_logs` | `authenticated` | `SELECT` | Mesma separação; nenhum cliente insere, altera ou apaga |
| `get_public_inventory` | `anon`, `authenticated` | `EXECUTE` | Somente projeto/unidade publicados; não expõe dados de reserva |
| RPC `admin_*` | `authenticated` | `EXECUTE` | Validação interna de sessão, perfil, organização, papel, estado e versão |
| Schema `private` | `authenticated` | Uso restrito aos helpers de RLS | Não está exposto pela Data API; helpers não aceitam UUID de usuário |

`PUBLIC` e `anon` não executam RPC administrativas. `authenticated` não recebe escrita direta em unidades, reservas, auditoria, membros ou papéis.

## RPC administrativas

```text
admin_update_unit_price(uuid, bigint, numeric) → units
admin_change_unit_status(uuid, bigint, text, text, text) → units
admin_set_unit_published(uuid, bigint, boolean) → units
admin_get_unit_history(uuid?, uuid?, text?, timestamptz?, timestamptz?) → histórico
admin_list_units(filtros, página, ordenação) → unidades + total
admin_get_project_summary(uuid) → contadores do projeto
```

As duas RPC de leitura foram adicionadas no Checkpoint B porque o PostgREST não ordena de forma confiável a coleção principal por campos relacionados de andar e tipologia. Elas executam paginação, filtros e ordenação estável no PostgreSQL, sem alterar a matriz de permissões aprovada.

Também no Checkpoint B, uma migração aditiva passou a rejeitar explicitamente o acesso de `viewer` à RPC de histórico. Antes dela, a RLS devolvia uma coleção vazia; a nova resposta `forbidden` torna o contrato inequívoco sem ampliar permissões.

As três mutações bloqueiam a unidade, verificam a versão, atualizam, auditam e incrementam `version` uma única vez na mesma transação. Falhas usam a mensagem técnica fixa `inventory_admin_error` e um código estruturado no detalhe: `not_found`, `forbidden`, `inactive_user`, `version_conflict`, `status_conflict`, `invalid_transition` ou `invalid_input`.

Recursos inexistentes e recursos fora do escopo retornam igualmente `not_found`. Nenhuma mensagem destinada à interface deve exibir SQL ou o texto técnico original.

## Reservas e auditoria

- Ao reservar, a RPC grava `reserved_by = auth.uid()`, `reserved_at = now()` e `reserved_until = null`.
- Ao liberar ou vender, limpa os três campos operacionais.
- A venda registra os valores anteriores da reserva antes da limpeza.
- O seller libera somente quando `reserved_by = auth.uid()`.
- Não existem jobs, expiração ou liberação automática.

Auditorias usam horário do servidor e guardam apenas os campos relevantes. Não há políticas de `INSERT`, `UPDATE` ou `DELETE`; manutenção administrativa futura exigirá um backend privado e está fora desta fase.

## Bootstrap revisável

1. Criar manualmente o usuário em Supabase Auth.
2. Obter somente o UUID criado.
3. Em uma sessão administrativa controlada, iniciar uma transação e inserir o UUID em `platform_admins`.
4. Inserir em `organization_members` apenas se o usuário também precisar de um papel naquela organização.
5. Consultar as duas relações e testar uma leitura autorizada antes do `commit`.
6. Remover o arquivo ou histórico temporário que continha o UUID.

Exemplo conceitual para revisão, sem UUID real:

```sql
begin;
insert into public.platform_admins (user_id, created_by)
values (:'auth_user_uuid', null);

-- Opcional e independente:
insert into public.organization_members (organization_id, user_id, role)
values (:'organization_uuid', :'auth_user_uuid', 'organization_admin');
commit;
```

Não usar esse procedimento com `anon` ou `authenticated`, não guardar e-mail/UUID pessoal em migrações e não criar um endpoint público de bootstrap.

## Validação local e rollback

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level warning
npx supabase db diff --local
```

Os usuários deterministas são criados dentro de transações pgTAP e revertidos ao final; não fazem parte do seed comercial nem existem remotamente.

Antes de uma aplicação remota, o rollback deve ser preparado como uma nova migração revisada. Ele deverá revogar as RPC e políticas novas antes de remover objetos. Remover colunas ou tabelas que já contenham dados será considerado destrutivo e exigirá autorização específica. Nunca usar `db reset --linked`.
