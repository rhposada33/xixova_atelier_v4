# Promoven Connect — PC-07B.3C

Data: 2026-10-23. Escopo: ciclo de vida de dados de compradores Connect, execução local com fixtures sintéticas.

## Resultado e limite de aprovação

**Implementação técnica local validada para os registros e recursos inventariados. Anonimização integral permanece BLOCKED.** Foram executados código SQL, worker, Storage HTTP, dois executores concorrentes e restauração real de snapshot anterior à supressão.

O sistema não autoriza eliminação de dados reais. Existem bloqueios concretos para cópias externas não rastreadas, arquivos sem associação com comprador, identidades Auth, mensagens já processadas pelo transporte, múltiplos leads do mesmo contato e políticas ainda não aprovadas. Não foi criado mecanismo para contornar esses bloqueios pela UI.

O termo **exclusão técnica** descreve remoção dos registros cobertos. **Pseudonimização** descreve o ledger e identificadores operacionais protegidos que ainda permitem correlação. **Anonimização efetiva** exigiria demonstrar ausência de reidentificação em todo o contexto, incluindo cópias fora do sistema; isso **não está aprovado**. **Retenção obrigatória/legal hold** conserva os dados e bloqueia o executor; não foram inventados prazos ou bases legais.

## Modelo e cobertura

| Categoria | Identificadores / risco | Tratamento implementado e limite |
| --- | --- | --- |
| Lead e contato | `id`, `receipt_id`, nome, canal/contato, mensagem, unidade/projeto, status, datas, responsável, próxima ação e motivo de encerramento | Remove a linha inteira; não deixa um lead fictício com identidade trocada. HMAC normalizado do contato por organização impede reintrodução por INSERT/UPDATE. |
| Conteúdo livre / histórico | `lead_activities.detail`, notas, valores anteriores, atores e timestamps | Remove todas as atividades do lead, com permissão transacional restrita ao alvo. Imutabilidade continua ativa fora dessa transação. |
| Idempotência da captação | payload hash e recibo correlacionável | Remove os registros ligados ao recibo antes de excluir o lead. |
| Atribuição | comprador → corretor → link/access/projeto/data | Remove o vínculo individual do comprador, preservando um contador privado por organização/corretor, sem lead, recibo, projeto, unidade, link ou data. Links e acessos do corretor permanecem. Contador não é exposto em analytics e não é declarado anônimo. |
| Auditoria | `subject_id`, detalhes livres e eventos vinculados a lead/recibo/atividade | Limpa detalhes, substitui vínculo pelo protocolo técnico e reduz timestamp ao mês nos eventos do lead. Preserva ação/ator e registra resultado com contagens. Registros de protocolo continuam pseudonimizados e protegidos. |
| Storage / arquivos / temporários / exportações gerenciadas | Inventário `private.privacy_resources`, nomes opacos, vínculo explícito | Remove via API Storage e confirma ausência HTTP. Bucket privado `connect-privacy-private`, path `<lead UUID>/<object UUID>`; não aceita path arbitrário, outro bucket ou outro tenant. Metadados do objeto são removidos pelo Storage. Não promete apagamento físico de blocos ou de backups. |
| Outbox cifrada | Mail/invitation UUID e destinatário | Apenas associação sintética explícita, mesmo tenant, sem tentativa/despacho anterior. Trava convite/outbox, cancela, limpa payload cifrado e substitui destinatário/token do convite. Não destrói keyrings. Outbox operacional/auditoria ficam sem conteúdo da mensagem. |
| Convites e links de corretores | Identidade profissional, links compartilhados, Auth | Não são propriedade do comprador. Não são apagados indiscriminadamente. Mail já tentado/despachado e contato que corresponde a Auth bloqueiam execução para revisão de escopo. Links expirados não representam autorização de exclusão. |
| Exportações anteriores | Resposta do RPC legado pode ter sido salva fora do Connect | Pedido com `exported` bloqueia execução (`untracked_export_review_required`). Arquivos explicitamente inventariados foram testados; cópias locais, e-mail, planilhas e terceiros não são alcançáveis. |
| Logs | Contatos, notas, URLs e correlação de IDs | Worker emite evento/UUID/código; sem conteúdo ou credenciais. Marcadores da fixture final ausentes nos logs examinados de DB, Edge, Storage e mail workers. Retenção/limpeza de logs externos não foi implementada. |
| Backups | Snapshot pode conter todas as versões antigas | Mantidos intactos. Ledger separado detecta e reaplica supressões confirmadas na cópia isolada antes de considerar restore válido. Backups continuam contendo PII até expiração autorizada; não são chamados de anônimos. |

