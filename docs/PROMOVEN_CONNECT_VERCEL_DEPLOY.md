# Promoven Connect — PC-07C.2 · preparação Vercel

Data: 23/10/2026, America/Sao_Paulo (evidências UTC em 24/10). **Preflight local concluído; nenhuma publicação realizada.**

O frontend compila em instalação limpa e pode ser publicado como projeto independente. O artefato remoto deste checkpoint contém uma tela de indisponibilidade. **Não oferece login, catálogo, CRM, uploads ou captação remotos e não constitui staging operacional.** O aplicativo completo e seu Auth continuam disponíveis somente no ambiente Connect local.

## 1. Inspeção e preservação

Lidos `AGENTS.md`, PC07C1_STATUS, REMOTE_ARCHITECTURE e os relatórios PC07B3A, PC07B3B e PC07B3C. Inspecionados frontend, contratos compartilhados, configurações locais e Vercel somente em leitura.

- Repositório: `https://github.com/rhposada33/xixova_atelier_v4.git`.
- Branch: `master`; HEAD inicial/final: `9fcdf0a480137cea5deac68f0a9537006e2b9d4c`.
- Árvore inicialmente limpa. Sem commit, push, link de projeto, deploy, DNS ou migração.
- Vercel CLI instalada: `54.1.0`; `whoami` confirmou `rafaelposada`.
- Scope acessível: `rafaelposadas-projects`; plano `hobby`; papel `OWNER`.
- Não existe projeto `promoven-connect` nesse scope.
- O GET de domínios do projeto **`escobarpro`** confirmou `promoven.online` e `www.promoven.online`, além de seu domínio Vercel. Root Directory não configurado (`.`), framework/build/output sem override, Node 24.x, sem integração Git registrada na resposta consultada. **Não reutilizar, relincar ou editar esse projeto.**
- `v0-promoven-business-website` é outro projeto: Next.js, root `.`, Node 24.x, repo `rhposada33/promoven`, branch `main`. O GET atual de seus domínios retorna apenas seu domínio Vercel. Aliases históricos de deployments também mencionam Promoven; não são prova de vínculo atual.
- Outros projetos apenas inventariados: `escobarpro-staging`, `deuda-resoluta-landing`, `backend-fedetec`, `testface2-cmoe`, `simon-le-bottle-uedz`. Nenhum foi alterado.
- O domínio `promoven.online` aparece na conta com nameservers Vercel. Isso não autoriza nenhuma edição DNS.
- O `vercel.json` da raiz continua intacto. Não há `.vercel/project.json` novo na raiz ou no Connect. O vínculo antigo em `versiones/diseno_v2/.../catalogo/.vercel/` não foi reutilizado.

Consultas efetivamente executadas: `vercel whoami`, `vercel teams ls`, `vercel project ls --format=json`, `vercel project inspect v0-promoven-business-website`, `vercel domains ls` e GETs `/v2/teams`, `/v9/projects`, `/v9/projects/{name}` e `/v9/projects/{name}/domains`. Nenhuma variável secreta da conta foi solicitada ou copiada.

## 2. Monorepo e arquivos

```text
apps/promoven-connect-web/
  package.json / package-lock.json   # Node 24.x; build:vercel; @types/node fixo
  eslint.config.js                  # lint também dos scripts locais de preflight
  vercel.json                       # instalação, build, SPA e headers próprios
  vite.config.ts                    # entradas local/remota e política de ambiente
  src/main.tsx                      # entrada local existente, preservada
  src/main.remote.tsx               # tela remota sem dependência de APIs/Auth
  src/remote.css                    # ajustes responsivos exclusivos
  src/deployment-policy.ts          # rejeita backend remoto não aprovado
  src/deployment-policy.test.ts     # ambientes, metadados Vercel, vazamento e host
  src/supabase.ts                   # cliente restrito a ambiente/host locais
  scripts/preflight-vercel.mjs      # duas cópias limpas, testes, hashes e inspeção
  scripts/preview-vercel.mjs        # servidor estático de verificação local
packages/connect-contracts/         # contrato existente, sem alterações
docs/PROMOVEN_CONNECT_VERCEL_DEPLOY.md
output/playwright/connect-vercel/   # evidências sanitizadas
```

