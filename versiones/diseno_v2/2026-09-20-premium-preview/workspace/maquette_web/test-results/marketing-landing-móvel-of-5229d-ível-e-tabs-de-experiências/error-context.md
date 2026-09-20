# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: marketing.spec.ts >> landing móvel oferece navegação acessível e tabs de experiências
- Location: tests/marketing.spec.ts:90:1

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
      - generic [ref=e8]: PROMOVEN
    - button "Fechar menu" [expanded] [active] [ref=e9]: ×
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
        - generic [ref=e86]:
          - heading "Disponibilidade por pavimento" [level=3] [ref=e87]
          - generic "Legenda de status" [ref=e88]:
            - generic [ref=e89]: Disponível
            - generic [ref=e90]: Reservada
            - generic [ref=e91]: Vendida
          - group "Matriz ilustrativa de unidades por pavimento" [ref=e93]:
            - generic [ref=e94]:
              - generic [ref=e95]: 15º
              - button "Unidade 1501, 15º pavimento, Reservada" [ref=e96] [cursor=pointer]:
                - text: "1501"
                - generic [ref=e97]: — Reservada
              - button "Unidade 1502, 15º pavimento, Reservada" [ref=e98] [cursor=pointer]:
                - text: "1502"
                - generic [ref=e99]: — Reservada
              - button "Unidade 1503, 15º pavimento, Vendida" [ref=e100] [cursor=pointer]:
                - text: "1503"
                - generic [ref=e101]: — Vendida
              - button "Unidade 1504, 15º pavimento, Vendida" [ref=e102] [cursor=pointer]:
                - text: "1504"
                - generic [ref=e103]: — Vendida
            - generic [ref=e104]:
              - generic [ref=e105]: 14º
              - button "Unidade 1401, 14º pavimento, Vendida" [ref=e106] [cursor=pointer]:
                - text: "1401"
                - generic [ref=e107]: — Vendida
              - button "Unidade 1402, 14º pavimento, Disponível" [ref=e108] [cursor=pointer]:
                - text: "1402"
                - generic [ref=e109]: — Disponível
              - button "Unidade 1403, 14º pavimento, Disponível" [ref=e110] [cursor=pointer]:
                - text: "1403"
                - generic [ref=e111]: — Disponível
              - button "Unidade 1404, 14º pavimento, Disponível" [ref=e112] [cursor=pointer]:
                - text: "1404"
                - generic [ref=e113]: — Disponível
            - generic [ref=e114]:
              - generic [ref=e115]: 13º
              - button "Unidade 1301, 13º pavimento, Disponível" [ref=e116] [cursor=pointer]:
                - text: "1301"
                - generic [ref=e117]: — Disponível
              - button "Unidade 1302, 13º pavimento, Disponível" [ref=e118] [cursor=pointer]:
                - text: "1302"
                - generic [ref=e119]: — Disponível
              - button "Unidade 1303, 13º pavimento, Disponível" [ref=e120] [cursor=pointer]:
                - text: "1303"
                - generic [ref=e121]: — Disponível
              - button "Unidade 1304, 13º pavimento, Disponível" [ref=e122] [cursor=pointer]:
                - text: "1304"
                - generic [ref=e123]: — Disponível
            - generic [ref=e124]:
              - generic [ref=e125]: 12º
              - button "Unidade 1201, 12º pavimento, Disponível" [pressed] [ref=e126] [cursor=pointer]:
                - text: "1201"
                - generic [ref=e127]: — Disponível
              - button "Unidade 1202, 12º pavimento, Reservada" [ref=e128] [cursor=pointer]:
                - text: "1202"
                - generic [ref=e129]: — Reservada
              - button "Unidade 1203, 12º pavimento, Reservada" [ref=e130] [cursor=pointer]:
                - text: "1203"
                - generic [ref=e131]: — Reservada
              - button "Unidade 1204, 12º pavimento, Vendida" [ref=e132] [cursor=pointer]:
                - text: "1204"
                - generic [ref=e133]: — Vendida
            - generic [ref=e134]:
              - generic [ref=e135]: 11º
              - button "Unidade 1101, 11º pavimento, Vendida" [ref=e136] [cursor=pointer]:
                - text: "1101"
                - generic [ref=e137]: — Vendida
              - button "Unidade 1102, 11º pavimento, Vendida" [ref=e138] [cursor=pointer]:
                - text: "1102"
                - generic [ref=e139]: — Vendida
              - button "Unidade 1103, 11º pavimento, Disponível" [ref=e140] [cursor=pointer]:
                - text: "1103"
                - generic [ref=e141]: — Disponível
              - button "Unidade 1104, 11º pavimento, Disponível" [ref=e142] [cursor=pointer]:
                - text: "1104"
                - generic [ref=e143]: — Disponível
            - generic [ref=e144]:
              - generic [ref=e145]: 10º
              - button "Unidade 1001, 10º pavimento, Disponível" [ref=e146] [cursor=pointer]:
                - text: "1001"
                - generic [ref=e147]: — Disponível
              - button "Unidade 1002, 10º pavimento, Disponível" [ref=e148] [cursor=pointer]:
                - text: "1002"
                - generic [ref=e149]: — Disponível
              - button "Unidade 1003, 10º pavimento, Disponível" [ref=e150] [cursor=pointer]:
                - text: "1003"
                - generic [ref=e151]: — Disponível
              - button "Unidade 1004, 10º pavimento, Disponível" [ref=e152] [cursor=pointer]:
                - text: "1004"
                - generic [ref=e153]: — Disponível
            - generic [ref=e154]:
              - generic [ref=e155]: 9º
              - button "Unidade 901, 9º pavimento, Disponível" [ref=e156] [cursor=pointer]:
                - text: "901"
                - generic [ref=e157]: — Disponível
              - button "Unidade 902, 9º pavimento, Disponível" [ref=e158] [cursor=pointer]:
                - text: "902"
                - generic [ref=e159]: — Disponível
              - button "Unidade 903, 9º pavimento, Reservada" [ref=e160] [cursor=pointer]:
                - text: "903"
                - generic [ref=e161]: — Reservada
              - button "Unidade 904, 9º pavimento, Reservada" [ref=e162] [cursor=pointer]:
                - text: "904"
                - generic [ref=e163]: — Reservada
            - generic [ref=e164]:
              - generic [ref=e165]: 8º
              - button "Unidade 801, 8º pavimento, Reservada" [ref=e166] [cursor=pointer]:
                - text: "801"
                - generic [ref=e167]: — Reservada
              - button "Unidade 802, 8º pavimento, Vendida" [ref=e168] [cursor=pointer]:
                - text: "802"
                - generic [ref=e169]: — Vendida
              - button "Unidade 803, 8º pavimento, Vendida" [ref=e170] [cursor=pointer]:
                - text: "803"
                - generic [ref=e171]: — Vendida
              - button "Unidade 804, 8º pavimento, Disponível" [ref=e172] [cursor=pointer]:
                - text: "804"
                - generic [ref=e173]: — Disponível
            - generic [ref=e174]:
              - generic [ref=e175]: 7º
              - button "Unidade 701, 7º pavimento, Disponível" [ref=e176] [cursor=pointer]:
                - text: "701"
                - generic [ref=e177]: — Disponível
              - button "Unidade 702, 7º pavimento, Disponível" [ref=e178] [cursor=pointer]:
                - text: "702"
                - generic [ref=e179]: — Disponível
              - button "Unidade 703, 7º pavimento, Disponível" [ref=e180] [cursor=pointer]:
                - text: "703"
                - generic [ref=e181]: — Disponível
              - button "Unidade 704, 7º pavimento, Disponível" [ref=e182] [cursor=pointer]:
                - text: "704"
                - generic [ref=e183]: — Disponível
            - generic [ref=e184]:
              - generic [ref=e185]: 6º
              - button "Unidade 601, 6º pavimento, Disponível" [ref=e186] [cursor=pointer]:
                - text: "601"
                - generic [ref=e187]: — Disponível
              - button "Unidade 602, 6º pavimento, Disponível" [ref=e188] [cursor=pointer]:
                - text: "602"
                - generic [ref=e189]: — Disponível
              - button "Unidade 603, 6º pavimento, Disponível" [ref=e190] [cursor=pointer]:
                - text: "603"
                - generic [ref=e191]: — Disponível
              - button "Unidade 604, 6º pavimento, Reservada" [ref=e192] [cursor=pointer]:
                - text: "604"
                - generic [ref=e193]: — Reservada
            - generic [ref=e194]:
              - generic [ref=e195]: 5º
              - button "Unidade 501, 5º pavimento, Reservada" [ref=e196] [cursor=pointer]:
                - text: "501"
                - generic [ref=e197]: — Reservada
              - button "Unidade 502, 5º pavimento, Reservada" [ref=e198] [cursor=pointer]:
                - text: "502"
                - generic [ref=e199]: — Reservada
              - button "Unidade 503, 5º pavimento, Vendida" [ref=e200] [cursor=pointer]:
                - text: "503"
                - generic [ref=e201]: — Vendida
              - button "Unidade 504, 5º pavimento, Vendida" [ref=e202] [cursor=pointer]:
                - text: "504"
                - generic [ref=e203]: — Vendida
            - generic [ref=e204]:
              - generic [ref=e205]: 4º
              - button "Unidade 401, 4º pavimento, Vendida" [ref=e206] [cursor=pointer]:
                - text: "401"
                - generic [ref=e207]: — Vendida
              - button "Unidade 402, 4º pavimento, Disponível" [ref=e208] [cursor=pointer]:
                - text: "402"
                - generic [ref=e209]: — Disponível
              - button "Unidade 403, 4º pavimento, Disponível" [ref=e210] [cursor=pointer]:
                - text: "403"
                - generic [ref=e211]: — Disponível
              - button "Unidade 404, 4º pavimento, Disponível" [ref=e212] [cursor=pointer]:
                - text: "404"
                - generic [ref=e213]: — Disponível
            - generic [ref=e214]:
              - generic [ref=e215]: 3º
              - button "Unidade 301, 3º pavimento, Disponível" [ref=e216] [cursor=pointer]:
                - text: "301"
                - generic [ref=e217]: — Disponível
              - button "Unidade 302, 3º pavimento, Disponível" [ref=e218] [cursor=pointer]:
                - text: "302"
                - generic [ref=e219]: — Disponível
              - button "Unidade 303, 3º pavimento, Disponível" [ref=e220] [cursor=pointer]:
                - text: "303"
                - generic [ref=e221]: — Disponível
              - button "Unidade 304, 3º pavimento, Disponível" [ref=e222] [cursor=pointer]:
                - text: "304"
                - generic [ref=e223]: — Disponível
            - generic [ref=e224]:
              - generic [ref=e225]: 2º
              - button "Unidade 201, 2º pavimento, Disponível" [ref=e226] [cursor=pointer]:
                - text: "201"
                - generic [ref=e227]: — Disponível
              - button "Unidade 202, 2º pavimento, Reservada" [ref=e228] [cursor=pointer]:
                - text: "202"
                - generic [ref=e229]: — Reservada
              - button "Unidade 203, 2º pavimento, Reservada" [ref=e230] [cursor=pointer]:
                - text: "203"
                - generic [ref=e231]: — Reservada
              - button "Unidade 204, 2º pavimento, Vendida" [ref=e232] [cursor=pointer]:
                - text: "204"
                - generic [ref=e233]: — Vendida
            - generic [ref=e234]:
              - generic [ref=e235]: 1º
              - button "Unidade 101, 1º pavimento, Vendida" [ref=e236] [cursor=pointer]:
                - text: "101"
                - generic [ref=e237]: — Vendida
              - button "Unidade 102, 1º pavimento, Vendida" [ref=e238] [cursor=pointer]:
                - text: "102"
                - generic [ref=e239]: — Vendida
              - button "Unidade 103, 1º pavimento, Disponível" [ref=e240] [cursor=pointer]:
                - text: "103"
                - generic [ref=e241]: — Disponível
              - button "Unidade 104, 1º pavimento, Disponível" [ref=e242] [cursor=pointer]:
                - text: "104"
                - generic [ref=e243]: — Disponível
          - paragraph [ref=e244]: ⌄ Deslize para ver outros pavimentos
        - article "Detalhes da unidade 1201" [ref=e245]:
          - generic [ref=e246]:
            - generic [ref=e247]:
              - heading "Unidade 1201" [level=3] [ref=e248]
              - paragraph [ref=e249]: 12º pavimento · 84 m²
            - strong [ref=e250]: R$ 1.460.000
            - button "Ver detalhes" [ref=e251] [cursor=pointer]
      - paragraph [ref=e252]: Dados e disponibilidade apresentados apenas para demonstração comercial.
    - region [ref=e253]:
      - generic [ref=e254]:
        - generic [ref=e255]:
          - heading [level=2] [ref=e256]:
            - text: Todo o projeto,
            - emphasis [ref=e257]: em uma sóexperiência.
          - paragraph [ref=e258]: A navegação guia o comprador desde a fachada até cada ambiente. Uma experiência coerente, precisa e pensada para a sua marca.
        - generic [ref=e259]:
          - figure [ref=e260]:
            - img "Vista completa da distribuição interior de uma residência ilustrativa" [ref=e261]
          - figure [ref=e262]:
            - img "Detalhe ilustrativo de sala integrada a uma varanda" [ref=e263]
    - generic [ref=e264]:
      - paragraph [ref=e265]: Para todo o mercado
      - heading "Criado para quem vende e para quem decide" [level=2] [ref=e266]
      - generic [ref=e267]:
        - article [ref=e268]:
          - heading "Incorporadoras e construtoras" [level=3] [ref=e269]
          - paragraph [ref=e270]: Apresente projetos, disponibilidade e diferenciais em uma experiência centralizada.
        - article [ref=e271]:
          - heading "Imobiliárias e corretores" [level=3] [ref=e272]
          - paragraph [ref=e273]: Conduza atendimentos mais claros, envolventes e personalizados.
        - article [ref=e274]:
          - heading "Compradores" [level=3] [ref=e275]
          - paragraph [ref=e276]: Explore opções e entenda cada unidade antes de tomar uma decisão.
    - generic [ref=e277]:
      - generic [ref=e278]:
        - paragraph [ref=e279]: Como funciona
        - heading "Do projeto à experiência digital" [level=2] [ref=e280]
      - list [ref=e281]:
        - listitem [ref=e282]:
          - generic [ref=e283]: "01"
          - heading "Recebemos o projeto" [level=3] [ref=e284]
          - paragraph [ref=e285]: Plantas, modelos, unidades e informações comerciais.
        - listitem [ref=e286]:
          - generic [ref=e287]: "02"
          - heading "Criamos a experiência" [level=3] [ref=e288]
          - paragraph [ref=e289]: Organizamos o empreendimento, o 3D e os recursos de venda.
        - listitem [ref=e290]:
          - generic [ref=e291]: "03"
          - heading "Sua equipe começa a apresentar" [level=3] [ref=e292]
          - paragraph [ref=e293]: A plataforma fica pronta para demonstrações e atendimento comercial.
    - generic [ref=e294]:
      - generic [ref=e295]:
        - paragraph [ref=e296]: Avaliação inicial
        - heading "Vamos avaliar o seu próximo lançamento?" [level=2] [ref=e297]
        - paragraph [ref=e298]: Envie as informações básicas do empreendimento e receba uma avaliação inicial da viabilidade da experiência 3D.
        - list [ref=e299]:
          - listitem [ref=e300]: ✓Entenda os materiais necessários
          - listitem [ref=e301]: ✓Alinhe escopo e momento comercial
          - listitem [ref=e302]: ✓Planeje uma apresentação mais clara
      - generic [ref=e303]:
        - generic [ref=e304]:
          - generic [ref=e305]:
            - generic [ref=e306]: Nome
            - textbox "Nome" [ref=e307]
          - generic [ref=e308]:
            - generic [ref=e309]: Empresa
            - textbox "Empresa" [ref=e310]
          - generic [ref=e311]:
            - generic [ref=e312]: Cargo
            - combobox "Cargo" [ref=e313]:
              - option "Selecione (opcional)" [selected]
              - option "Diretor(a)"
              - option "Gerente comercial"
              - option "Marketing"
              - option "Vendas"
              - option "Produto / Tecnologia"
              - option "Arquiteto(a)"
              - option "Outro"
          - generic [ref=e314]:
            - generic [ref=e315]: Cidade / UF
            - textbox "Cidade / UF" [ref=e316]
          - generic [ref=e317]:
            - generic [ref=e318]: WhatsApp
            - textbox "WhatsApp" [ref=e319]:
              - /placeholder: +55 (11) 99999-9999
          - generic [ref=e320]:
            - generic [ref=e321]: E-mail corporativo
            - textbox "E-mail corporativo" [ref=e322]:
              - /placeholder: nome@empresa.com.br
          - paragraph [ref=e323]: Informe pelo menos um meio de contato.
          - generic [ref=e324]:
            - generic [ref=e325]: Número de unidades
            - combobox "Número de unidades" [ref=e326]:
              - option "Selecione" [selected]
              - option "Até 30"
              - option "31 a 80"
              - option "81 a 150"
              - option "151 a 300"
              - option "Mais de 300"
              - option "Ainda não definido"
          - generic [ref=e327]:
            - generic [ref=e328]: Previsão de lançamento
            - combobox "Previsão de lançamento" [ref=e329]:
              - option "Selecione" [selected]
              - option "Até 3 meses"
              - option "De 3 a 6 meses"
              - option "De 6 a 12 meses"
              - option "Mais de 12 meses"
              - option "Empreendimento já lançado"
              - option "Ainda não definido"
          - generic [ref=e330]:
            - generic [ref=e331]: Possui modelo 3D?
            - combobox "Possui modelo 3D?" [ref=e332]:
              - option "Selecione" [selected]
              - option "Sim, pronto para uso"
              - option "Sim, mas precisa ser avaliado"
              - option "Ainda não"
              - option "Não sei informar"
          - generic [ref=e333]:
            - generic [ref=e334]: Mensagem (opcional, 0/1000)
            - textbox "Mensagem (opcional, 0/1000)" [ref=e335]
        - generic [ref=e336]:
          - checkbox "Li e concordo com o uso dos meus dados para receber o contato comercial da Promoven, conforme a Política de Privacidade." [ref=e337]
          - generic [ref=e338]:
            - text: Li e concordo com o uso dos meus dados para receber o contato comercial da Promoven, conforme a
            - link "Política de Privacidade" [ref=e339] [cursor=pointer]:
              - /url: /privacidade
            - text: .
        - button "Solicitar avaliação inicial" [ref=e340]
  - contentinfo [ref=e341]:
    - link "P PROMOVEN" [ref=e342] [cursor=pointer]:
      - /url: /
      - generic [ref=e343]: P
      - generic [ref=e344]: PROMOVEN
    - paragraph [ref=e345]: Experiências imobiliárias interativas que transformam projetos em decisões de compra.
    - navigation "Navegação do rodapé" [ref=e346]:
      - link "Demonstração" [ref=e347] [cursor=pointer]:
        - /url: /demo
      - link "Privacidade" [ref=e348] [cursor=pointer]:
        - /url: /privacidade
    - generic [ref=e349]: © 2026 Promoven. Todos os direitos reservados.
```

# Test source

```ts
  1   | import {expect,test} from '@playwright/test';
  2   | 
  3   | test('landing pública apresenta a Promoven e mantém contato não configurado oculto',async({page})=>{
  4   |   await page.emulateMedia({reducedMotion:'reduce'});
  5   |   await page.goto('/');
  6   |   await expect(page).toHaveTitle('Promoven | Experiências imobiliárias interativas');
  7   |   await expect(page.getByRole('heading',{level:1,name:'Transforme empreendimentos em experiências de compra'})).toBeVisible();
  8   |   await expect(page.getByRole('link',{name:'Falar com a Promoven'})).toHaveCount(0);
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
> 96  |   await page.getByRole('tab',{name:/Terraza Luz/}).click();
      |                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  109 |   await page.getByRole('tab',{name:new RegExp(demo.tab)}).click();
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