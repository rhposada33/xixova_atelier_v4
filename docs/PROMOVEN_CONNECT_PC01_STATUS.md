# Promoven Connect — PC-01 Recovery: resultado local

Data de referência: 23/10/2026 (America/Sao_Paulo). Branch `master`, commit base `fc3f571`. Antes do trabalho havia cinco documentos PC-00 e o pacote/relatório PC-02 não rastreados; todos foram preservados. PC-01 não modifica `supabase/`, `infra/promoven-leads/`, `xixova/maquette_web/`, Blender ou dados reais.

## Implementado

- `apps/promoven-connect-web/`: React 19, Vite 8, TypeScript, React Router 7, Supabase JS, login, recuperação, sessão PKCE, rotas protegidas, dashboard, seleção de organização, perfil e estados de espera/negação/erro. UI em português do Brasil, sem Three.js nas telas administrativas.
- `infra/promoven-connect/supabase/`: configuração local exclusiva (portas 56321–56324), signup global desabilitado, login por e-mail habilitado, duas migrações locais para `profiles`, `organizations`, `organization_members`, `platform_admins` e `audit_events`.
- RLS em todas as cinco tabelas expostas; apenas leitura direta conforme perfil e tenant. Alterações de perfil, criação de organização e gestão de memberships ocorrem por RPCs validadas no PostgreSQL. Helpers privilegiados ficam em `private` com `search_path` fixo e grants explícitos. O estado inativo do perfil/membership bloqueia acesso. Alteração de papel usa versão esperada, lock por organização e preserva o último administrador.
- Bootstrap local controlado com usuário sintético, dois tenants e papel diferente em cada um. Os tipos de fundação foram acrescentados a `packages/connect-contracts` sem alterar os módulos de inventário/CSV do PC-02.

## Testes executados

| Verificação | Resultado |
| --- | --- |
| Supabase Connect local, migração inicial e migração de endurecimento | Aplicadas somente na base local 56322. |
| `npx supabase test db` | **30/30** testes SQL passaram: isolamento, usuário em duas organizações, inatividade, anon, DML negado, papéis, versão, último admin e auditoria. |
| `npm ci`, TypeScript, ESLint, Vitest e build do app | Passaram; 2 testes unitários do app. |
| Playwright com Auth e Mailpit reais locais | **3/3**: guarda de rota, solicitação e conclusão de recuperação de senha, login, troca de organização, perfil e logout. |
| Pacote de contratos PC-02 | TypeScript e **10/10** testes preservados/passando. |
| Capturas responsivas | `apps/promoven-connect-web/test-results/visuals/login-390.png` e `dashboard-{390,768,1440}.png`; inspeção visual e asserção de ausência de overflow horizontal. |
| Inspeção do bundle | Sem referências a Escobar, `promoven-leads`, `sb_secret_`, URI de Postgres, `service_role` ou runtime Three.js. A chave pública local é esperada no bundle. |

## Limites e riscos conhecidos

- Não houve deploy, configuração remota, DNS, `supabase link`, `db push`, projeto remoto, Storage ou dados reais. A CLI local pode imprimir credenciais de desenvolvimento; elas não foram adicionadas ao repositório ou ao bundle.
- O bootstrap usa a chave de serviço **somente** no Node local e exige endereços locais. Credenciais sintéticas de E2E ficam em arquivos `.env.*.local` ignorados pelo Git; nunca usá-las fora do ambiente local.
- A gestão de membros possui RPCs e testes no banco, mas ainda não há tela de convites; convites de corretores pertencem ao PC-03. PC-01 oferece seleção/leitura e criação de organização por administrador de plataforma, não um cadastro público.
- A aplicação não executa PC-02: os contratos CSV/inventário permanecem independentes. Agora existe a fundação necessária para integrar projetos, unidades e importações em um próximo trabalho PC-02. O relatório `PROMOVEN_CONNECT_PC02_STATUS.md` permanece como registro histórico do bloqueio encontrado antes deste recovery.
- Os testes SQL verificam as policies na base local; não há alegação sobre configuração de projetos remotos. Uma futura publicação requer revisão de migrações, secrets, Auth redirects, backups e nova bateria de testes em staging dedicado.

## Rollback

Parar apenas `promoven_connect_local` e remover os diretórios novos do app/infra após revisão. Não tocar nos projetos Supabase Escobar ou leads comerciais, nem apagar os arquivos preexistentes PC-00/PC-02. Não há migração remota a reverter. O procedimento de reprodução e bootstrap está no README do app.

## Gate

**PC-01 completo no ambiente local isolado:** aplicação, Auth, persistência, RLS e testes de isolamento foram exercitados com Supabase e navegador reais. PC-02 pode retomar sobre esta fundação; PC-03 permanece fora do escopo.