Não existe associação universal entre conteúdo de `project_assets` e um comprador. Texto de outra entidade pode conter uma cópia manual sem vínculo. Não se presume que busca por nome/telefone encontre todas as referências. Esses limites mantêm `fullAnonymizationValidated=false`.

## Fluxo técnico e autorização

1. Administrador registra solicitação em `connect_privacy_requests`, reutilizando o módulo existente. Uma solicitação de supressão por lead; repetição retorna o mesmo UUID.
2. Solicitante registra a verificação de identidade por protocolo opaco. Isso registra uma etapa operacional, sem validar juridicamente o processo externo.
3. Outro administrador, diferente do solicitante/verificador, aprova. O executor só aceita o solicitante como ator, nunca o aprovador. Revalida acesso do solicitante e do aprovador no processamento.
4. Preview informa contagens, versão, referências e legal hold, sem contato ou notas. Guarda a versão aprovada do lead. Mudança de versão falha com `PT409`; não executa um plano desatualizado.
5. Executor exige cadastro em `private.privacy_fixtures`, que não pode ser gravado por usuários/Auth/Edge/worker. Esse cadastro é criado somente pelo harness local para UUIDs sintéticos próprios. Não existe flag de produção para habilitar dados reais.
6. Lock de sessão por lead serializa executores e revisão/hold. Prepare trava o lead, verifica holds, exportações, duplicidades, Auth e recursos. Congela mutações, incluindo CRM e inventário de recursos. Locks de convite/outbox seguem a ordem do despacho SMTP.
7. Registra intenção durável no ledger externo **antes** da primeira exclusão de arquivo. Cada recurso é excluído por API e verificado. Erro deixa o caso preparado e os dados SQL preservados; retry retoma com o mesmo inventário/UUID.
8. Finalização SQL transacional apaga registros cobertos, transforma auditoria/atribuição, grava a réplica de supressão e conclui o protocolo. Uma capacidade em tabela privada, válida apenas para `txid_current()` e lead alvo, permite a remoção específica de histórico. Nenhum trigger é desligado globalmente; nenhum GUC fornecido pelo cliente autoriza exclusão.
9. Recibo externo autenticado confirma conclusão após o commit SQL. Falha entre commit e recibo exige retry/recuperação controlada; restore recusa intenção ainda não confirmada.
10. Testes verificam ausência das linhas relacionadas, conteúdo livre/auditoria, payload cifrado, objetos HTTP e reintrodução, além da integridade referencial.

RPCs administrativas: `connect_privacy_plan`, `connect_privacy_preview`, `connect_privacy_cases`. O RPC legado `connect_privacy` continua protegido e suas regressões passam. RPCs do worker: `connect_privacy_work_item`, `connect_privacy_prepare`, `connect_privacy_finish` — sem EXECUTE para anon, authenticated ou service_role.

`connect_privacy_worker` é NOLOGIN, assumido pelo operador local via PostgreSQL; não integra as roles JWT do authenticator. Não possui SELECT direto em leads/ledger/tabelas privadas. O processo local usa credencial administrativa Storage exclusivamente no servidor para remover os recursos permitidos. `main.mjs` não possui HTTP listener nem scheduler e fixa os endpoints locais. Superusuário/operador do banco continua sendo uma fronteira de confiança.

## Ledger e recuperação

`privacy-worker/.local/ledger/` é separado de `ops/artifacts/*/database.dump`:

- SQLite com transação, `synchronous=FULL`, lock entre processos e sequência de eventos HMAC encadeada.
- Head com sequência/MAC autenticados por **`ledger.anchor.key`, exclusiva do armazenamento externo**; confirmações de conclusão usam essa mesma chave externa.
- `ledger.key` também alimenta o HMAC de contato em `private.privacy_key`; essa chave de correspondência fica na área privada do DB e nos dumps. Ela **não** permite forjar o head/recibo sem a chave externa de âncora.
- Diretório 0700, arquivos de segredo/ledger 0600. Conteúdo: UUIDs da operação/tenant/lead/ator, HMAC do contato, paths opacos de recursos; nenhum nome, contato em texto puro ou nota. Esse conteúdo é pseudonimizado, não anônimo.
- Ausência de journal/chave/âncora, alteração de conteúdo, truncamento sem head correspondente ou recibo inválido falham fechados. Não recriar arquivos para silenciar erro.
- Não há armazenamento WORM/offsite ou âncora externa ao host configurados. Um operador com controle de **todos** os arquivos pode restaurar uma versão antiga coerente; prevenção desse rollback completo requer serviço/controle adicional. Gate de tratamento dos backups permanece falso.
- Restore valida todas as intenções/recibos externos. Intenção pendente, caso ausente num snapshot muito antigo ou contato diferente geram bloqueio/manual review. Não apaga automaticamente informação diante dessas ambiguidades.

