# Contratos independentes de inventário Connect

Este pacote contém apenas trabalho local de PC-02 que não depende de PC-01: tipos, normalização de código e decimal, projeção de apresentação e leitura/prévia de CSV. Nenhuma função aqui autentica usuários, consulta o banco ou confirma importações. A projeção pública só pode ser usada após o servidor selecionar e autorizar dados; não substitui RLS nem uma view segura.

```bash
cd packages/connect-contracts
npm ci
npm run typecheck
npm test
```

CSV: UTF-8, até 2 MiB e 2.000 linhas de dados; cabeçalho e ordem fixos em `CSV_COLUMNS`; separador `;` ou `,`; aspas conforme RFC 4180. A memória de leitura é limitada pelo tamanho máximo. Códigos são aparados e convertidos para maiúsculas ASCII (`A-Z`, `0-9`, `_`, `-`); duplicatas após normalização são erro. Decimal canônico usa ponto e até duas casas para BRL, três para área; também se aceita vírgula decimal brasileira e agrupamento brasileiro completo (`1.250.000,90`). Valores ambíguos ou precisão maior que a permitida são rejeitados. `expected_version` é obrigatório na confirmação de alterações existentes, embora a prévia mostre conflito antes disso.

Uma importação só pode seguir à confirmação se `canConfirmPreview` retornar `true`. Mesmo nesse caso, o servidor PC-02 futuro precisa recalcular hash, diff, versões, tenant e autorização dentro da transação; nunca confiar na prévia do browser. O modelo CSV não altera banco e não implementa upload para Storage.
