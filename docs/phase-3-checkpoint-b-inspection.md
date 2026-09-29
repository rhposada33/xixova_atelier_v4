# Fase 3 / Checkpoint B — inspeção e decisões estruturais

## Estado anterior à migração

As tabelas `projects`, `buildings`, `floors`, `unit_types` e `units` já formam a
hierarquia usada pelo visualizador público. A leitura pública passa exclusivamente
por `get_public_inventory`; as leituras administrativas existentes são protegidas
por RLS/RPC e as alterações comerciais passam pelas RPC da Fase 2.

Campos visuais protegidos e preservados:

- `buildings.model_path` e `buildings.default_camera_config` carregam o GLB e a câmera.
- `floors.model_object_id` identifica o objeto visual do pavimento.
- `units.model_object_id` identifica o proxy da unidade no GLB.
- `unit_types.interior_project_id` liga Garden House e Terraza Luz.
- `unit_types.floor_plan_path`, `projects.theme_config` e `projects.default_unit_code`
  continuam fora dos formulários estruturais genéricos.

As 72 unidades estão distribuídas em oito tipologias. As coberturas usam quatro
tipologias específicas; não existe variação de área, dormitórios ou suítes entre
unidades da mesma tipologia. Estacionamentos, orientação, vista e exposição solar
já são atributos da unidade. Portanto, nenhum override foi necessário.

| Atributo | Tipologia | Override de unidade | Valor efetivo |
|---|---:|---:|---|
| Área privativa | Sim | Não | `unit_types.private_area_m2` |
| Área total | Sim | Não | `unit_types.total_area_m2` |
| Dormitórios | Sim | Não | `unit_types.bedrooms` |
| Suítes | Sim | Não | `unit_types.suites` |
| Banheiros | Sim, nullable apenas para legado desconhecido | Não | `unit_types.bathrooms`; UI mostra “Não informado” quando `NULL` |
| Estacionamentos | Padrão opcional | Sim (existente) | `units.parking_spaces` |

O projeto Escobar recebe os flags públicos/visuais habilitados por backfill
identificado pelos UUIDs deterministas do projeto e da organização, nunca pelo slug.
O edifício Escobar conhecido recebe uma marca explícita de câmera existente. Projetos novos começam em `draft`, sem inventário
público e sem experiência visual. Nenhuma associação visual existente é alterada.

Não existe fonte confiável com a quantidade de banheiros por tipologia Escobar. Os
oito valores legacy permanecem `NULL`; ambientes encontrados nos interiores não
foram usados para inferir números. Novas tipologias residenciais exigem valor
explícito maior ou igual a um. Tipologias não residenciais com zero exigirão um
tipo de uso explícito numa fase futura; esta UI cria somente tipologias residenciais.

Enquanto a API pública continuar recebendo `organization_slug` e `project_slug`, o
slug de projeto é globalmente único. Uma futura versão poderá migrar para URLs
hierárquicas sem esta restrição, preservando redirects.

## Preparação e publicação

`ready` exige organização ativa, campos essenciais, moeda/fuso válidos, pelo menos
um edifício, piso, tipologia e unidade válidos e ativos, referências coerentes e
atributos residenciais conhecidos. Não exige GLB, proxy, câmera ou interior.

| Organização | Projeto | Inventário habilitado | Unidade publicada | Visível publicamente |
|---|---|---:|---:|---:|
| ativa | published | sim | sim | sim |
| ativa | published | não | qualquer | não |
| ativa | draft/ready/archived | qualquer | qualquer | não |
| draft/suspended/archived | qualquer | qualquer | qualquer | não |

`visual_experience_enabled` é independente do inventário público e exige edifício
ativo, modelo não placeholder, câmera marcada como válida e proxies não vazios nem
duplicados para as unidades publicadas. Desabilitar capacidades nunca apaga mappings.

Editar atributos herdados de uma tipologia usada exige confirmação do impacto. A
RPC bloqueia a tipologia e unidades relacionadas, verifica `expected_version` e
registra uma única auditoria estrutural com `affected_units`.