No ensaio, o snapshot foi criado com lead, notas, auditoria, atribuição, arquivos e mensagem pendente. A origem sintética foi tratada **depois** da cópia. O restore recuperou dados antigos e reaplicou o journal atual com sucesso. Auth, Storage e Mailpit descartáveis ficaram em rede interna, sem acesso público; contêineres temporários foram removidos. A configuração do Auth da origem foi preservada.

## Migrações e arquivos

Migrações aplicadas **somente localmente**:

- `20261023150000_privacy_lifecycle.sql`: schema, processo, inventário, retenção, supressão e executor.
- `20261023151000_privacy_worker_guards.sql`: consulta mínima e propriedade de recursos.
- `20261023152000_privacy_local_operator.sql`: role assumível pelo operador PostgreSQL local.
- `20261023153000_privacy_revalidation.sql`: revalidação de aprovador, exportações anteriores e proteção em UPDATE.
- `20261023154000_privacy_mail_lock.sql`: serialização com despacho de e-mail e recusa de mensagens já tentadas.

Implementação em `infra/promoven-connect/privacy-worker/`: `main.mjs`, `worker.mjs`, `ledger.py`, adaptador Storage, helpers locais, fixture, teste real, probe de restore e unitários. Dependência `pg` fixada em 8.16.3, lockfile incluído.

Recuperação: `ops/recovery-local.sh`, `recovery-http.py` ampliados; `recovery-privacy.py` novo. Journal não é incluído no snapshot nem montado no probe; o supervisor valida e passa somente entradas/credenciais necessárias pela entrada padrão. Workers de mail pausados durante backup e retomados ao terminar.

Frontend: `src/pages/Privacy.tsx`, `src/privacyApi.ts`, navegação/rota no `Portal.tsx`, contrato `packages/connect-contracts/src/privacy.ts` e `tests/privacy.spec.ts`. Staging: gates separados e suíte local ampliada.

## Testes e evidências

| Gate | Resultado |
| --- | --- |
| SQL/RLS | **PASS — 341 assertions, 12 arquivos**, incluindo 19 novas de ciclo de vida; repetidos no restore final. |
| Contratos / typecheck | **PASS — 15 testes** e TypeScript. |
| Privacy worker unitário | **PASS — 2 testes**, idempotência do journal, confirmação, adulteração/head, segredo ausente e limites do transporte. |
| Execução sintética real | **PASS**: solicitação/duplicata, verificação, aprovação independente, outro tenant, corretor revogado, preview, falha parcial, retry, congelamento concorrente, dois executores, limpeza de histórico/auditoria/mail/Storage e bloqueio de reintrodução. |
| Legal hold e versão | **PASS** SQL: impede execução e preserva histórico; versão aprovada desatualizada retorna conflito. |
| Mail worker | **PASS — 5 unitários + 16 cenários reais** (22:54:09–22:54:16 UTC). |
| Proxy PC07B3A | **PASS** HTTP real (22:54:18–22:54:31 UTC): HMAC/bypass/CORS/rate entre instâncias/restart/falhas. |
| Helpers/proxy/persistência | **PASS — 10 testes**. |
| Worker mídia / web unitário | **PASS — 5 + 2 testes**. |
| E2E | **PASS — 8/8, 52,3 s**: nova privacidade e sete fluxos anteriores. |
| Concorrência de domínio | **PASS**: captação/CRM versus suspensão; reservas de quota de mídia. |
| Restore final | **PASS** — `ops/artifacts/connect-recovery-1792796169/`, **21 s total**; evidência HTTP em `http-result.json`. |
| Build/lint | **PASS**, Vite/TypeScript e ESLint. |
| Visual | **PASS**: 390, 768 e 1440 px, screenshot e assert de ausência de overflow. |
| Dados reais / execução remota | **NOT RUN / BLOCKED**, conforme restrição. |
| Anonimização integral / aprovação jurídica | **BLOCKED**, dependências explícitas abaixo. |

`privacy-worker/.local/evidence.json` registra o teste real final; `ops/artifacts/connect-recovery-1792796169/http-result.json` registra detecção de dados restaurados, reaplicação, Storage removido, mail apagado e reintrodução bloqueada, além das regressões Auth/Storage/Mailpit. Artefatos privados não são adicionados ao Git.

