# Promoven Connect — onboarding da incorporadora (PC-07A)

Estado: roteiro implementado e ensaiado localmente em 23/10/2026. Somente dados sintéticos. Connect é um produto do ecossistema Promoven. Não substitui a landing nem Escobar.

## Provisionamento inicial autorizado

O operador autorizado provisiona a conta no Auth **Connect** e entrega o convite/recuperação ao administrador. Em ambiente local, mensagens ficam no Mailpit 56324. A conta da plataforma com `platform_admin` cria a organização na Visão geral; a RPC auditada a torna administradora da organização. Essa pessoa usa **Primeiros passos → Configurar equipe interna** para adicionar a conta já provisionada do cliente pelo e-mail, escolhendo administrador ou gerente. A aplicação não concede `platform_admin`. Conta inexistente recebe orientação de provisionamento; duplicidade não cria novo vínculo. Não há cadastro público; o endpoint Auth local foi verificado e retornou `422 signup_disabled`.

O bootstrap do operador e o provisionamento de novas identidades são atividades administrativas controladas. As tarefas normais abaixo são feitas pela interface, sem SQL. A tela atual adiciona membros; edição/revogação de equipe interna ainda exige operação autorizada pela RPC versionada PC-01, sem painel dedicado. Preparar esse procedimento para suporte antes de clientes reais.

## Roteiro do cliente

1. Entre no Connect e confira a organização no seletor do cabeçalho. Abra **Preparar minha operação** ou **Primeiros passos**.
2. Confira o perfil e a equipe. Somente administrador da organização adiciona equipe interna. Gerente acompanha o roteiro e opera os módulos permitidos; publicação e criação de projetos permanecem sob as permissões existentes.
3. Em **Empreendimentos**, crie nome, cidade, UF e identificador público único. Selecione o projeto no roteiro. A opção **Novo empreendimento** permite começar outro.
4. Abra **Importar inventário**, baixe o modelo, preencha e envie CSV. Revise linhas novas, alteradas e conflitos antes de confirmar. A confirmação é transacional. Em conflito, obtenha nova prévia; não force versões antigas. Cadastro manual também atende à etapa de inventário.
5. No detalhe do projeto, envie imagens e plantas autorizadas (PNG/JPEG/WebP, até 5 MB). Finalize o upload e publique cada mídia desejada. Não envie documentos de compradores nem arquivos de Escobar sem autorização.
6. Revise visibilidade de preço, características, disponibilidade, imagens e plantas. Publicação da mídia e flag de visibilidade do projeto são controles distintos. Preço pode permanecer sob consulta; visibilidade para corretores é configurada separadamente.
7. Publique o empreendimento e as unidades desejadas. Use **Abrir catálogo público para revisão** em janela sem login para conferir o que o comprador verá.
8. Em **Corretores**, envie convite por projeto. O corretor abre o e-mail, autentica, aceita e completa o perfil profissional/CRECI. O gestor revisa e ativa a autorização. Perfil global não concede acesso automaticamente.
9. O corretor autorizado abre o catálogo privado e gera o próprio link comercial. Confira-o em janela anônima. Suspensão/revogação invalida links; não altere manualmente o token nem envie tokens de sessão.
10. Envie interesse sintético, abra **Leads**, confira origem e histórico, registre contato, agende retorno e avance para proposta. Em **Indicadores**, confira janela e filtros. Ganho é encerramento informado, sem reservar/vender unidade automaticamente.

Clique **Atualizar progresso** depois de trabalhar em outra aba. O indicador usa registros reais, não tarefas marcadas artificialmente: administrador ativo, projeto, unidades, mídia pronta, publicação, acesso ativo/verificado de corretor, link ativo não expirado e lead. Oito grupos cobrem os dez passos acima. Não certifica qualidade dos arquivos, entrega de e-mail, publicação de toda mídia, revisão de preço ou aprovação jurídica. Um roteiro completo não libera dados reais.

## Recuperação e limites

- Falha na consulta oferece **Tentar novamente**. Troca de organização reinicia dados e avisos do roteiro. Respostas antigas não preenchem a nova organização.
- Conflito 409 exige recarregar e revisar. Não repetir operações com versões inventadas.
- Convite expirado deve ser reenviado pelo gestor; acesso revogado exige nova decisão autorizada.
- Perda de acesso deve ser atendida pelo operador; não compartilhar login entre pessoas.
- Kanban mostra a página corrente (20 leads), com navegação; indicadores calculam o conjunto autorizado conforme filtros.
- Se um arquivo já teve URL assinada, ela pode durar até 60 segundos após revogação. Informações já vistas não podem ser apagadas da memória de terceiros.

## Ensaio reproduzível (equipe técnica, não cliente)

Com a stack Connect local já inicializada e migrações aplicadas, em `apps/promoven-connect-web`:

```bash
set -a
source .env.e2e.local
set +a
node tests/pilot-seed.mjs
npm run test:e2e
```

O script só conecta a `127.0.0.1:56322`. Cria uma nova organização sintética por execução, sem apagar dados anteriores; relatório em `pilot-results/pc07a.json` (ignorado pelo Git). Identidades/autorizações dos cinco corretores são fixtures, sem senhas utilizáveis; os convites reais via Mailpit e aceite são ensaiados separadamente no E2E. O teste do roteiro usa o ID do relatório, sem depender da ordem de organizações. Não executar esse fixture em bancos remotos.
