# Promoven Connect — custos e quotas PC-07C.1

Pesquisa pública em 23/10/2026. USD/mês; sem impostos, câmbio, domínio, mão de obra, suporte premium, excedentes ou SLA. **Nenhuma contratação. Nenhum preço de conta/slot disponível foi confirmado.** Tarifas públicas confirmadas abaixo são diferentes de capacidade contratada ou fatura real.

## Tarifas públicas e limites

| Item | Referência pública consultada | Limites / observações | Estado da conta |
| --- | --- | --- | --- |
| Vercel Pro | US$20/mês base; developer seat US$20/mês; crédito de uso US$20. [Pricing](https://vercel.com/pricing) | Um operador na estimativa; adicionar assentos/uso. Password Protection é adicional de US$20/projeto/mês na tabela; não incluído nas somas abaixo. Demo deve usar restrição de acesso própria/validada | UNKNOWN plano, assentos, domínios, consumo e proteção contratada |
| Vercel Hobby | US$0, elegibilidade limitada. [Hobby](https://vercel.com/docs/plans/hobby) | Uso pessoal não comercial; não adotado como premissa para este produto | UNKNOWN elegibilidade, sem contar crédito/slot |
| Supabase Free | 2 projetos ativos na franquia; 500 MB DB, 1 GB Storage, 5 GB egress + 5 GB cached egress; pausa por inatividade. [Pricing](https://supabase.com/pricing) | Não usar como base de backup/continuidade de demo comercial. [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase) explica contagem entre organizações de owner/admin | UNKNOWN projetos ativos/pausados e disponibilidade; **não presumir slot gratuito** |
| Supabase Pro | A partir de US$25/mês com crédito compute para primeiro Micro; projeto Micro adicional ~US$10/mês. 8 GB disco/projeto, 100 GB Storage, 250 GB egress + 250 GB cached, 100k MAU, backup diário 7 dias. [Pricing](https://supabase.com/pricing) | Franquias/compute por organização/projeto precisam simulação específica; funções privadas da arquitetura atual não são resolvidas por contratar Pro | UNKNOWN plano, projetos, quotas, créditos e região |
| VM DigitalOcean Basic | 4 GiB/2 vCPU US$24; 8 GiB/4 vCPU US$48; 16 GiB/8 vCPU US$96. [Droplets](https://www.digitalocean.com/pricing/droplets) | 8 GiB inclui 160 GiB SSD/5.000 GiB transferência; 16 GiB 320 GiB/6.000 GiB. Hipótese de dimensionamento, sem benchmark remoto | UNKNOWN quota de Droplets/vCPU, região, estoque e cartão |
| SMTP Resend | Free 3.000/mês, 100/dia; Pro US$20/50.000/mês, excedente US$0,90/1.000. [Pricing](https://resend.com/pricing) | Produção exige domínio/remetente, TLS, entrega, callback e reconciliação validados; nenhuma conta consultada nem e-mail enviado | UNKNOWN conta, verificação de domínio, limite efetivo, reputação |
| Backup R2 Standard | US$0,015/GB-mês; operações A US$4,50/milhão, B US$0,36/milhão; egress Internet sem tarifa R2. [Pricing](https://developers.cloudflare.com/r2/pricing/) | 100 GB médios ≈ US$1,50 só armazenamento; acrescentar operações, versões, ledger, chaves e tráfego cobrado na origem. Reserva abaixo é estimativa, não preço de pacote de backup | UNKNOWN conta, buckets, créditos, retenção e mecanismo de imutabilidade |

Backup de DB Supabase não inclui arquivos do Storage: planejar cópia dos objetos e restore conjunto. [Backups](https://supabase.com/docs/guides/platform/backups). Não confundir snapshots de VM com recuperação consistente de DB/Storage/outbox/journal.

## Cenários comparáveis (estimativas, não cotações)

| Cenário / hipótese | Compute | Frontend | SMTP externo | Reserva backup | Monitoramento | Total estimado |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Demo mínima fechada, self-hosted VM 8 GiB, frontend na VM, Mailpit | 48 | 0 incremental | 0 | 5 | 0, ferramentas no host | **53** |
| Mesma demo com frontend Vercel Pro separado | 48 | 20 | 0 | 5 | 0 | **73** |
| Staging operacional self-hosted 8 GiB, Vercel, Mailpit, backup e alerta externo | 48 | 20 | 0 | 10 | 10–20 | **88–98** |
| Produção inicial sem HA: VM 16 GiB + VM workers 4 GiB, Vercel, SMTP Pro | 96 + 24 | 20 | 20 | 15–30 | 20–40 | **195–230** |
| Alternativa demo Cloud Pro + runtime privado VM 4 GiB + Vercel | 25 + 24 | 20 | 0 | 5–10 | 0–10 | **74–89**, mais adaptação de engenharia |

Nos cenários self-hosted não somar Supabase Pro: DB/Auth/Storage estão na VM. Infra de staging mantida junto à produção acrescenta seu custo integral; não reutilizar a base. Se o mecanismo de demo depender do Password Protection Vercel, acrescentar US$20/projeto/mês e confirmar que também cobre APIs externas; sozinho ele não protege um proxy/API em outro host. VPN/controle de acesso requer configuração e validação, mesmo quando não há tarifa incremental.

Produção acima não promete alta disponibilidade; HA/PITR gerenciado, réplica, load balancer e operação 24h exigem orçamento separado. Os cenários não incluem eventual antivírus, WORM/serviço de segredos dedicado, observabilidade premium ou transferência do fornecedor de origem. Reservas de backup/monitoramento são margens de planejamento. A base antiga US$45/mês (Vercel+Supabase) **não cobre** proxy, Sharp, mail workers nem contrato de isolamento.

## Quotas a confirmar antes de PC-07C.2

Não havia conector de administração Supabase/Vercel/DO/R2/SMTP disponível nesta sessão. Não foram lidos arquivos globais de login nem executados CLIs autenticados remotos. Consulta pública de preços não comprova recursos da conta.

Operador autorizado deve registrar, sem tokens: organização/projeto e titular, plano/região, número de projetos ativos, limite de compute/egress/Storage/MAU/Edge, assentos, domínios e proteção de previews, quota VM/vCPU, buckets/backup, limite de SMTP/remetentes e orçamento aprovado. Usar consoles em leitura ou export oficial sanitizado; registrar data, fonte e IDs explícitos no descriptor Connect. Confirmar que nenhum ID corresponde a Escobar ou leads B2B. Definir alertas 50/80/100% do orçamento, teto de gastos e ação em excedente; não habilitar upgrade automático nesta fase.
