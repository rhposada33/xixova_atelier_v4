# Fase 3 / Checkpoint C — decisões de importação

Formato canônico: UTF-8, `;`, cabeçalho único e as colunas `unit_code`,
`building_code`, `floor_code`, `unit_type_code`, `external_reference`,
`orientation`, `view_type`, `solar_exposure`, `parking_spaces`, `price`,
`currency`, `status`, `published`, `expected_version`. Limites: 5 MiB e 1.000
linhas. O CSV original não é persistido.

Papa Parse 5.7.0 foi escolhido por funcionar no navegador, suportar RFC 4180,
arquivos locais, delimitadores, aspas, quebras de linha e não possuir dependências.
Ele fica contido no chunk lazy do portal e não entra no bundle público inicial.

O PostgreSQL calcula SHA-256 sobre a representação textual canônica do `jsonb`.
O dry-run dura 30 minutos e vincula hash, ator, organização, projeto, modo e versões.
A confirmação usa advisory lock transacional do projeto, bloqueia projeto,
referências e unidades, recalcula o hash e revalida versões. Repetir o mesmo
`operation_id` retorna o resultado concluído.

Projetos `draft` aceitam estado/preço/publicação iniciais; `reserved` permanece
sem proprietário operacional e é auditado como carga inicial. Em `ready` ou
`published`, unidades existentes só recebem campos estruturais. `archived` é
bloqueado. Mappings visuais nunca fazem parte do payload.

O PostgREST local não declara um limite de corpo específico no arquivo de
configuração; por isso os limites são aplicados tanto antes do envio quanto na
RPC. Os metadados e erros normalizados não são removidos automaticamente nesta
fase. A política de retenção deverá ser definida antes de produção.

## Detalhe e retenção

Durante a revisão inicial, a RPC devolve el resumen y los resultados normalizados;
el navegador conserva las filas normalizadas mientras la página permanece abierta.
El CSV original nunca se almacena. Al abrir directamente el detalle de una
importación, el portal muestra el resumen persistido y los errores normalizados,
pero no reconstruye todas las filas ni afirma conservar el archivo.

Política propuesta antes de staging:

- dry-runs no confirmados y errores normalizados: 30 días;
- importaciones completadas y su resumen: inicialmente 1 año, sujeto a la política
  comercial y legal aprobada;
- CSV original: nunca almacenado;
- auditoría estructural: retención independiente y no eliminada con las previews.

La limpieza automática queda fuera de este checkpoint. Estos plazos son una
política funcional propuesta; la retención legal y las obligaciones LGPD deberán
ser validadas por el responsable jurídico antes de activar cualquier eliminación.
