# Runbook — privacidade e recuperação Connect

Checkpoint PC-07B.3C, local/sintético. [Cobertura e bloqueios](PROMOVEN_CONNECT_PC07B3C_STATUS.md).

## Antes de qualquer execução

1. Confirmar ambiente Connect local, UUIDs sintéticos criados pelo harness e escopo do titular/tenant. Não cadastrar dados reais em `private.privacy_fixtures`.
2. Responsável registra protocolo sem PII e verificação de identidade. Outro administrador aprova. Aprovação técnica não concede aprovação jurídica.
3. Conferir preview, versão, holds, exportações, vínculo de cada arquivo e estado de mail. Arquivo sem vínculo, mail tentado, identidade Auth, contato duplicado ou exportação externa bloqueiam o processo.
4. Verificar journal externo, ambas as chaves e head/recibos. Não incluir o journal no snapshot a ser restaurado nem sobrescrever o atual por uma cópia antiga. Manter backup separado com acesso restrito; operação remota/WORM ainda não configurada.
5. Não há agenda de retenção automática. Prazos por categoria permanecem nulos até política formal aprovada.

## Operação sintética explícita

```bash
node infra/promoven-connect/privacy-worker/main.mjs REQUEST_UUID REQUESTER_UUID
```

Aceita apenas fixture previamente registrada e aprovada; quem aprovou não executa. O operador local usa a role SQL limitada, Storage administrativo no servidor e endpoints fixos locais. Não imprimir env, bodies, contatos, chaves, dumps ou respostas de exportação.

Estados: solicitada → identidade verificada → revisão aprovada → preparado/congelado → concluído. Em falha de Storage/ledger/SQL, parar e verificar código sanitizado; repetir **o mesmo UUID** após correção. Não trocar o ID para contornar erro. A fase preparada mantém o lead congelado; alguns arquivos podem já ter sido excluídos. Novo hold impede continuidade. Recursos apagados não são restaurados automaticamente.

O ledger grava intenção antes dos efeitos externos e confirmação autenticada depois do commit SQL. Falha entre commit e confirmação: retry consulta o protocolo concluído e reconcilia o recibo. Se não houver certeza, manter bloqueado. Não marcar intenção como concluída manualmente.

## Ensaiar restore

Não executar simultaneamente com E2E ou outros escritores:

```bash
CONNECT_PRIVACY_RECOVERY=1 infra/promoven-connect/ops/recovery-local.sh
```

O ensaio pausa mail workers, cria fixtures sintéticas, faz dump e cópia Storage, executa supressão da fixture na origem após o snapshot, restaura em contêiner novo, aplica o ledger externo e verifica ausência/reintrodução. Auth, Storage e Mailpit da cópia têm rede privada e credenciais locais próprias. Retoma mail workers que estavam ativos e remove somente os contêineres temporários. Backups anteriores e atuais permanecem em `ops/artifacts`.

Mesmo sem a flag, o harness de recuperação agora exige o journal externo e valida/reconcilia suas entradas confirmadas. Falta de chave/journal, adulteração, intenção pendente, protocolo ausente no snapshot ou sujeito divergente encerram o ensaio sem liberar a cópia. Um restore mais antigo que o protocolo precisa mapeamento/revisão adicional; não cadastrar informações reais para “fazer passar” o teste.

Snapshot DB e Storage não é distribuído: operação real precisaria pausar todos os escritores/uploads. Não reconectar frontend, workers comerciais ou ingressos públicos antes de concluir reaplicação e revisão das exclusões. O ensaio não autoriza substituir a origem.

## Ledger e segredos

Diretório `privacy-worker/.local/ledger`, modo 0700. SQLite, head, locks, recibos e chaves são privados. `ledger.key` serve à correspondência HMAC e tem réplica privada no DB. **`ledger.anchor.key` não vai ao banco/dump**: autentica head e recibos. Preservar as duas; não destruir keyrings de mail nem chaves de supressão para simular anonimização.

Não há rotação automática de chave: trocar a chave de correspondência invalidaria correspondências antigas sem migração apropriada; trocar a âncora exige revalidação/custódia do journal. Guardar todas as versões necessárias aos backups. O host local não oferece proteção WORM contra rollback conjunto de todos os arquivos; isso é bloqueio remoto.

## Falhas, hold e rollback

- Hold antes de início: nenhum efeito irreversível. Hold após uma falha parcial: interrompe continuidade; manter evidência e solicitar decisão autorizada sobre obrigações pendentes.
- Versão alterada: `PT409`; não forçar `expected_version`. Nova revisão operacional é necessária e não há atalho de UI para isso.
- Mail em processamento/aceito ou exportação externa: não tentar “recolher” por apagar a linha. Bloquear, inventariar destinatários/cópias e aguardar procedimento aprovado.
- Regressão de UI: voltar a build compatível sem expor execução irreversível. Manter schema, triggers, ledger e guards de supressão.
- Não executar `db reset`, remoção de backups, truncamento do journal, desativação de triggers ou restauração de PII para desfazer supressão.

## Aprovações separadas

Capacidade técnica no escopo sintético: validada. Anonimização integral, política de retenção, processo de identificação, operação real de exclusão, tratamento/custódia de backups e compradores reais: **não aprovados**. Administrador técnico não pode substituir essas decisões por alteração de um booleano em readiness.
