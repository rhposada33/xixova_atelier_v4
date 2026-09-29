# Portal administrativo Escobar — checkpoint B

## Arquitetura

O visualizador público continua em `/` e mantém os parâmetros `vista`, `maqueta`, `piso` e `unidad`. O React Router adiciona as rotas administrativas sem substituir `InventoryReader` ou o repositório público.

```text
/
├── login
├── forgot-password
├── reset-password
└── portal
    ├── inventory
    │   └── :unitId
    └── history
```

`PortalApp` é carregado com `React.lazy`. O build gera chunks separados para o portal e para o visualizador interno. O fallback SPA precisa entregar `index.html` em acessos diretos, preservando arquivos reais de `assets/`, `building/`, `projects/`, `social/`, `catalog.json` e `favicon.svg`.

## Autenticação

O cliente Supabase usa persistência e renovação de sessão, PKCE e detecção de callback. `AuthProvider` restaura a sessão antes de renderizar rotas protegidas. O portal consulta `profiles`, `platform_admins`, organizações e vínculos protegidos por RLS; uma sessão Auth não basta para conceder acesso.

- `profiles.active=false`: bloqueio completo do portal e das RPC.
- Sem organização: tela bloqueada com orientação para procurar o administrador.
- Sem cadastro público, login social, convite ou MFA.
- O e-mail exibido vem da sessão Auth, nunca de `profiles`.
- Recuperação não informa se um endereço está cadastrado.

Para desenvolvimento local, `supabase/config.toml` desabilita signup e autoriza:

```text
http://127.0.0.1:5173/reset-password
http://localhost:5173/reset-password
```

Configuração futura no Supabase Auth remoto, somente após autorização:

- Site URL: `https://escobarpro.vercel.app`
- Produção: `https://escobarpro.vercel.app/reset-password`
- Preview: cadastrar cada `https://<preview-autorizado>.vercel.app/reset-password`
- Local: os dois endereços acima, caso o projeto remoto seja usado deliberadamente em desenvolvimento.
- Revisar a mensagem de recuperação em português e manter o token/callback fornecido pelo Supabase.
- Configurar SMTP transacional de produção com domínio autenticado, remetente dedicado, SPF, DKIM e DMARC.

Testes locais de e-mail devem usar Mailpit/Inbucket do Supabase local. Links expirados, usados, callbacks inválidos e sessão de recuperação ausente levam à solicitação de um novo link.

## Repositório administrativo

`InventoryAdminRepository` permanece separado de `InventoryReader` e oferece:

```ts
getCurrentProfile()
listOrganizations()
listProjects(organizationId)
getProjectSummary(projectId)
listUnits(AdminUnitQuery): Promise<PaginatedAdminUnits>
getUnit(unitId)
getUnitHistory(AdminHistoryQuery)
updateUnitPrice(UpdateUnitPriceCommand)
changeUnitStatus(ChangeUnitStatusCommand)
setUnitPublished(SetUnitPublishedCommand)
```

`pageSize` aceita de 1 a 100. A RPC pagina antes de devolver dados, aplica filtros no PostgreSQL e sempre termina a ordenação por código e ID. Escritas chamam somente as RPC específicas aprovadas.

Em conflito de versão, o portal recarrega a unidade, preserva a intenção digitada separadamente e exige nova revisão. Em falha de rede indeterminada, consulta a unidade e compara campo e versão; nunca reenvia uma mutação automaticamente.

## Interface e acessibilidade

O portal inclui visão geral, inventário responsivo, drawer de edição, histórico e saída. Ações são apresentadas conforme o papel, mas a autorização final permanece no PostgreSQL. Mudanças de status exigem motivo; `sold → available` exige confirmação adicional.

Labels, foco visível, mensagens `aria-live`, estados textuais e layout para desktop/tablet/mobile são obrigatórios. As capturas automatizadas ficam em `xixova/maquette_web/test-results/visuals/` e não são versionadas.

## Variáveis e Vercel

Variáveis públicas necessárias, sem valores neste repositório:

```text
VITE_INVENTORY_PROVIDER=supabase
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Nunca definir `service_role`, secret key, senha, token ou connection string com prefixo `VITE_`. O arquivo `vercel.json` incluído representa o fallback SPA previsto; antes do deploy será preciso confirmar que ele está na raiz efetiva configurada no projeto Vercel. Nenhuma variável ou configuração Vercel foi alterada neste checkpoint.

## Aplicação remota e rollback

Após autorização explícita:

1. Revisar o diff de todas as migrações pendentes.
2. Confirmar backup e janela de aplicação.
3. Executar `supabase db push` uma única vez a partir deste repositório.
4. Validar as 72 unidades e `get_public_inventory` antes do bootstrap.
5. Configurar Auth/redirects autorizados.
6. Criar o usuário Auth manualmente e aplicar o bootstrap documentado.
7. Somente depois preparar um Preview Vercel.

O rollback deve ser uma nova migração aprovada: revogar primeiro as RPC/políticas novas, restaurar as políticas anteriores e manter tabelas/colunas que já tenham dados. Remoções físicas serão tratadas como destrutivas e não serão executadas sem autorização específica. O frontend pode ser revertido sem alterar dados, restaurando o artefato anterior; o visualizador público continua compatível com o esquema ampliado.
