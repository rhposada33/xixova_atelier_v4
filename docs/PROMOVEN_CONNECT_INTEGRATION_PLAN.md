# Promoven Connect — plano de integração visual e entre sites

Data: 23/10/2026. Este documento define contratos futuros; não configura DNS, Vercel, landing pública, Storage remoto ou visor 3D.

## Papel de cada aplicação

| Origem | Responsabilidade | Dados e autenticação |
| --- | --- | --- |
| `www.promoven.online` | Landing, marketing e demonstrações. Ponto de entrada “Acessar Connect” no cabeçalho e CTA de contato autorizado. | Sem sessão Connect e sem chaves privadas. Pode fazer link HTTPS para `connect.promoven.online/login`. |
| `connect.promoven.online` | Aplicação privada de organizações, projetos e inventário; catálogo público Connect em `/p/*` e `/s/*`. | Supabase Connect próprio, Auth PKCE para rotas privadas, RLS multiempresa e projeções públicas restritas. Não consulta Escobar nem o Supabase de leads comerciais. |

Um link entre domínios não transporta token. A sessão Connect permanece no domínio Connect. `returnTo` aceita somente rotas internas aprovadas em PC-01. Logout ocorre apenas no Connect.

## Navegação e identidade visual

Na landing, inserir futuramente uma entrada clara “Acessar Connect” que navegue para `https://connect.promoven.online/login`; a landing continua como entrada institucional e de demonstrações. No Connect, manter “Visão geral”, “Empreendimentos” e “Meu perfil”, com organização ativa no contexto administrativo. Em mobile, a navegação usa menu recolhível acessível e o seletor de organização permanece visível.

Compartilhar tokens visuais documentados, sem importar o runtime de Escobar: verde institucional (`#123e31`, `#15553e`), tema claro, DM Sans para interface, Playfair Display em títulos, contraste de foco e padrões de cards e formulários. Um pacote futuro de tokens deve conter apenas CSS/dados estáticos e ser versionado entre apps, sem Auth, cliente Supabase ou lógica 3D compartilhada.

## Contrato para 3D opcional

PC-05 implementou o contrato 2D de imagens e plantas em bucket Connect privado, com manifesto sem caminho Storage, publicação explícita e URL de 60 segundos. O projeto Connect poderá referenciar um asset `3d_model` em `project_assets`, com `organization_id`, `project_id`, `unit_id` opcional, `storage_path`, `visibility`, `mime_type`, `checksum` e versão. O servidor Connect deve resolver autorização antes de entregar um manifesto de mídia. Um manifesto público deve incluir apenas projeto publicado, asset explicitamente autorizado/publicado e URLs de curta duração; nunca o `storage_path` privado ou credenciais de serviço. O visor não consulta o banco Escobar.

Interface proposta, sujeita a implementação posterior:

```ts
type ProjectMediaManifest = {
  projectId: string;
  revision: number;
  catalog2d: { images: { url: string; alt: string }[]; floorPlans: { url: string; label: string }[] };
  viewer3d?: { projectId: string; assetId: string; format: "glb"; version: number; visibility: "public" | "private"; checksum: string; authorizedUrl: string; expiresAt: string };
};
```

O catálogo 2D deve funcionar mesmo quando `viewer3d` está ausente, falha ou expira. O dashboard administrativo não importa Three.js. Uma rota de apresentação futura pode carregar o módulo do visor por `import()` somente após ação explícita do usuário e apenas com manifesto autorizado. Componentes comuns podem compartilhar tipos e UI, sem duplicar cliente de dados ou copiar código do visor Escobar. O processamento GLB e as cenas existentes ficam fora deste checkpoint.

## Preparação de domínio e deploy futuro

