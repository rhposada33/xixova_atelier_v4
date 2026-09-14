# Fase 3 — Checkpoint A local

## Convites

- Expiram em sete dias e usam token opaco de 256 bits, armazenado somente como SHA-256.
- A criação (`pending_delivery`) e o resultado da entrega (`sent` ou `delivery_failed`) são transações separadas.
- A repetição do mesmo `operation_id` não cria nem envia outro convite. Respostas de rede ambíguas exigem consulta e reenvio manual.
- Contas novas usam `inviteUserByEmail`; contas existentes usam OTP sem criação de usuário. A resposta externa é uniforme.
- O `service_role` existe somente no runtime da Edge Function. O navegador não pode confirmar entregas.

## Compatibilidade do callback local

O teste com Supabase Auth e Inbucket confirmou que `redirect_to` preserva o caminho `/accept-invitation`, o token opaco e o fragmento Auth. A aceitação também possui modo de código após login como fallback. Devem ser repetidos no ambiente de staging antes de configurar redirects ou enviar convites remotos.

## Compatibilidade da organização Escobar

A migração é compatível com o estado remoto conhecido e não valida retroativamente que toda organização já ativa possua um administrador. Portanto, aplicada isoladamente, Escobar continuaria `active` com zero memberships. Platform admin não conta como `organization_admin`; ele apenas conserva governança global. Organizações novas jamais chegam a `active` sem um membership administrativo, e uma organização que já possui um último administrador não permite degradá-lo, suspendê-lo ou removê-lo.

Antes de aplicar esta migração em produção será obrigatório:

1. Criar ou selecionar o usuário Auth que administrará Escobar.
2. Inserir seu UUID em `organization_members` como `organization_admin` ativo, mediante bootstrap controlado e auditado.
3. Confirmar por contagem que Escobar possui ao menos um administrador ativo.
4. Só então aplicar a migração e executar os testes posteriores.

Nenhum UUID pessoal ou email será incluído em migrações. Não foi criada membership remota durante este checkpoint.

## Grants das RPC de convites

| Função | PUBLIC | anon | authenticated | service_role | Chamador |
|---|---|---|---|---|---|
| `admin_prepare_invitation` | Não | Não | Sim | Não necessário | Edge Function usando o JWT original; PostgreSQL valida usuário, perfil, organização, papel, limite e papel solicitado. React não chama diretamente. |
| `admin_claim_invitation_delivery` | Não | Não | Não | Sim | Somente Edge Function, antes de chamar Auth. Registra que a tentativa distribuída começou. |
| `admin_mark_invitation_delivery` | Não | Não | Não | Sim | Somente Edge Function. Exige tentativa reclamada e ator igual ao criador do convite. |
| `admin_retry_invitation` | Não | Não | Sim | Não necessário | Edge Function usando JWT original. Autoriza/rota o reenvio, mas não pode afirmar entrega. |
| `admin_revoke_invitation` | Não | Não | Sim | Não | React/repositório autorizado; valida organização, estado e versão. |
| `accept_organization_invitation` | Não | Não | Sim | Não | Usuário autenticado; valida perfil, email Auth confirmado, token, estado, expiração, organização e uso único. |

`admin_prepare_invitation` retorna o hash e demais dados somente à Edge Function. O repositório React invoca a função HTTP e recebe apenas estado e identificador. O token em texto claro nunca é retornado ao navegador administrador.

## Idempotência distribuída

A Edge Function reclama a entrega em uma transação antes de cruzar para Supabase Auth. Repetir a mesma operação devolve o convite existente; uma segunda reclamação falha de forma neutra e não envia novamente. Se a resposta se perde depois do envio, o estado permanece verificável e exige reenvio manual. O reenvio gira token e `operation_id`, limpa a reclamação anterior e volta a reclamar exatamente uma tentativa. Estados terminais não se degradam.

## Privacidade e retenção

E-mails são visíveis somente para administradores autorizados, aparecem mascarados na interface e não entram na auditoria genérica. Convites expirados e revogados permanecem registrados nesta fase. Recomenda-se anonimizar o email após 180 dias em uma fase futura, mediante rotina auditada específica.

## Configuração local

`ALLOWED_ORIGINS` contém origins separados por vírgula. Supabase fornece localmente `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`; nenhum deles deve ser adicionado a variáveis `VITE_*`, logs ou Git.
