# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: marketing.spec.ts >> Terraza Luz mostra imagem local e abre a maqueta correta
- Location: tests/marketing.spec.ts:106:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: /Terraza Luz/ })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - link "Pular para o conteúdo" [ref=e4] [cursor=pointer]:
    - /url: "#conteudo"
  - banner [ref=e5]:
    - link "Promoven, início" [ref=e6] [cursor=pointer]:
      - /url: /
      - generic [ref=e7]: P
      - generic [ref=e8]:
        - text: PROMOVEN
        - generic [ref=e9]: Experiências imobiliárias
    - navigation "Navegação principal" [ref=e10]:
      - link "Benefícios" [ref=e11] [cursor=pointer]:
        - /url: "#beneficios"
      - link "Agendar demonstração" [ref=e12] [cursor=pointer]:
        - /url: "#contato"
      - link "Explorar plataforma" [ref=e13] [cursor=pointer]:
        - /url: /demo
  - main [ref=e14]:
    - generic [ref=e15]:
      - generic [ref=e16]:
        - paragraph [ref=e17]: Tecnologia para apresentações imobiliárias
        - heading "Transforme empreendimentos em experiências de compra" [level=1] [ref=e18]
        - paragraph [ref=e19]: Apresente o edifício, conecte a disponibilidade das unidades e ofereça à sua equipe comercial uma plataforma preparada para vender lançamentos.
        - generic [ref=e20]:
          - link "Agendar uma apresentação" [ref=e21] [cursor=pointer]:
            - /url: "#contato"
          - link "Explorar demonstração ↗" [ref=e22] [cursor=pointer]:
            - /url: /demo
            - text: Explorar demonstração
            - generic [ref=e23]: ↗
      - generic [ref=e24]:
        - img "Ilustração em perspectiva dos ambientes internos de um apartamento" [ref=e25]
        - group "Imagens ilustrativas do empreendimento" [ref=e26]:
          - button "Interior" [pressed] [ref=e27] [cursor=pointer]
          - button "Edifício" [ref=e28] [cursor=pointer]
        - generic [ref=e29]: Imagens ilustrativas
    - generic [ref=e30]:
      - generic [ref=e31]:
        - paragraph [ref=e32]: Clareza para decidir
        - heading "Mais do que visualizar. É entender como será viver ali." [level=2] [ref=e33]
      - generic [ref=e34]:
        - paragraph [ref=e35]: Uma planta deixa de ser apenas um desenho. O cliente pode conhecer o edifício, encontrar unidades disponíveis, analisar iluminação, explorar ambientes e avançar para uma proposta comercial.
        - list [ref=e36]:
          - listitem [ref=e37]: ✓Apresentação mais envolvente
          - listitem [ref=e38]: ✓Decisões de compra mais claras
          - listitem [ref=e39]: ✓Inventário conectado à experiência
          - listitem [ref=e40]: ✓Atendimento comercial mais eficiente
    - region [ref=e41]:
      - generic [ref=e42]:
        - paragraph [ref=e43]: Ilustração de iluminação
        - heading "Iluminação ao longo do dia" [level=2] [ref=e44]
        - paragraph [ref=e45]: Acompanhe, de forma ilustrativa, como diferentes momentos transformam a atmosfera do empreendimento.
        - group "Escolha um momento do dia" [ref=e46]:
          - button "Manhã" [pressed] [ref=e48] [cursor=pointer]
          - button "Meio-dia" [ref=e50] [cursor=pointer]
          - button "Entardecer" [ref=e52] [cursor=pointer]
          - button "Noite" [ref=e54] [cursor=pointer]
        - button "Pausar rotação dos momentos do dia" [ref=e57] [cursor=pointer]: Ⅱ
        - link "Explorar demonstração ↗" [ref=e59] [cursor=pointer]:
          - /url: /demo
          - text: Explorar demonstração
          - generic [ref=e60]: ↗
      - generic [ref=e61]:
        - img "Edifício residencial ilustrativo Promoven em uma manhã clara, com luz suave e céu azul." [ref=e64]
        - generic [ref=e65]: Imagens meramente ilustrativas.
    - region [ref=e66]:
      - generic [ref=e67]:
        - generic [ref=e68]:
          - paragraph [ref=e69]: Disponibilidade comercial
          - heading "Encontre a unidade certa" [level=2] [ref=e70]
          - paragraph [ref=e71]: Consulte disponibilidade, compare características e localize cada unidade por pavimento.
          - generic "Resumo ilustrativo de disponibilidade" [ref=e72]:
            - article [ref=e73]:
              - strong [ref=e74]: "54"
              - generic [ref=e75]: Disponíveis
            - article [ref=e76]:
              - strong [ref=e77]: "6"
              - generic [ref=e78]: Reservadas
            - article [ref=e79]:
              - strong [ref=e80]: "12"
              - generic [ref=e81]: Vendidas
          - 'note "Filtros ilustrativos: todas as unidades" [ref=e82]':
            - generic [ref=e83]:
              - generic [aria-hidden] [ref=e84]: ☷
              - text: Filtrar unidades
            - generic [ref=e85]: Todas ⌄
          - table [ref=e86]:
            - caption [ref=e87]: Exemplo de unidades por disponibilidade
            - rowgroup [ref=e88]:
              - row [ref=e89]:
                - columnheader "Unidade" [ref=e90]
                - columnheader "Área" [ref=e91]
                - columnheader "Quartos" [ref=e92]
                - columnheader "Status" [ref=e93]
            - rowgroup [ref=e94]:
              - row [ref=e95]:
                - cell "1201" [ref=e96]
                - cell "84 m²" [ref=e97]
                - cell "2" [ref=e98]
                - cell "Disponível" [ref=e99]
              - row [ref=e101]:
                - cell "1202" [ref=e102]
                - cell "84 m²" [ref=e103]
                - cell "2" [ref=e104]
                - cell "Reservada" [ref=e105]
              - row [ref=e107]:
                - cell "1203" [ref=e108]
                - cell "104 m²" [ref=e109]
                - cell "3" [ref=e110]
                - cell "Reservada" [ref=e111]
              - row [ref=e113]:
                - cell "1204" [ref=e114]
                - cell "126 m²" [ref=e115]
                - cell "4" [ref=e116]
                - cell "Vendida" [ref=e117]
        - generic [ref=e119]:
          - heading "Disponibilidade por pavimento" [level=3] [ref=e120]
          - generic "Legenda de status" [ref=e121]:
            - generic [ref=e122]: Disponível
            - generic [ref=e123]: Reservada
            - generic [ref=e124]: Vendida
          - group "Matriz ilustrativa de unidades por pavimento" [ref=e126]:
            - generic [ref=e127]:
              - generic [ref=e128]: 15º
              - button "Unidade 1501, 15º pavimento, Reservada" [ref=e129] [cursor=pointer]:
                - text: "1501"
                - generic [ref=e130]: — Reservada
              - button "Unidade 1502, 15º pavimento, Reservada" [ref=e131] [cursor=pointer]:
                - text: "1502"
                - generic [ref=e132]: — Reservada
              - button "Unidade 1503, 15º pavimento, Vendida" [ref=e133] [cursor=pointer]:
                - text: "1503"
                - generic [ref=e134]: — Vendida
              - button "Unidade 1504, 15º pavimento, Vendida" [ref=e135] [cursor=pointer]:
                - text: "1504"
                - generic [ref=e136]: — Vendida
            - generic [ref=e137]:
              - generic [ref=e138]: 14º
              - button "Unidade 1401, 14º pavimento, Vendida" [ref=e139] [cursor=pointer]:
                - text: "1401"
                - generic [ref=e140]: — Vendida
              - button "Unidade 1402, 14º pavimento, Disponível" [ref=e141] [cursor=pointer]:
                - text: "1402"
                - generic [ref=e142]: — Disponível
              - button "Unidade 1403, 14º pavimento, Disponível" [ref=e143] [cursor=pointer]:
                - text: "1403"
                - generic [ref=e144]: — Disponível
              - button "Unidade 1404, 14º pavimento, Disponível" [ref=e145] [cursor=pointer]:
                - text: "1404"
                - generic [ref=e146]: — Disponível
            - generic [ref=e147]:
              - generic [ref=e148]: 13º
              - button "Unidade 1301, 13º pavimento, Disponível" [ref=e149] [cursor=pointer]:
                - text: "1301"
                - generic [ref=e150]: — Disponível
              - button "Unidade 1302, 13º pavimento, Disponível" [ref=e151] [cursor=pointer]:
                - text: "1302"
                - generic [ref=e152]: — Disponível
              - button "Unidade 1303, 13º pavimento, Disponível" [ref=e153] [cursor=pointer]:
                - text: "1303"
                - generic [ref=e154]: — Disponível
              - button "Unidade 1304, 13º pavimento, Disponível" [ref=e155] [cursor=pointer]:
                - text: "1304"
                - generic [ref=e156]: — Disponível
            - generic [ref=e157]:
              - generic [ref=e158]: 12º
              - button "Unidade 1201, 12º pavimento, Disponível" [pressed] [ref=e159] [cursor=pointer]:
                - text: "1201"
                - generic [ref=e160]: — Disponível
              - button "Unidade 1202, 12º pavimento, Reservada" [ref=e161] [cursor=pointer]:
                - text: "1202"
                - generic [ref=e162]: — Reservada
              - button "Unidade 1203, 12º pavimento, Reservada" [ref=e163] [cursor=pointer]:
                - text: "1203"
                - generic [ref=e164]: — Reservada
              - button "Unidade 1204, 12º pavimento, Vendida" [ref=e165] [cursor=pointer]:
                - text: "1204"
                - generic [ref=e166]: — Vendida
            - generic [ref=e167]:
              - generic [ref=e168]: 11º
              - button "Unidade 1101, 11º pavimento, Vendida" [ref=e169] [cursor=pointer]:
                - text: "1101"
                - generic [ref=e170]: — Vendida
              - button "Unidade 1102, 11º pavimento, Vendida" [ref=e171] [cursor=pointer]:
                - text: "1102"
                - generic [ref=e172]: — Vendida
              - button "Unidade 1103, 11º pavimento, Disponível" [ref=e173] [cursor=pointer]:
                - text: "1103"
                - generic [ref=e174]: — Disponível
              - button "Unidade 1104, 11º pavimento, Disponível" [ref=e175] [cursor=pointer]:
                - text: "1104"
                - generic [ref=e176]: — Disponível
            - generic [ref=e177]:
              - generic [ref=e178]: 10º
              - button "Unidade 1001, 10º pavimento, Disponível" [ref=e179] [cursor=pointer]:
                - text: "1001"
                - generic [ref=e180]: — Disponível
              - button "Unidade 1002, 10º pavimento, Disponível" [ref=e181] [cursor=pointer]:
                - text: "1002"
                - generic [ref=e182]: — Disponível
              - button "Unidade 1003, 10º pavimento, Disponível" [ref=e183] [cursor=pointer]:
                - text: "1003"
                - generic [ref=e184]: — Disponível
              - button "Unidade 1004, 10º pavimento, Disponível" [ref=e185] [cursor=pointer]:
                - text: "1004"
                - generic [ref=e186]: — Disponível
            - generic [ref=e187]:
              - generic [ref=e188]: 9º
              - button "Unidade 901, 9º pavimento, Disponível" [ref=e189] [cursor=pointer]:
                - text: "901"
                - generic [ref=e190]: — Disponível
              - button "Unidade 902, 9º pavimento, Disponível" [ref=e191] [cursor=pointer]:
                - text: "902"
                - generic [ref=e192]: — Disponível
              - button "Unidade 903, 9º pavimento, Reservada" [ref=e193] [cursor=pointer]:
                - text: "903"
                - generic [ref=e194]: — Reservada
              - button "Unidade 904, 9º pavimento, Reservada" [ref=e195] [cursor=pointer]:
                - text: "904"
                - generic [ref=e196]: — Reservada
            - generic [ref=e197]:
              - generic [ref=e198]: 8º
              - button "Unidade 801, 8º pavimento, Reservada" [ref=e199] [cursor=pointer]:
                - text: "801"
                - generic [ref=e200]: — Reservada
              - button "Unidade 802, 8º pavimento, Vendida" [ref=e201] [cursor=pointer]:
                - text: "802"
                - generic [ref=e202]: — Vendida
              - button "Unidade 803, 8º pavimento, Vendida" [ref=e203] [cursor=pointer]:
                - text: "803"
                - generic [ref=e204]: — Vendida
              - button "Unidade 804, 8º pavimento, Disponível" [ref=e205] [cursor=pointer]:
                - text: "804"
                - generic [ref=e206]: — Disponível
            - generic [ref=e207]:
              - generic [ref=e208]: 7º
              - button "Unidade 701, 7º pavimento, Disponível" [ref=e209] [cursor=pointer]:
                - text: "701"
                - generic [ref=e210]: — Disponível
              - button "Unidade 702, 7º pavimento, Disponível" [ref=e211] [cursor=pointer]:
                - text: "702"
                - generic [ref=e212]: — Disponível
              - button "Unidade 703, 7º pavimento, Disponível" [ref=e213] [cursor=pointer]:
                - text: "703"
                - generic [ref=e214]: — Disponível
              - button "Unidade 704, 7º pavimento, Disponível" [ref=e215] [cursor=pointer]:
                - text: "704"
                - generic [ref=e216]: — Disponível
            - generic [ref=e217]:
              - generic [ref=e218]: 6º
              - button "Unidade 601, 6º pavimento, Disponível" [ref=e219] [cursor=pointer]:
                - text: "601"
                - generic [ref=e220]: — Disponível
              - button "Unidade 602, 6º pavimento, Disponível" [ref=e221] [cursor=pointer]:
                - text: "602"
                - generic [ref=e222]: — Disponível
              - button "Unidade 603, 6º pavimento, Disponível" [ref=e223] [cursor=pointer]:
                - text: "603"
                - generic [ref=e224]: — Disponível
              - button "Unidade 604, 6º pavimento, Reservada" [ref=e225] [cursor=pointer]:
                - text: "604"
                - generic [ref=e226]: — Reservada
            - generic [ref=e227]:
              - generic [ref=e228]: 5º
              - button "Unidade 501, 5º pavimento, Reservada" [ref=e229] [cursor=pointer]:
                - text: "501"
                - generic [ref=e230]: — Reservada
              - button "Unidade 502, 5º pavimento, Reservada" [ref=e231] [cursor=pointer]:
                - text: "502"
                - generic [ref=e232]: — Reservada
              - button "Unidade 503, 5º pavimento, Vendida" [ref=e233] [cursor=pointer]:
                - text: "503"
                - generic [ref=e234]: — Vendida
              - button "Unidade 504, 5º pavimento, Vendida" [ref=e235] [cursor=pointer]:
                - text: "504"
                - generic [ref=e236]: — Vendida
            - generic [ref=e237]:
              - generic [ref=e238]: 4º
              - button "Unidade 401, 4º pavimento, Vendida" [ref=e239] [cursor=pointer]:
                - text: "401"
                - generic [ref=e240]: — Vendida
              - button "Unidade 402, 4º pavimento, Disponível" [ref=e241] [cursor=pointer]:
                - text: "402"
                - generic [ref=e242]: — Disponível
              - button "Unidade 403, 4º pavimento, Disponível" [ref=e243] [cursor=pointer]:
                - text: "403"
                - generic [ref=e244]: — Disponível
              - button "Unidade 404, 4º pavimento, Disponível" [ref=e245] [cursor=pointer]:
                - text: "404"
                - generic [ref=e246]: — Disponível
            - generic [ref=e247]:
              - generic [ref=e248]: 3º
              - button "Unidade 301, 3º pavimento, Disponível" [ref=e249] [cursor=pointer]:
                - text: "301"
                - generic [ref=e250]: — Disponível
              - button "Unidade 302, 3º pavimento, Disponível" [ref=e251] [cursor=pointer]:
                - text: "302"
                - generic [ref=e252]: — Disponível
              - button "Unidade 303, 3º pavimento, Disponível" [ref=e253] [cursor=pointer]:
                - text: "303"
                - generic [ref=e254]: — Disponível
              - button "Unidade 304, 3º pavimento, Disponível" [ref=e255] [cursor=pointer]:
                - text: "304"
                - generic [ref=e256]: — Disponível
            - generic [ref=e257]:
              - generic [ref=e258]: 2º
              - button "Unidade 201, 2º pavimento, Disponível" [ref=e259] [cursor=pointer]:
                - text: "201"
                - generic [ref=e260]: — Disponível
              - button "Unidade 202, 2º pavimento, Reservada" [ref=e261] [cursor=pointer]:
                - text: "202"
                - generic [ref=e262]: — Reservada
              - button "Unidade 203, 2º pavimento, Reservada" [ref=e263] [cursor=pointer]:
                - text: "203"
                - generic [ref=e264]: — Reservada
              - button "Unidade 204, 2º pavimento, Vendida" [ref=e265] [cursor=pointer]:
                - text: "204"
                - generic [ref=e266]: — Vendida
            - generic [ref=e267]:
              - generic [ref=e268]: 1º
              - button "Unidade 101, 1º pavimento, Vendida" [ref=e269] [cursor=pointer]:
                - text: "101"
                - generic [ref=e270]: — Vendida
              - button "Unidade 102, 1º pavimento, Vendida" [ref=e271] [cursor=pointer]:
                - text: "102"
                - generic [ref=e272]: — Vendida
              - button "Unidade 103, 1º pavimento, Disponível" [ref=e273] [cursor=pointer]:
                - text: "103"
                - generic [ref=e274]: — Disponível
              - button "Unidade 104, 1º pavimento, Disponível" [ref=e275] [cursor=pointer]:
                - text: "104"
                - generic [ref=e276]: — Disponível
        - article "Detalhes da unidade 1201" [ref=e277]:
          - generic [ref=e278]:
            - generic [ref=e279]:
              - heading "Unidade 1201" [level=3] [ref=e280]
              - paragraph [ref=e281]: 12º pavimento · 84 m²
            - strong [ref=e282]: R$ 1.460.000
          - generic [ref=e283]:
            - paragraph [ref=e284]: Disponível
            - paragraph [ref=e285]: 2 dormitórios · Vista mar
            - generic [ref=e286]:
              - img "Vista ilustrativa de uma baía e cidade costeira vista de uma varanda" [ref=e287]
              - generic [ref=e288]: Vista mar ilustrativa
            - link "Ver unidade →" [ref=e289] [cursor=pointer]:
              - /url: /demo
              - text: Ver unidade
              - generic [ref=e290]: →
      - paragraph [ref=e291]: Dados e disponibilidade apresentados apenas para demonstração comercial.
    - region [ref=e292]:
      - generic [ref=e293]:
        - generic [ref=e294]:
          - heading [level=2] [ref=e295]:
            - text: Todo o projeto,
            - emphasis [ref=e296]: em uma sóexperiência.
          - paragraph [ref=e297]: A navegação guia o comprador desde a fachada até cada ambiente. Uma experiência coerente, precisa e pensada para a sua marca.
        - generic [ref=e298]:
          - figure [ref=e299]:
            - img "Vista completa da distribuição interior de uma residência ilustrativa" [ref=e300]
          - figure [ref=e301]:
            - img "Detalhe ilustrativo de sala integrada a uma varanda" [ref=e302]
    - generic [ref=e303]:
      - paragraph [ref=e304]: Para todo o mercado
      - heading "Criado para quem vende e para quem decide" [level=2] [ref=e305]
      - generic [ref=e306]:
        - article [ref=e307]:
          - heading "Incorporadoras e construtoras" [level=3] [ref=e308]
          - paragraph [ref=e309]: Apresente projetos, disponibilidade e diferenciais em uma experiência centralizada.
        - article [ref=e310]:
          - heading "Imobiliárias e corretores" [level=3] [ref=e311]
          - paragraph [ref=e312]: Conduza atendimentos mais claros, envolventes e personalizados.
        - article [ref=e313]:
          - heading "Compradores" [level=3] [ref=e314]
          - paragraph [ref=e315]: Explore opções e entenda cada unidade antes de tomar uma decisão.
    - generic [ref=e316]:
      - generic [ref=e317]:
        - paragraph [ref=e318]: Como funciona
        - heading "Do projeto à experiência digital" [level=2] [ref=e319]
      - list [ref=e320]:
        - listitem [ref=e321]:
          - generic [ref=e322]: "01"
          - heading "Recebemos o projeto" [level=3] [ref=e323]
          - paragraph [ref=e324]: Plantas, modelos, unidades e informações comerciais.
        - listitem [ref=e325]:
          - generic [ref=e326]: "02"
          - heading "Criamos a experiência" [level=3] [ref=e327]
          - paragraph [ref=e328]: Organizamos o empreendimento, o 3D e os recursos de venda.
        - listitem [ref=e329]:
          - generic [ref=e330]: "03"
          - heading "Sua equipe começa a apresentar" [level=3] [ref=e331]
          - paragraph [ref=e332]: A plataforma fica pronta para demonstrações e atendimento comercial.
    - generic [ref=e333]:
      - generic [ref=e334]:
        - paragraph [ref=e335]: Avaliação inicial
        - heading "Vamos avaliar o seu próximo lançamento?" [level=2] [ref=e336]
        - paragraph [ref=e337]: Envie as informações básicas do empreendimento e receba uma avaliação inicial da viabilidade da experiência 3D.
        - list [ref=e338]:
          - listitem [ref=e339]: ✓Entenda os materiais necessários
          - listitem [ref=e340]: ✓Alinhe escopo e momento comercial
          - listitem [ref=e341]: ✓Planeje uma apresentação mais clara
      - generic [ref=e342]:
        - generic [ref=e343]:
          - generic [ref=e344]:
            - generic [ref=e345]: Nome
            - textbox "Nome" [ref=e346]
          - generic [ref=e347]:
            - generic [ref=e348]: Empresa
            - textbox "Empresa" [ref=e349]
          - generic [ref=e350]:
            - generic [ref=e351]: Cargo
            - combobox "Cargo" [ref=e352]:
              - option "Selecione (opcional)" [selected]
              - option "Diretor(a)"
              - option "Gerente comercial"
              - option "Marketing"
              - option "Vendas"
              - option "Produto / Tecnologia"
              - option "Arquiteto(a)"
              - option "Outro"
          - generic [ref=e353]:
            - generic [ref=e354]: Cidade / UF
            - textbox "Cidade / UF" [ref=e355]
          - generic [ref=e356]:
            - generic [ref=e357]: WhatsApp
            - textbox "WhatsApp" [ref=e358]:
              - /placeholder: +55 (11) 99999-9999
          - generic [ref=e359]:
            - generic [ref=e360]: E-mail corporativo
            - textbox "E-mail corporativo" [ref=e361]:
              - /placeholder: nome@empresa.com.br
          - paragraph [ref=e362]: Informe pelo menos um meio de contato.
          - generic [ref=e363]:
            - generic [ref=e364]: Número de unidades
            - combobox "Número de unidades" [ref=e365]:
              - option "Selecione" [selected]
              - option "Até 30"
              - option "31 a 80"
              - option "81 a 150"
              - option "151 a 300"
              - option "Mais de 300"
              - option "Ainda não definido"
          - generic [ref=e366]:
            - generic [ref=e367]: Previsão de lançamento
            - combobox "Previsão de lançamento" [ref=e368]:
              - option "Selecione" [selected]
              - option "Até 3 meses"
              - option "De 3 a 6 meses"
              - option "De 6 a 12 meses"
              - option "Mais de 12 meses"
              - option "Empreendimento já lançado"
              - option "Ainda não definido"
          - generic [ref=e369]:
            - generic [ref=e370]: Possui modelo 3D?
            - combobox "Possui modelo 3D?" [ref=e371]:
              - option "Selecione" [selected]
              - option "Sim, pronto para uso"
              - option "Sim, mas precisa ser avaliado"
              - option "Ainda não"
              - option "Não sei informar"
          - generic [ref=e372]:
            - generic [ref=e373]: Mensagem (opcional, 0/1000)
            - textbox "Mensagem (opcional, 0/1000)" [ref=e374]
        - generic [ref=e375]:
          - checkbox "Li e concordo com o uso dos meus dados para receber o contato comercial da Promoven, conforme a Política de Privacidade." [ref=e376]
          - generic [ref=e377]:
            - text: Li e concordo com o uso dos meus dados para receber o contato comercial da Promoven, conforme a
            - link "Política de Privacidade" [ref=e378] [cursor=pointer]:
              - /url: /privacidade
            - text: .
        - button "Solicitar avaliação inicial" [ref=e379]
  - contentinfo [ref=e380]:
    - link "P PROMOVEN Experiências imobiliárias" [ref=e381] [cursor=pointer]:
      - /url: /
      - generic [ref=e382]: P
      - generic [ref=e383]:
        - text: PROMOVEN
        - generic [ref=e384]: Experiências imobiliárias
    - paragraph [ref=e385]: Experiências imobiliárias interativas que transformam projetos em decisões de compra.
    - navigation "Navegação do rodapé" [ref=e386]:
      - link "Demonstração" [ref=e387] [cursor=pointer]:
        - /url: /demo
      - link "Privacidade" [ref=e388] [cursor=pointer]:
        - /url: /privacidade
    - generic [ref=e389]: © 2026 Promoven. Todos os direitos reservados.