1. Criar projeto de hospedagem separado para Connect, com build a partir de `apps/promoven-connect-web` e fallback SPA para `/login`, `/reset-password`, `/connect/*`, `/p/*` e `/s/*`. A landing mantém projeto e pipeline próprios. Servir `Referrer-Policy: no-referrer` também como cabeçalho HTTP, além da meta tag atual.
2. Configurar `connect.promoven.online` por CNAME/registro exigido pelo provedor escolhido após validação de propriedade. Manter `www.promoven.online` no deploy atual. DNS e certificado TLS devem ser testados antes de trocar o CTA público.
3. Configurar variáveis **por aplicação**: Connect recebe `VITE_CONNECT_SUPABASE_URL`, `VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY` (chave pública) e `VITE_CONNECT_ENV` conforme ambiente. Edge Functions Connect recebem `CONNECT_APP_ORIGIN`, `CONNECT_PUBLIC_SUPABASE_URL`, `CONNECT_DELIVERY_MODE` e `CONNECT_LEAD_RATE_SECRET`, além dos segredos Supabase injetados no backend; o segredo de rate limit deve ter ao menos 32 caracteres. Nenhum deles entra no bundle. Landing não recebe variáveis Connect nem Escobar; Escobar e leads preservam seus próprios ambientes. Nunca compartilhar `service_role`, sessão, cookie, tabela ou Storage entre sistemas.
4. No Auth Connect, autorizar `https://connect.promoven.online` como site URL e `https://connect.promoven.online/reset-password` como redirect de recuperação. Verificar PKCE e retorno somente para rotas internas. Revisar CORS/origins do projeto Connect sem adicionar origens de Escobar por conveniência.
5. Implantar Connect isoladamente após aprovação da política de privacidade/retenção de leads, origem IP confiável para rate limit, processamento de imagens e backup. Aplicar migrações Connect com backup e janela de revisão; rodar smoke tests de login, organização, projeto privado, 409, Storage, links, revogação, projeção pública e recibo de lead. Depois, em deploy independente da landing, adicionar o link de entrada. Nenhum passo deve alterar o deploy de Escobar ou leads.

## Rollback

Manter versões imutáveis dos dois deploys e backup do banco Connect anterior à migração remota. Se falhar a aplicação, restaurar o deploy Connect anterior e desativar/retirar apenas o CTA novo da landing, preservando a landing atual. Se falhar migração de dados, bloquear escritas Connect, executar migração compensatória revisada ou restaurar backup Connect em ambiente isolado e validar memberships/auditoria antes de reabrir. Não restaurar Escobar ou leads como parte de rollback Connect. Para este checkpoint local, não há DNS/deploy remoto a reverter.

## Estado depois de PC-05

- Storage Connect, imagens/plantas 2D, links de corretores, catálogo público e recibos de lead funcionam **somente localmente**. O plano de retenção, compartilhamento e atendimento a direitos do comprador exige aprovação antes de dados reais.
- GLB e visor 3D seguem futuros e opcionais. O dashboard não carrega Three.js.
- Validar ambiente remoto, observabilidade, backups, domínio, proxy confiável e controles de privacidade em execução futura autorizada. Nenhuma dessas ações foi realizada aqui.

## Preparação PC-07A: apresentação e entrada de clientes

Especificação para execução posterior, sem modificar a landing nesta etapa:

- Cabeçalho institucional: **Produtos → Promoven Connect** leva a `www.promoven.online/connect` (página futura). **Acessar Connect** leva diretamente a `https://connect.promoven.online/login`.
- Página de apresentação: título “Sua operação comercial, conectada”; descrição “Publique empreendimentos, autorize corretores e acompanhe cada interesse em um ambiente privado da sua incorporadora”. Seções: inventário e publicação; rede autorizada; links atribuídos; CRM e indicadores. Ilustrações/capturas exclusivamente sintéticas ou autorizadas. Não prometer vendas, integrações ERP ou visor 3D já disponíveis.
- CTAs: **Já sou cliente — Entrar** para login Connect; **Conhecer o produto** para o canal comercial aprovado da landing, sem mandar compradores para o banco de leads B2B. Sem formulário de cadastro irrestrito.
- Dentro do produto, entrada **Primeiros passos** e CTA no dashboard levam a `/connect/onboarding`; depois projetos/inventário, corretores, CRM e indicadores. Organização ativa permanece no cabeçalho. Mobile usa menu recolhível acessível (PC-06), com seletor disponível fora do menu.
- Guia visual: conservar verde, DM Sans/Playfair Display, fundo claro, foco visível, labels e cards. Futuro pacote de tokens pode centralizar CSS puro; não importar runtime, Auth, cenas ou banco Escobar.
- Fallback: indisponibilidade Connect não impede a landing/demonstrações; login apresenta recuperação e contato operacional aprovado. Não redirecionar usuários para Escobar como alternativa de autenticação.

O [plano de infraestrutura](PROMOVEN_CONNECT_DEPLOYMENT_PLAN.md) detalha DNS por ambiente, redirects, segredos, transporte de e-mail, custos, observabilidade e rollback isolado. A página de marketing e os links entre domínios ainda não foram publicados. 3D permanece opcional, sob demanda, sem Three.js no dashboard e sem consulta ao banco Escobar, conforme contrato acima.
