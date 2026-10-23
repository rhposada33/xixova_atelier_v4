# Promoven Connect — especificação do MVP (PC-00)

Estado: proposta para validação, sem funcionalidades implementadas. Interface em português brasileiro; portal privado de incorporadoras e corretores autorizados, com catálogo público apenas para conteúdo publicado.

## Objetivo e usuários

Uma incorporadora publica um empreendimento, mantém disponibilidade confiável, convida corretores específicos, recebe consultas de compradores atribuídas ao link utilizado e acompanha o trabalho comercial. O corretor vê somente empreendimentos com autorização ativa. O visitante vê apenas o catálogo público explicitamente publicado.

| Papel | Escopo | Capacidades principais |
| --- | --- | --- |
| `platform_admin` | Operação Connect, com concessão auditada | Suporte e configuração, sem assumir acesso automático a dados de comprador em UI normal. |
| `organization_admin` | Organização membro | Gerir membros, projetos, publicação, corretores e leads da organização. |
| `sales_manager` | Organização membro | Gerir inventário, convites, atividades e desempenho conforme política da organização. |
| `broker` | Identidade global + autorização por projeto | Completar perfil, aceitar convite, consultar projetos ativos, criar links e gerir seus leads permitidos. |
| `visitor` | Anônimo | Consultar projeção pública e enviar interesse; nunca consultar inventário privado. |

Uma pessoa pode ser membro de várias organizações e corretor de vários projetos. A autorização de corretor é relação própria, com estados `invited`, `active`, `suspended`, `revoked`; só `active` concede leitura privada. Membros internos não se tornam corretores por inferência.

## Fluxos e critérios de produto

1. **Incorporadora:** criar organização e projeto → preencher inventário ou importar CSV → revisar diferenças → confirmar → publicar campos permitidos → convidar corretores. Projeto em rascunho não aparece no catálogo público.
2. **Corretor:** convite → autenticação → perfil e CRECI → aceite vinculado à identidade → autorização ativa → catálogo privado. Convite vencido, usado ou revogado oferece mensagem segura e caminho de suporte.
3. **Comprador:** link de corretor → catálogo público → formulário → validação em servidor → lead e atribuição atômicos → painel do corretor. O navegador não escolhe o corretor por ID.
4. **Inventário:** upload CSV → validação e diff → confirmação por gestor → atualização transacional/versionada → evento de auditoria. Conflitos exigem nova revisão.
5. **Revogação:** gestor revoga acesso → leitura privada e links deixam de funcionar imediatamente → atribuições históricas e auditoria permanecem consultáveis por sujeitos autorizados.

O MVP termina quando um desenvolvedor consegue publicar projeto, convidar corretor, compartilhar unidade, captar lead atribuído e consultar o resultado sem vazamento entre organizações. Pagamentos, comissões, reservas vinculantes, marketplace nacional, agentes de IA e integração ERP ficam fora do escopo.

## Mapa de rotas proposto

| Rota | Público | Conteúdo |
| --- | --- | --- |
| `/connect/organization`, `/connect/settings` | membro interno | Organização, usuários, preferências. |
| `/connect/projects`, `/connect/projects/:id/units`, `/connect/projects/:id/import` | membro interno | Projeto, inventário, revisão CSV. |
| `/connect/brokers`, `/connect/leads`, `/connect/analytics` | gestor interno | Autorizações, leads, métricas. |
| `/connect/broker`, `/connect/broker/projects`, `/connect/broker/projects/:id` | corretor ativo | Visão pessoal e catálogo privado. |
| `/connect/broker/leads`, `/connect/broker/links`, `/connect/broker/profile` | corretor | Leads próprios, compartilhamentos, CRECI. |
| `/p/:publicSlug`, `/p/:publicSlug/u/:unitCode` | visitante | Projeção pública de projeto/unidade. |
| `/s/:shareToken` | visitante | Resolver link revogável e atribuição. |
| `/invite/:token` | convidado autenticado | Aceite de convite com identidade verificada. |

`publicSlug` precisa ser globalmente único ou receber namespace explícito de organização; escolher antes do esquema. Todas as rotas Connect residem no host isolado proposto `connect.promoven.online`; nada neste documento afirma que o host exista. Links de visita não concedem preço privado. Catálogo público e privado usam a mesma linguagem visual, mas projeções de dados distintas.

## Experiência

- Tema claro, identidade Promoven existente, componentes acessíveis e foco visível.
- Projetar e verificar larguras de 390, 768 e 1440 px. Corretor deve conseguir abrir projeto, filtrar unidade, copiar/compartilhar link e registrar atividade no celular.
- Formularios com rótulos, erros por campo, loading, estado vazio e recuperação de falha de rede. A confirmação de importação mostra totais, erros e alterações por unidade antes do commit.
- Preços não são necessários no público por padrão; publicação explícita por projeto/unidade define a projeção. Materiais privados exigem autenticação e URL curta.
- Carregar visualização 3D depois do catálogo principal e somente para assets publicados/permitidos. Fallback 2D mantém o fluxo comercial funcional.
- WhatsApp usa URL construída a partir de link atribuído já emitido pelo servidor. Não colocar PII de comprador ou token de sessão no texto.

## Medidas básicas

Contagens de projetos publicados, unidades por estado, convites aceitos, links ativos, leads novos e leads por corretor/empreendimento. Métricas agregadas obedecem ao tenant e evitam PII em eventos analíticos. Definir janelas e timezone na API; não inferir taxa de conversão de visitantes sem telemetria consentida.

## Dados e privacidade

Coletar do comprador somente nome, canal de contato, mensagem opcional e aceite/ciência exigidos pela política aprovada. Registrar versão do aviso, instante e origem do link sem incluir IP bruto ou PII em analytics. Definir retenção, base legal, direitos do titular e compartilhamento com corretor antes de produção; proposta técnica não substitui revisão jurídica.

## Decisões pendentes que afetam implementação

1. Exibição de preço no público e para cada corretor: por padrão, preço privado até publicação explícita.
2. Escopo do primeiro piloto: uma incorporadora e um projeto com dados sintéticos inicialmente.
3. Comprovação de CRECI: campo obrigatório e revisão manual no MVP; integração automatizada depende de fonte autorizada.
4. Responsável pelo lead após revogação: sugerido preservar autoria histórica e transferir atendimento ativo ao gestor; formalizar regra comercial antes de PC-06.
5. Critérios e documentos públicos/privados por projeto, além de política LGPD e retenção aprovadas.