```

# Test source

```ts
  9   |   await expect(page.locator('.hero-gallery img')).toHaveAttribute('src','/marketing/promoven-interior.jpg');
  10  |   await expect(page.getByRole('link',{name:/Explorar demonstração/}).first()).toHaveAttribute('href','/demo');
  11  | });
  12  | 
  13  | test('CTAs comerciais e formulário validam localmente sem transmissão',async({page})=>{
  14  |   await page.goto('/');
  15  |   await page.getByRole('link',{name:'Agendar uma apresentação'}).click();
  16  |   await expect(page).toHaveURL(/#contato$/);
  17  |   await expect(page.getByRole('heading',{name:'Vamos avaliar o seu próximo lançamento?'})).toBeVisible();
  18  |   await page.getByRole('button',{name:'Solicitar avaliação inicial'}).click();
  19  |   await expect(page.getByText('Informe WhatsApp ou e-mail corporativo.')).toBeVisible();
  20  |   await page.getByLabel('Nome').fill('Ana Silva');
  21  |   await page.getByLabel('Empresa').fill('Construtora Exemplo');
  22  |   await page.getByLabel('Cidade / UF').fill('São Paulo / SP');
  23  |   await page.getByLabel('E-mail corporativo').fill('ana@exemplo.com');
  24  |   await page.getByLabel('Número de unidades').selectOption({label:'31 a 80'});
  25  |   await page.getByLabel('Previsão de lançamento').selectOption({label:'De 3 a 6 meses'});
  26  |   await page.getByLabel('Possui modelo 3D?').selectOption({label:'Ainda não'});
  27  |   await page.getByRole('checkbox').check();
  28  |   await page.getByRole('button',{name:'Solicitar avaliação inicial'}).click();
  29  |   await expect(page.getByText('Validação local concluída')).toBeVisible();
  30  |   await expect(page.getByText('não foram transmitidos para a Promoven')).toBeVisible();
  31  |   await expect(page.getByRole('link',{name:'Explorar demonstração'}).last()).toHaveAttribute('href','/demo');
  32  | });
  33  | 
  34  | test('privacidade é pública e rotas privadas não são incluídas no sitemap',async({page})=>{
  35  |   await page.goto('/privacidade');
  36  |   await expect(page.getByRole('heading',{name:'Política de Privacidade'})).toBeVisible();
  37  |   const sitemap=await page.request.get('/sitemap.xml');
  38  |   const body=await sitemap.text();
  39  |   expect(body).toContain('https://www.promoven.online/privacidade');
  40  |   expect(body).not.toContain('/portal');
  41  | });
  42  | 
  43  | test('menu desliza até a seção sem ocultá-la atrás do cabeçalho',async({page})=>{
  44  |   await page.goto('/');
  45  |   await expect(page.locator('html')).toHaveCSS('scroll-behavior','smooth');
  46  |   await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Benefícios'}).click();
  47  |   await expect(page).toHaveURL(/#beneficios$/);
  48  |   await expect(page.locator('#beneficios')).toBeInViewport();
  49  | 
  50  |   await page.setViewportSize({width:390,height:844});
  51  |   await page.getByRole('button',{name:'Abrir menu'}).click();
  52  |   await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Benefícios'}).click();
  53  |   await expect(page.getByRole('button',{name:'Abrir menu'})).toHaveAttribute('aria-expanded','false');
  54  |   await expect(page).toHaveURL(/#beneficios$/);
  55  |   await expect(page.locator('#beneficios')).toBeInViewport();
  56  | 
  57  |   await page.emulateMedia({reducedMotion:'reduce'});
  58  |   await expect(page.locator('html')).toHaveCSS('scroll-behavior','auto');
  59  | });
  60  | 
  61  | test('hero alterna as duas imagens locais sem carregar WebGL, GLB ou HDRI',async({page})=>{
  62  |   const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  63  |   await page.goto('/');
  64  |   const gallery=page.locator('.hero-gallery');
  65  |   await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-interior.jpg');
  66  |   await expect.poll(()=>gallery.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  67  |   const building=gallery.getByRole('button',{name:'Edifício'});
  68  |   await building.focus();await page.keyboard.press('Enter');
  69  |   await expect(building).toHaveAttribute('aria-pressed','true');
  70  |   await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-tower.jpg');
  71  |   await expect.poll(()=>gallery.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  72  |   await gallery.getByRole('button',{name:'Interior'}).click();
  73  |   await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-interior.jpg');
  74  |   await page.waitForTimeout(350);
  75  |   expect(requests.some(url=>url.includes('/building/promoven-building-v2.glb')||url.includes('studio_small_03_1k.hdr')||/\/three-[^/]+\.js/.test(url))).toBe(false);
  76  |   await expect(page.locator('canvas')).toHaveCount(0);
  77  | });
  78  | 
  79  | test('ilustração de iluminação permanece arquivada e não carrega recursos 3D na landing',async({page})=>{
  80  |   const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  81  |   await page.goto('/');
  82  |   await expect(page.locator('#experiencia,.building-feature,.hero-building,.lighting-preview')).toHaveCount(0);
  83  |   await expect(page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Experiência 3D'})).toHaveCount(0);
  84  |   await expect(page.getByRole('navigation',{name:'Navegação do rodapé'}).getByRole('link',{name:'Experiência 3D'})).toHaveCount(0);
  85  |   await page.waitForTimeout(350);
  86  |   expect(requests.some(url=>url.includes('/building/promoven-building-v2.glb')||url.includes('studio_small_03_1k.hdr')||url.includes('/marketing/lighting/')||/\/three-[^/]+\.js/.test(url))).toBe(false);
  87  |   await expect(page.locator('canvas')).toHaveCount(0);
  88  | });
  89  | 
  90  | test('landing móvel oferece navegação acessível e tabs de experiências',async({page})=>{
  91  |   await page.setViewportSize({width:390,height:844});
  92  |   await page.emulateMedia({reducedMotion:'reduce'});
  93  |   await page.goto('/');
  94  |   const menu=page.getByRole('button',{name:'Abrir menu'});await menu.click();
  95  |   await expect(page.getByRole('navigation',{name:'Navegação principal'})).toBeVisible();
  96  |   await page.getByRole('tab',{name:/Terraza Luz/}).click();
  97  |   await expect(page.locator('.browser img')).toHaveAttribute('src','/marketing/terraza-luz.jpg');
  98  |   await expect.poll(()=>page.locator('.browser img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  99  |   await expect(page.getByRole('link',{name:'Abrir experiência 3D'})).toHaveAttribute('href','/demo?vista=interior&maqueta=terraza_luz&piso=6&unidad=601');
  100 |   await expect(page.locator('body')).not.toHaveCSS('overflow-x','scroll');
  101 | });
  102 | 
  103 | for(const demo of [
  104 |   {tab:'Garden House',image:'/marketing/garden-house.jpg',project:'garden_house_18'},
  105 |   {tab:'Terraza Luz',image:'/marketing/terraza-luz.jpg',project:'terraza_luz'},
  106 | ])test(`${demo.tab} mostra imagem local e abre a maqueta correta`,async({page})=>{
  107 |   await page.emulateMedia({reducedMotion:'reduce'});
  108 |   await page.goto('/');
> 109 |   await page.getByRole('tab',{name:new RegExp(demo.tab)}).click();
      |                                                           ^ Error: locator.click: Test timeout of 30000ms exceeded.
  110 |   const image=page.locator('.browser img');
  111 |   await expect(image).toHaveAttribute('src',demo.image);
  112 |   await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);
  113 |   await page.getByRole('link',{name:'Abrir experiência 3D'}).click();
  114 |   await expect(page).toHaveURL(/\/demo\?/);
  115 |   await expect.poll(()=>new URL(page.url()).searchParams.get('maqueta')).toBe(demo.project);
  116 |   await expect.poll(()=>new URL(page.url()).searchParams.get('unidad')).toBe('601');
  117 |   await expect(page.getByRole('combobox',{name:'Selecionar maquete'})).toHaveValue(demo.project,{timeout:20_000});
  118 | });
  119 | 
  120 | test('as maquetes na landing giram com o mouse e mantêm apenas um visor ativo',async({page})=>{
  121 |   test.setTimeout(60_000);
  122 |   await page.goto('/');
  123 |   await page.getByRole('tab',{name:/Garden House/}).click();
  124 |   const preview=page.locator('.interior-preview');
  125 |   await expect(preview).toHaveAttribute('data-status','ready',{timeout:30_000});
  126 |   const canvas=preview.locator('canvas');await expect(canvas).toBeVisible();
  127 |   const box=await canvas.boundingBox();expect(box).not.toBeNull();
  128 |   await page.mouse.move(box!.x+box!.width*.45,box!.y+box!.height*.5);
  129 |   await page.mouse.down();await page.mouse.move(box!.x+box!.width*.7,box!.y+box!.height*.5,{steps:8});await page.mouse.up();
  130 |   await expect(preview).toHaveAttribute('data-camera',/.+/);
  131 |   const firstCamera=await preview.getAttribute('data-camera');
  132 |   await page.mouse.move(box!.x+box!.width*.7,box!.y+box!.height*.5);
  133 |   await page.mouse.down();await page.mouse.move(box!.x+box!.width*.4,box!.y+box!.height*.5,{steps:8});await page.mouse.up();
  134 |   await expect.poll(()=>preview.getAttribute('data-camera')).not.toBe(firstCamera);
  135 |   await expect(page.locator('canvas')).toHaveCount(1);
  136 |   await page.getByRole('tab',{name:/Terraza Luz/}).click();
  137 |   await expect(page.locator('.interior-preview')).toHaveAttribute('data-project','terraza_luz');
  138 |   await expect(page.locator('.interior-preview')).toHaveAttribute('data-status','ready',{timeout:30_000});
  139 |   await expect(page.locator('canvas')).toHaveCount(1);
  140 | });
  141 | 
  142 | test('compatibilidade legacy normaliza a URL da demonstração',async({page})=>{
  143 |   await page.goto('/?vista=edificio&unidad=1203&desconhecido=1');
  144 |   await expect(page).toHaveURL(/\/demo\?vista=edificio&unidad=1203$/);
  145 |   await expect(page.getByRole('heading',{name:/Encontre seu apartamento ideal/})).toBeVisible({timeout:20_000});
  146 | });
  147 | 
  148 | test('demo direta remove parâmetros desconhecidos',async({page})=>{
  149 |   await page.goto('/demo?vista=edificio&unidad=1203&token=segredo');
  150 |   await expect(page).toHaveURL(/\/demo\?vista=edificio&unidad=1203$/);
  151 | });
  152 | 
  153 | test('query comum não desvia a landing e rota desconhecida mostra 404',async({page})=>{
  154 |   await page.emulateMedia({reducedMotion:'reduce'});
  155 |   await page.goto('/?utm_source=campanha');
  156 |   await expect(page.getByRole('heading',{level:1})).toContainText('Transforme empreendimentos');
  157 |   await page.goto('/nao-existe');
  158 |   await expect(page.getByRole('heading',{name:'Página não encontrada'})).toBeVisible();
  159 |   await expect(page.getByRole('link',{name:'Abrir demonstração'})).toHaveAttribute('href','/demo');
  160 | });
  161 | 
```