Os primeiros testes de fixture encontraram casts UUID e campo obrigatório de convite ausente; o harness foi corrigido. pgTAP exigiu USAGE em `extensions` para a role do worker **apenas na transação de teste, revertida por rollback**. Nenhum grant de produção foi ampliado para satisfazer esse teste. Resultado final acima é PASS.

### Interface

Tela de privacidade disponível somente a administradores do tenant; gerente/corretor não veem controles. Lista protocolo, fase, aprovação independente, hold e resultado técnico; preview exibe contagens. Não há botão de anonimização/execução irreversível. Evidências examinadas: `apps/promoven-connect-web/test-results/visuals/privacy-{390,768,1440}.png`; campos, navegação, seletor de organização e estados legíveis, sem transbordamento horizontal.

## Gates restantes e limitações precisas

- `fullAnonymizationValidated=false`: arquivos publicados ou privados sem vínculo verificável ao comprador, cópias em textos de outras entidades, downloads/exportações externas, logs de terceiros e caixas de e-mail não podem ser eliminados com segurança por este mecanismo.
- Mensagem com qualquer tentativa de processamento, contato que também é identidade Auth ou vários leads do mesmo contato no tenant bloqueiam o executor. Exigem delimitação e revisão adicional; não expandir automaticamente para outros titulares ou tenants.
- Snapshot anterior à existência do protocolo, operação ainda não confirmada no journal ou mudança de identidade bloqueiam restore. Não há procedimento automático para “resolver” essa ambiguidade.
- Caso com versão desatualizada exige nova revisão operacional; não existe ação na UI para forçar versão ou remover hold. Alterar registros privados manualmente não é procedimento aprovado.
- Contadores privados de atribuição, auditoria técnica e ledger continuam potencialmente correlacionáveis. Nenhum agregado de baixa cardinalidade é publicado para substituir leads excluídos.
- Políticas por categoria possuem prazo nulo, aprovação falsa e execução automática forçadamente desabilitada. Processo de identificação, autorização de exclusão e tratamento dos backups são gates separados, todos não aprovados. Uso de compradores reais permanece não autorizado.
- Journal/âncora local precisam custódia e proteção contra rollback do host antes de remoto. Backups precisam retenção aprovada e armazenamento protegido; nenhum backup existente foi apagado.
- SMTP remoto/webhooks continuam pendências PC07B3B. Nada deste checkpoint autoriza staging ou produção.

## Rollback e estado Git

Antes de execução, parar o operador e bloquear novas solicitações se necessário. Após exclusão técnica, **rollback de código não recupera PII** e não autoriza restaurá-la. Preservar ledger, chave de âncora, chave de correspondência, protocolo e evidências. Retomar por retry; restaurar somente em cópia isolada com reaplicação das supressões. Não apagar ledger ou reduzir gates para voltar ao build anterior. Detalhes no [runbook](PROMOVEN_CONNECT_PRIVACY_RUNBOOK.md).

Início: `master`, HEAD `8cfa7c39f59351c12bb6744f3aa5a8a11843e257`, com todas as alterações PC07B3B ainda não commitadas. Foram preservadas e ampliadas apenas nos pontos necessários do Connect. Arquivos anteriores não foram resetados. Sem commit, push, deploy, Cloud, DNS, dados reais ou mudança em Escobar/landing/leads comerciais externos/Blender. O Git final contém os trabalhos PC07B3B e PC07B3C para revisão conjunta.

### Checagem final de operação e segurança

Restore final: fase HTTP **8,06 s**, todos os indicadores Auth/Storage/Mailpit e supressão verdadeiros. Journal confirmado e âncora externa presentes; backups preservados. `privacy-worker/.local/security-evidence.json`: valores das credenciais atuais de mail/worker e chaves de privacidade ausentes do bundle/fontes versionáveis; marcadores de contato/conteúdo da fixture final ausentes dos cinco logs examinados. Arquivos privados do ledger ignorados pelo Git. `git diff --check`, sintaxe Bash e compilação Python: PASS.

Os arquivos `privacy-fixture.json` nos artefatos de ensaio contêm somente dados sintéticos para comparar origem/restore; são privados e preservados como evidência. Não são exports operacionais de titulares. Objetos temporários cobertos pelo executor são os explicitamente registrados no Storage; caches, arquivos locais baixados e cópias fora desse inventário não são declarados eliminados.

O gate executável retorna código **1 esperado**, com anonimização integral, SMTP/webhook remoto, privacidade, retenção, identificação, autorização de exclusão e tratamento de backups bloqueados. A validação sintética não altera essas autorizações.
