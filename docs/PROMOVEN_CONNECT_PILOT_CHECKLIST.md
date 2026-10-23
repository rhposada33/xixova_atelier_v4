# Promoven Connect — checklist do piloto PC-07A

Data: 23/10/2026. Marcação concluída significa validação **local sintética**, não aprovação para produção.

## Ensaio local

- [x] Serviços Connect separados por projeto/portas, sem uso de Escobar ou leads comerciais.
- [x] Organização e administrador autorizados; signup público recusado.
- [x] Roteiro por organização/projeto, links reais, progresso derivado do banco, erro/retry e vazio útil.
- [x] Dois empreendimentos e 50 unidades via prévia/confirmação de inventário.
- [x] Cinco perfis sintéticos e autorizações; dez links e dez leads atribuídos.
- [x] Dez acompanhamentos, quatro propostas e analytics com contagens verificadas.
- [x] Convite Mailpit, aceite, CRECI, ativação e revogação em E2E separado do fixture de volume.
- [x] Upload/validação/publicação de mídia e URL efêmera em E2E separado.
- [x] Regressão de login/recuperação, CSV, catálogo, links, CRM e indicadores.
- [x] SQL/RLS, tenant, privilégio, revogação e duas corridas reais de banco.
- [x] Layout 390/768/1440, teclado no menu, labels, feedback e recuperação do roteiro.
- [x] Bundle sem referências Escobar/Three.js/service_role; nenhum segredo privado adicionado ao frontend.
- [x] Nenhum commit, push, deploy, provisionamento Cloud ou alteração da landing.

Os corretores do fixture de volume são identidades sem senha de login, não cinco pessoas que realizaram onboarding. O E2E usa outra identidade e fluxo real local de e-mail. O ensaio não substitui teste com usuários. A etapa de mídia fica pendente no fixture de volume por intenção, sem registros fictícios de upload.

## Medições de uma execução concluída

Fonte: `apps/promoven-connect-web/pilot-results/pc07a.json`, organização `fdf67079-fc4d-46ea-a7d9-1af9c356b4db`, slug `pc07a-1792732011307`. Não há contatos reais. Uma execução cria um cenário; tentativas anteriores e dados de regressão são preservados em outras organizações.

| Tarefa automatizada | Tempo local |
| --- | ---: |
| Provisionar organização via RPC | 6 ms |
| Criar projetos 1 / 2 | 4 / 2 ms |
| Prévia e confirmação de 25 unidades, projetos 1 / 2 | 30 / 17 ms |
| Fixtures de cinco corretores/dez autorizações + links | 38 ms |
| Captar dez interesses atribuídos | 24 ms |
| Registrar acompanhamentos e propostas | 50 ms |
| Consultar analytics | 11 ms |

Uma amostra, Postgres local via Node, sem latência remota/SMTP humano. Não são percentis, SLA, tempo humano ou produtividade. Resultado final do script: zero erros. Preparação exigiu corrigir retorno composto SQL para JSON e atender ao contrato de área com três casas/versão esperada nula. As tentativas com falha foram revertidas transacionalmente.

A presença de mais organizações revelou testes com dependência indevida de ordem e contagem global; foram corrigidos para usar organização/ator explícitos. Um comando inicial de teste SQL foi chamado na raiz por engano, falhou na resolução de `db` e foi interrompido; execução válida ocorreu em `infra/promoven-connect`. Nenhuma migração/escrita ocorreu no outro banco. Comando npm na raiz sem package.json e `python` indisponível também falharam sem modificar dados; comandos foram corrigidos para diretório adequado e `python3`.

## Liberação futura — todos pendentes

- [ ] Responsável de produto autoriza PC-07B e orçamento.
- [ ] Controlador/privacidade aprova aviso, base legal, retenção, compartilhamento e canal de direitos.
- [ ] Operação nomeia responsáveis e ensaia acesso/exclusão de titular, inclusive histórico e backups.
- [ ] Transporte remoto de convite/Auth com TLS/API, domínio remetente e entrega validados.
- [ ] Proxy de origem/rate limit resistente a cabeçalhos falsos, expurgo e monitoramento.
- [ ] Reencode/remoção de metadados e política de segurança de uploads.
- [ ] Projeto staging próprio, sem dados reais, explicitamente autorizado.
- [ ] Configuração de segredos, DNS, TLS, redirects exatos e fallback SPA revisada.
- [ ] Teste de atualização de migrações e restauração DB + Storage; RPO/RTO medidos.
- [ ] Logs com tokens/PII removidos, alertas, responsáveis e procedimento de incidente.
- [ ] Ensaio com usuários da incorporadora, tempo humano, dificuldades e aceite documentados.
- [ ] Aprovação separada para clientes/compradores reais e para alterações na landing.

**Decisão PC-07A:** preparação local pode ser revisada; operação remota e dados reais continuam bloqueados. Não avançar automaticamente ao PC-07B.