Não foi criado workspace npm na raiz, nem alterados lockfiles da landing ou dos contratos. A dependência continua `file:../../packages/connect-contracts`; TypeScript resolve seus fontes durante o build. A instalação limpa preservou os lockfiles.

### Configuração exata do projeto novo

| Campo | Valor |
| --- | --- |
| Nome | `promoven-connect` |
| Repositório, se conectado futuramente | `rhposada33/xixova_atelier_v4` |
| Root Directory | `apps/promoven-connect-web` |
| Include source files outside Root Directory | **Ativado** |
| Framework | Vite |
| Node.js | `24.x` — também declarado em `engines` |
| Install Command | `npm ci` |
| Build Command | `npm run build:vercel` |
| Output Directory | `dist` |
| Configuração | `apps/promoven-connect-web/vercel.json` |
| Production Branch futura | `master`, somente após aprovação da integração Git |
| Preview/Production Protection | Vercel Authentication, **All Deployments** |
| Preview Toolbar | Desativada neste frontend restrito |
| Domínios iniciais | Somente os URLs Vercel do projeto novo |

O checkbox de arquivos externos é necessário para o pacote compartilhado. Não mover/copiar validadores para o app. Se a resolução falhar no primeiro build Vercel, interromper a publicação e verificar esse checkbox e a presença de `packages/connect-contracts` no checkout. As duas instalações locais comprovaram a estrutura relativa. [Documentação Vercel de monorepos](https://vercel.com/docs/monorepos/monorepo-faq).

Node 24 foi escolhido explicitamente, sem depender do default mutável da plataforma. Testado com Node `24.21.0`, npm `11.19.0`. [Versões Node na Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## 3. Ambientes e variáveis

| Variável efetiva | Local | Preview neste checkpoint | Production neste checkpoint |
| --- | --- | --- | --- |
| `VITE_CONNECT_ENV` | `local` | `preview` | `production` |
| `VITE_CONNECT_SUPABASE_URL` | `http://127.0.0.1:56321` | Não cadastrar | Não cadastrar |
| `VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY` | Chave pública do Connect local | Não cadastrar | Não cadastrar |
| `VITE_CONNECT_FUNCTIONS_URL` | `http://127.0.0.1:56410` | Não cadastrar | Não cadastrar |

Não existe alias `VITE_CONNECT_SUPABASE_ANON_KEY`. Não usar service_role, senha de banco, HMAC, SMTP, token Vercel ou chave privada em qualquer `VITE_*`.

- Local: `.env.local` existente e `npm run dev`; fluxo PKCE, sessão por origem, verificação de usuário e rotas protegidas preservados. O cliente agora também rejeita uso em host não loopback ou ambiente diferente de `local`.
- Remoto: `build:vercel` exige `VERCEL_ENV=preview|production` e `VITE_CONNECT_ENV` correspondente. `VERCEL_ENV` é fornecido pelo sistema Vercel, não é uma nova variável pública.
- `envDir: false` impede leitura de `.env.local`, `.env.remote` e `.env.production` no build remoto. Arquivos com canários de localhost/chave foram inseridos nas cópias de teste e ignorados corretamente.
- `envPrefix: []` e `define` explícito expõem somente `VITE_CONNECT_ENV`. `VITE_VERCEL_*`, injetadas automaticamente pela plataforma, são toleradas mas excluídas do bundle; não são aliases de configuração Connect. [Variáveis por framework](https://vercel.com/docs/environment-variables/framework-environment-variables).
- Qualquer outra `VITE_*` não vazia rejeita o build sem imprimir seu valor. Endpoints remotos e chaves públicas ainda não aprovados também são rejeitados.
- `npm run build` permanece local; se executado com variáveis de ambiente Vercel, falha indicando `build:vercel`. Não publicar o `dist` do build local.
- A futura ativação do backend exigirá revisão explícita desta política, entrada remota, CSP e testes com destinos aprovados. **Cadastrar URLs/chaves não ativa o produto nesta versão.**

## 4. Segurança, SPA e isolamento

O remoto compila diretamente `main.remote.tsx`, sem importar o entrypoint local, Supabase SDK, AuthProvider, páginas administrativas ou catálogo. Não há dados comerciais reais ou fictícios, formulário de lead, token ou configuração de backend no artefato. A única navegação externa da UI é para `https://www.promoven.online`.

O tema claro, verde institucional, DM Sans/Playfair Display e classes existentes são reutilizados. Google Fonts continua sendo solicitado para tipografia; não é um endpoint de negócio.

Headers do projeto novo:

- CSP: scripts locais; estilos locais/Google Fonts; fontes Google; imagens locais/data; `connect-src 'none'`, `form-action 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Camera/microfone/geolocalização desabilitados; `X-Robots-Tag: noindex, nofollow, noarchive`; `Cache-Control: no-store`.

Rewrites específicos para `/`, `/login`, `/forgot-password`, `/reset-password`, `/invite/:path*`, `/connect/:path*`, `/p/:path*`, `/s/:path*`. Assets existentes são servidos como arquivos; assets ausentes, `/api/*` e caminhos desconhecidos não recebem HTML de sucesso. Todas as rotas reconhecidas exibem indisponibilidade no remoto; no local o React Router e a autorização continuam ativos. [Rewrites e precedência do filesystem](https://vercel.com/docs/project-configuration/vercel-json).

Nenhum componente de Escobar, inventário Escobar, Three.js, chave privilegiada ou endpoint local foi encontrado no bundle remoto. O backend local, seu proxy, Auth/RLS/Storage e workers não foram alterados. Não houve acesso a banco remoto, alteração de dados ou migração.

### Proteção de acesso e plano

Vercel Authentication está disponível em todos os planos. All Deployments passou a estar disponível gratuitamente em setembro de 2026. Preparar `ssoProtection.deploymentType=all` **no projeto novo antes do primeiro deploy**, confirmar por GET e testar com visitante deslogado após autorização. A proteção existente de outro projeto não protege Connect. [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication), [anúncio de disponibilidade](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan).

Não foi possível verificar uma proteção ativa do Connect, pois o projeto ainda não existe. Não foram criados bypass tokens nem removida proteção para testes. Password Protection é outro recurso e não é necessário para este plano.

**Bloqueio de publicação comercial:** a conta consultada é Hobby, destinado a uso pessoal não comercial. Confirmar um plano/scope compatível antes de hospedar o produto comercial; qualquer contratação permanece pendente de autorização. A disponibilidade gratuita de proteção não resolve essa restrição. [Plano Hobby](https://vercel.com/docs/plans/hobby).

## 5. Comandos locais verificados

Na raiz do checkout, com Node 24.x no PATH:

```bash
node apps/promoven-connect-web/scripts/preflight-vercel.mjs
```

Esse comando não chama Vercel. Cria duas cópias em `/tmp/connect-vercel-*`, instala app e contratos com `npm ci --offline --no-audit --no-fund`, executa typecheck/lint/unitários/contratos, compara hashes dos dois builds Preview, gera Production, verifica bundle e rejeições. Requer o cache npm previamente preenchido; na Vercel o Install Command é `npm ci` com acesso ao registry. Retém relatório e artefatos temporários para inspeção.

Equivalente manual do build remoto, a partir da raiz (cada comando foi exercitado pelo preflight):

```bash
npm --prefix packages/connect-contracts ci
npm --prefix apps/promoven-connect-web ci
npm --prefix packages/connect-contracts run typecheck
npm --prefix packages/connect-contracts test
npm --prefix apps/promoven-connect-web run typecheck
npm --prefix apps/promoven-connect-web run lint
npm --prefix apps/promoven-connect-web run test:unit
VERCEL_ENV=preview VITE_CONNECT_ENV=preview npm --prefix apps/promoven-connect-web run build:vercel
node apps/promoven-connect-web/scripts/preview-vercel.mjs apps/promoven-connect-web/dist 5181
```

O último comando serve em `http://127.0.0.1:5181`. É uma aproximação local de headers/rewrites, **não um emulador do edge Vercel**. Para Production, repetir o build com ambas as variáveis iguais a `production`. Não misturar variáveis `VITE_*` de outros projetos no shell.

O aplicativo completo local continua em `http://127.0.0.1:5178` com `npm --prefix apps/promoven-connect-web run dev` e o backend Connect local iniciado. O servidor de desenvolvimento já aberto foi preservado.

## 6. Resultados e evidências

| Verificação | Resultado |
| --- | --- |
| Instalações limpas Connect + contratos | 4 instalações offline, lockfiles preservados |
| TypeScript app / contratos | PASS |
| ESLint app e scripts de preflight | PASS |
| Unitários frontend | **20/20** (incluem autorização existente e política de deploy) |
| Contratos compartilhados | **15/15** |
| Preview reproduzível | 2 builds limpos, 3 arquivos idênticos byte a byte |
| Production | PASS, mesmo CSS e UI com rótulo próprio |
| Dotenv contaminado + metadados de plataforma + variável privada canário | Ausentes no bundle |
| Build remoto com ambiente local / endpoint localhost | Rejeitados |
| Build local padrão dentro de ambiente Vercel | Rejeitado |
| Config Vercel | Validada contra schema oficial com validador Draft7 |
| Bundle remoto | Sem endpoints locais, Escobar, JWT/chave privada, service_role, SDK/API Supabase ou source maps |
| HTTP local | 8 caminhos SPA → 200; `/api/test`, asset ausente, `/connectivity`, `/unknown` → 404; headers presentes |
| Browser | 11 rotas de autenticação/privadas/públicas → indisponibilidade; 0 formulários, 0 entradas localStorage, 0 recursos Auth/REST/Functions |
| CSP no navegador | `fetch` para mesma origem bloqueado por `connect-src 'none'` |
| Responsividade | 390, 768 e 1440 px: sem overflow horizontal, screenshots inspecionados |
| Regressão local de rota privada | `/connect/profile` → `/login?returnTo=%2Fconnect%2Fprofile`, heading de login correto |
| Build completo Connect local | PASS |
| Landing `xixova/maquette_web` | Instalação limpa + TypeScript + Vite PASS em cópia temporária |
| Git diff whitespace | PASS |

A cópia inicial da landing omitiu uma dependência relativa de inventário e assets de `src`; a cópia foi corrigida para reproduzir o layout original, sem editar fontes. O build final passou. Persistem avisos existentes sobre chunks maiores que 500 kB e `__dirname` no loader futuro do Vite. Connect apresenta aviso não bloqueante sobre import sem extensão no mesmo loader futuro. Nenhum upgrade amplo foi realizado.

A validação automática do meta-schema Vercel encontrou inconsistência em uma definição não usada de triggers; a validação da configuração contra as propriedades do schema oficial com Draft7 passou. No navegador houve 404 cosmético de favicon ausente, além da violação CSP deliberada do teste negativo. Não houve erro de renderização.

Relatório final: [build-report.json](../output/playwright/connect-vercel/build-report.json). Logs detalhados da execução: `/tmp/connect-vercel-278QL3/`. Build da landing: `/tmp/promoven-landing-build-8niqop0g/build.log`. Artefatos finais são idênticos aos usados na inspeção visual.

- [HTTP](../output/playwright/connect-vercel/http.json)
- [Métricas de layout](../output/playwright/connect-vercel/browser-layout.txt)
- [390 px](../output/playwright/connect-vercel/unavailable-390.png)
- [768 px](../output/playwright/connect-vercel/unavailable-768.png)
- [1440 px](../output/playwright/connect-vercel/unavailable-1440.png)
- [Snapshot remoto](../output/playwright/connect-vercel/snapshot-remote.yml)
- [Snapshot da proteção local](../output/playwright/connect-vercel/snapshot-local-auth.yml)

Preview: `index.html` 500 bytes; JS 220.912 bytes; CSS 21.723 bytes. SHA-256 do JS: `b3e230b4a91b5768e58e66f591edcdc5011fb4811e8a9a440793acf2f55359a2`; demais hashes no relatório.

**Não executado:** deploy/build na infraestrutura Vercel, proteção HTTP da Vercel, TLS/DNS remoto, Auth/backend remoto ou suíte completa SQL/RLS/E2E de negócio. Este checkpoint verificou build e smoke de autorização local; não reclassifica os relatórios backend anteriores nem seus gates como aprovados para remoto. A evidência PC07C1 vinculada ao hash anterior deve ser renovada antes de uma liberação integrada.

## 7. Publicação futura — somente após autorização

Decisões pendentes: plano/scope comercial adequado, autorização para criar **somente** o projeto `promoven-connect`, revisores com acesso Vercel e aprovação de um Preview apenas com tela de indisponibilidade. Produção, domínio e ativação do backend continuam sendo decisões separadas.

### 7.1 Criar e configurar o projeto vazio

Os comandos desta seção **não foram executados**. Confirmar scope e inexistência de projeto homônimo antes de executá-los. Nunca substituir o nome por `escobarpro` ou `v0-promoven-business-website`.

```bash
vercel whoami
vercel project ls --scope rafaelposadas-projects
vercel project add promoven-connect --scope rafaelposadas-projects
```

Salvar o seguinte JSON em um arquivo temporário `connect-project-settings.json`:

```json
{
  "framework": "vite",
  "rootDirectory": "apps/promoven-connect-web",
  "sourceFilesOutsideRootDirectory": true,
  "nodeVersion": "24.x",
  "installCommand": "npm ci",
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "dist",
  "autoExposeSystemEnvs": true,
  "skipGitConnectDuringLink": true,
  "enablePreviewFeedback": false,
  "enableProductionFeedback": false,
  "ssoProtection": { "deploymentType": "all" }
}
```

```bash
vercel api '/v9/projects/promoven-connect?slug=rafaelposadas-projects' --method PATCH --input connect-project-settings.json
vercel project inspect promoven-connect --scope rafaelposadas-projects
vercel api '/v9/projects/promoven-connect?slug=rafaelposadas-projects' --method GET
```

Conferir todos os campos, incluindo proteção, pelo GET. Parar se houver incompatibilidade ou autorização insuficiente; não desativar proteção para contornar falha. [Contrato de atualização de projeto](https://vercel.com/docs/rest-api/projects/update-an-existing-project).

### 7.2 Preparar uma fonte revisada e um Preview

Usar um commit revisado que contenha este checkpoint, criado futuramente pelo usuário. Não usar o HEAD inicial deste relatório, que ainda não contém as alterações. Criar snapshot somente dos dois diretórios; assim o CLI não recebe landing, Escobar, assets 3D nem arquivos `.env.local` do desenvolvedor:

```bash
connect_ref='<SHA_REVISADO_COM_PC07C2>'
connect_snapshot=$(mktemp -d /tmp/promoven-connect-publish-XXXXXX)
git archive "$connect_ref" apps/promoven-connect-web packages/connect-contracts | tar -x -C "$connect_snapshot"
vercel link --cwd "$connect_snapshot" --project promoven-connect --scope rafaelposadas-projects --yes
vercel project inspect promoven-connect --scope rafaelposadas-projects
```

Verificar que `$connect_snapshot/.vercel/project.json` aponta exclusivamente para o novo ID. No snapshot vinculado, adicionar somente a variável pública de ambiente:

```bash
printf 'preview' | vercel env add VITE_CONNECT_ENV preview --cwd "$connect_snapshot" --scope rafaelposadas-projects
printf 'production' | vercel env add VITE_CONNECT_ENV production --cwd "$connect_snapshot" --scope rafaelposadas-projects
vercel pull --yes --environment=preview --cwd "$connect_snapshot" --scope rafaelposadas-projects
vercel build --cwd "$connect_snapshot" --local-config "$connect_snapshot/apps/promoven-connect-web/vercel.json"
```

Inspecionar `.vercel/output` e confirmar que contém somente o frontend indisponível. O build local Vercel acima depende do projeto autorizado e de settings baixados; ainda não foi exercitado. **Após autorização específica de deploy Preview**, executar:

```bash
vercel deploy --prebuilt --cwd "$connect_snapshot" --scope rafaelposadas-projects
```

Conferir visita deslogada bloqueada, visita autorizada permitida, rotas, headers, CSP e nenhuma chamada de backend. Registrar deployment ID e URL. Não promover para produção automaticamente.

A alternativa Git é importar **este** repositório como um projeto novo, aplicando a tabela da seção 2. A importação pode iniciar deploy; só fazê-la depois da autorização. Revisar deploys automáticos/branch antes de conectar Git. Um push no monorepo pode disparar outros projetos conectados; este checkpoint não faz push nem altera regras dos projetos existentes.

### 7.3 Domínio, Auth e backend em checkpoint posterior

- Manter `www.promoven.online` e apex no projeto atual. Associar somente `connect.promoven.online` ao projeto Connect quando houver autorização específica.
- Consultar o valor de registro solicitado pela Vercel naquele momento; adicionar apenas o registro do subdomínio. Não copiar CNAME genérico, trocar nameservers ou mover apex/`www`.
- Validar propriedade/TLS e registrar o estado anterior para rollback. Não fornecer URLs efêmeras como callbacks permanentes de Auth.
- Quando existir Supabase Connect remoto isolado: aprovar URL do projeto, chave **pública**, proxy HTTPS e proteção de origens; revisar a política de build e `connect-src` para esses destinos exatos.
- Configurar Site URL/redirects no Auth **Connect**: origem final `https://connect.promoven.online` e caminhos efetivamente usados (`/reset-password`, `/invite` e retornos aprovados do fluxo existente). Preview deverá ter origens explícitas aprovadas; não usar wildcard global `*.vercel.app`.
- Não compartilhar sessão/cookies com o domínio pai, chaves ou tabelas com Escobar. Não alterar Auth da landing. Retestar PKCE, convite, recuperação, isolamento/RLS, proxy HMAC, Storage, leads, outbox e privacidade antes de liberar acesso remoto.

## 8. Rollback

- **Agora, local:** revisar o diff desta entrega e reverter somente seus arquivos identificados na seção 2. Remover apenas evidências/scripts criados neste checkpoint se desejado. Não usar `git reset --hard`, limpeza global de untracked ou restauração de outros módulos. Nenhuma migração precisa ser desfeita.
- **Primeiro Preview futuro:** se inválido, manter o projeto protegido, não promover nem associar domínio. Remover o deployment específico somente com autorização; registrar ID/causa.
- **Após versões publicadas:** no projeto `promoven-connect`, selecionar o deployment anterior aprovado na função Rollback da Vercel. Preservar proteção e valores de ambiente; variáveis de Vite são compiladas, portanto mudar variável não corrige um artefato já publicado.
- **Primeira produção sem versão anterior:** voltar à tela de indisponibilidade protegida e suspender a liberação. Nunca usar deployment da landing como rollback do Connect.
- **DNS futuro:** restaurar somente o registro anterior de `connect`, sem tocar apex/`www`. Banco/backend têm ciclo de rollback separado; este frontend não executa migrações.

## 9. Estado final e limites

Alterações limitadas a `apps/promoven-connect-web`, este documento e evidências em `output/playwright/connect-vercel`. Contratos, landing, raiz Vercel, backend Connect, Escobar, bancos e assets 3D preservados. Nenhum commit ou push criado.

**Pronto:** build frontend reproduzível, resolução monorepo, isolamento de ambientes, headers/rotas preparados e validação local. **Pendente:** plano comercial/scope, criação/configuração autorizada do projeto, proteção efetivamente testada na Vercel e primeiro Preview autorizado. Backend remoto permanece não operacional/não aprovado. A publicação da tela não libera o produto.
