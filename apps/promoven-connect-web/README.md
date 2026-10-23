# Promoven Connect — aplicação local PC-01 a PC-04

SPA React/Vite isolada de `xixova/maquette_web`. Usa exclusivamente `VITE_CONNECT_*`; não carrega sessão, cliente Supabase ou dados de Escobar. A área `/connect/*` exige Auth Connect e consulta perfil/memberships protegidos por RLS. Não há cadastro público.

## Desenvolvimento local

1. Em `infra/promoven-connect`, inicie o Supabase local com `npx supabase start --exclude studio,analytics,vector,edge-runtime,storage,imgproxy,realtime`. As portas são 56321–56324 e não coincidem com Escobar (54321) ou leads comerciais (55321).
2. Copie `.env.example` para `.env.local` neste diretório e preencha **somente a chave pública** retornada pelo Supabase Connect local. O endereço deve continuar `http://127.0.0.1:56321` com `VITE_CONNECT_ENV=local`.
3. Execute `npm ci` e `npm run dev`. A aplicação abre em `http://127.0.0.1:5178`.
4. Para criar usuários sintéticos localmente, passe `CONNECT_LOCAL_API_URL`, `CONNECT_LOCAL_DATABASE_URL`, `CONNECT_LOCAL_SERVICE_KEY`, `CONNECT_BOOTSTRAP_EMAIL` (`@test.local`) e `CONNECT_BOOTSTRAP_PASSWORD` (12+ caracteres) ao script `node scripts/bootstrap-local.mjs`. Obtenha as três primeiras variáveis **somente** de `npx supabase status -o json` dentro de `infra/promoven-connect`; o script rejeita URL de API/DB fora das portas Connect locais. Não coloque a chave de serviço em `.env.local`, no navegador ou no repositório.
5. Para convites PC-03, em outro terminal dentro de `infra/promoven-connect`, copie `supabase/.env.functions.example` para `supabase/.env.functions.local` e execute `npx supabase functions serve broker-invite --env-file supabase/.env.functions.local`. Essa função entrega o e-mail ao Mailpit local e devolve ao navegador somente o ID/status do convite. O arquivo local é ignorado pelo Git. A entrega remota fica desabilitada até configurar transporte transacional próprio Connect.

O bootstrap cria um administrador de plataforma sintético e duas organizações locais com papéis diferentes para provar a seleção multiempresa. Também cria `recovery@test.local` para o teste de recuperação. É idempotente para as organizações e memberships. O login do usuário existente conserva sua senha anterior; não use o script para redefini-la.

## Validação

```bash
cd infra/promoven-connect
npx supabase migration up --local
npx supabase test db

cd ../../apps/promoven-connect-web
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:e2e
```

O E2E autenticado exige `CONNECT_E2E_EMAIL`, `CONNECT_E2E_PASSWORD` e `CONNECT_E2E_RECOVERY_PASSWORD` no ambiente do processo, todos sintéticos locais. Sem eles, os casos autenticados são pulados. Para o fluxo PC-03/PC-04, mantenha a função `broker-invite` servida localmente. Capturas são geradas em `test-results/visuals/` (ignorado pelo Git). Os testes de recuperação e convite usam Mailpit; o convite cria uma identidade sintética e testa catálogo, filtros, favorito, comparação, detalhe, preço autorizado e revogação.

## Limites e rollback

Este app contém PC-01 a PC-04 locais. O pacote `@promoven/connect-contracts` compartilha tipos de fundação, inventário, corretores e catálogo privado. O catálogo 2D funciona sem mídia; imagens, plantas e 3D dependem de publicação segura de assets Connect ainda não implementada. Não há links atribuídos ou leads de compradores. O build escreve somente `apps/promoven-connect-web/dist/` ignorado. Não executar `supabase link` ou `db push`.

Rollback local PC-03: parar a função `broker-invite`, ocultar as rotas novas da UI e aplicar uma migração compensatória revisada para RPCs/tabelas PC-03 somente se os dados sintéticos forem dispensáveis. Preservar PC-01/PC-02 e os documentos existentes. Não há rollback remoto porque nenhuma migração foi aplicada fora do Supabase Connect local.

Rollback local PC-04: ocultar as rotas de catálogo e a ação administrativa de preço, preservar auditoria e favoritos até backup/revisão, e aplicar migração compensatória para RPCs/tabela/coluna PC-04 somente após avaliar dependências. Não usar `db reset` em banco existente.
