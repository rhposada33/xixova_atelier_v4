# Promoven Connect — aprovação futura de staging PC-07C.2

23/10/2026. **NÃO APROVADO. Documento para revisão; nenhuma assinatura/consentimento foi inferido.** PC-07C.1 autoriza verificações locais, não criação de recursos, publicação ou dados reais.

## Escopo proposto, concreto para revisão

- Stack Connect exclusiva self-hosted, VM inicial 8 GiB/4 vCPU, sem tocar `www`, Escobar, leads comerciais ou Blender.
- Demo fechada com VPN/ingresso restrito em todos os serviços e rotas; uma incorporadora, dois projetos, 50 unidades, cinco corretores, dez links/leads, quatro propostas e imagens sintéticas normalizadas.
- SMTP apenas Mailpit privado sem relay, sem destinatários externos. Sem compradores reais ou acesso público à captura.
- Base US$53/mês com frontend na VM; US$73 com Vercel separado. Staging com alertas/backup US$88–98. Ver [matriz e ressalvas](PROMOVEN_CONNECT_COST_MATRIX.md).
- Prazo/participantes/operador/região/host/fornecedor/teto de gastos: **a preencher pelo usuário**, não escolhidos nem contratados aqui.

## Duas decisões distintas

**1. Autorizar preparação PC-07C.2:** após revisão de arquitetura/custos, autorizar nominalmente quais recursos podem ser criados, em qual conta/região e teto; registrar referência da mensagem do usuário. Isso não torna a demo acessível nem libera produção. `check-release.mjs` não executa provisionamento e continua bloqueando abertura enquanto faltarem verificações remotas.

**2. Autorizar abertura da demo:** infraestrutura preparada sob a decisão 1, evidências remotas negativas/positivas revisadas, orçamento e participantes confirmados; aprovação vinculada ao alvo, HEAD, digest das fontes e validade de no máximo sete dias. Só então o gate de staging pode ser verdadeiro. Produção requer aprovação independente e todos os requisitos adicionais. Não preencher booleans para contornar evidências.

## Checklist PC-07C.2

- [ ] Usuário escolheu self-hosted ou alternativa e autorizou explicitamente recursos/custos/contas por escrito.
- [ ] Conferir quotas em leitura e registrar IDs permitidos; `approvedTargets` contém somente Connect, nunca Escobar/B2B.
- [ ] Congelar revisão de código, lockfiles, imagens por digest e versões; commit/tag apenas se autorizado separadamente. Reexecutar preflight contra a revisão exata.
- [ ] Implementar/ensaiar modo `staging-synthetic` explícito, runtime próprio e SMTP sink; remover nenhuma trava por fingir ambiente local.
- [ ] Criar infraestrutura **somente após decisão 1**, com volumes/segredos independentes e plano de remoção de recursos nominal.
- [ ] TLS direto no proxy ou peer autenticado implementado/testado; nenhuma confiança em header externo; rede Edge privada e rota Kong negada.
- [ ] Auth signup fechado, participantes allowlisted, redirects exatos, tokens/serviços próprios, Storage privado; demo fechada também em `/s/*`, Auth/REST e proxy.
- [ ] Validar CSP e CORS nos hosts finais, SPA/fallback/cache/no-store/Referrer Policy; sem wildcard de preview ou origem.
- [ ] Repetir HTTP real: quatro funções, bypass de outra rede, HMAC/método/path/body/timestamp, duas réplicas/rate/restart, limiter/backend down, timeout, CORS, sanitização.
- [ ] Aplicar migrações locais já ensaiadas no alvo autorizado, com backup/ledger e janela de escrita; não copiar DB local nem chaves locais.
- [ ] Seed exclusivamente sintético por APIs/RPCs; upload normalizado, outbox/Mailpit, CRM/analytics e revogação.
- [ ] Backup remoto DB+objetos+keyring e journal externo atual, restore isolado Auth/Storage/supressões; alertas acionados por falha sintética.
- [ ] Confirmar egress sem SMTP externo; credenciais reais ausentes; política de logs sem tokens/contatos, expiração de acesso da demo.
- [ ] Registrar evidências sanitizadas por alvo/digest, referências de autorização, custos e rollback; aprovação 2 explícita antes de abrir acesso.
- [ ] Encerrar/revogar demo no prazo acordado; conservar ou descartar apenas fixtures conforme decisão registrada.

## Gates independentes

| Staging sintético | Produção adicional |
| --- | --- |
| Auth restrito, fixtures, isolamento/RLS, rede/proxy/HMAC, TLS, backups, monitoramento básico, captura restrita, e-mail externo bloqueado, custos, CSP/CORS e aprovação staging | Política de privacidade, base legal/responsabilidades, retenção, direitos/identificação do titular, anonimização integral no escopo declarado, SMTP/entrega/webhooks, tratamento de backup remoto, suporte, incidentes, autorização comercial e aprovação produção |

Produção não depende de Mailpit nem exige que toda coleta real esteja bloqueada; staging não depende de SMTP externo, política comercial definitiva ou eliminação de cópias reais externas. Local-only e ausência de recursos remotos continuam bloqueios de staging. Verificador apresenta três valores separados: `syntheticStagingReady`, `productionReady`, `realBuyerDataAllowed`.

`readiness.json` conserva gates históricos como histórico, mas eles não liberam deployment. O modelo v2 usa relatórios PASS com hash, data, escopo e alvo; fontes atuais precisam corresponder e evidências vencem em sete dias. Aprovação registra environment/target/head/sourceDigest, referência verificável da mensagem do usuário, approvedAt/expiresAt; produção exige ainda `realBuyerDataAuthorized: true`. Campos approval/evidence não entram no digest para evitar referência circular; targets e demais configurações entram. Registro editável não é assinatura criptográfica humana: revisão do responsável e branch protegida/CI futura precisam conferir a autorização original. O verificador não é autorização para este agente publicar.

## Rollback proposto

Fechar ingresso; parar dispatch e escritores; manter banco, objetos, outbox e ledger; voltar apenas artifacts/imagens compatíveis. Corrigir migração por compensação revisada. Restore somente em cópia, reaplicando journal externo atual antes de servir. Nunca reabrir rota de bypass ou apagar ledger. Para encerrar custo, remover apenas recursos Connect identificados, após aprovação e confirmação de backup; nenhuma remoção automática nesta fase. DNS `www` nunca participa deste rollback.
