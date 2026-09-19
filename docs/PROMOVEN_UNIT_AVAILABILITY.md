# Disponibilidade comercial Promoven

`UnitAvailabilityMatrix` é uma demonstração visual local para a landing. Os
60 registros da matriz, seus estados, áreas, vistas e preços são gerados de
forma determinista no navegador e não consultam Supabase, o inventário do
portal nem qualquer serviço remoto.

Os totais `54 Disponíveis`, `6 Reservadas` e `12 Vendidas` são indicadores
comerciais ilustrativos independentes das 60 células visíveis. A seleção muda
apenas a ficha local; `Ver unidade` leva para `/demo` sem transportar dados da
unidade.

O bloco de vista é um gradiente CSS propositalmente abstrato. Não representa
uma fotografia, empreendimento ou localização real e pode ser substituído por
um ativo aprovado em uma iteração futura.
