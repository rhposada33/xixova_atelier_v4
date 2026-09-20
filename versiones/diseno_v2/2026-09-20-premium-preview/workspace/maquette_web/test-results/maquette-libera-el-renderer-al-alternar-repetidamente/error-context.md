# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: maquette.spec.ts >> libera el renderer al alternar repetidamente
- Location: tests/maquette.spec.ts:20:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('TERRAZA LUZ', { exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('TERRAZA LUZ', { exact: true }) with timeout 15000ms
  - waiting for getByText('TERRAZA LUZ', { exact: true })

```

```yaml
- button "← Voltar ao edifício"
- main:
  - link "Promoven, início":
    - /url: /
    - text: P
    - strong: PROMOVEN
    - text: Experiências imobiliárias
  - strong: TERRAZA LUZ
  - text: Luxo contemporâneo Vista previa V2 Maquete
  - combobox "Selecionar maquete":
    - option "Garden House"
    - option "Terraza Luz" [selected]
  - text: Andar
  - combobox "Selecionar andar":
    - option "Andar 6" [selected]
    - option "Andar 8"
    - option "Andar 10"
  - text: Unidade
  - combobox "Selecionar unidade":
    - option "Unidade 601" [selected]
    - option "Unidade 604"
  - button "Salvar favorito": Favoritos
  - button "Compartilhar"
  - button "Falar pelo WhatsApp"
  - complementary:
    - heading "Ambientes" [level=2]
    - paragraph: Selecione um ambiente para explorar em detalhes.
    - img
    - navigation:
      - button "Terraço Jardim": Terraço Jardim ›
      - button "Entrada": Entrada ›
      - button "Lavanderia": Lavanderia ›
      - button "Banheiro social": Banheiro social ›
      - button "Cozinha": Cozinha ›
      - button "Dormitório secundário": Dormitório secundário ›
      - button "Circulação": Circulação ›
      - button "Banheiro da suíte": Banheiro da suíte ›
      - button "Suíte": Suíte ›
      - button "Sala de jantar": Sala de jantar ›
    - button "Ver projeto completo"
  - text: ↑ N
  - complementary:
    - region "Estudo solar":
      - text: ☼
      - heading "Iluminação natural" [level=2]
      - button "Fechar estudo solar": ×
      - paragraph: Descubra como a luz do sol entra neste lar conforme a data e o horário.
      - strong: 11:10
      - text: 20 de setembro de 2026 America/Sao_Paulo
      - status: ◇ Estimativa · dados a calibrar
      - text: 05:57
      - slider "Horário local": "670"
      - text: 18:01 Alterar data
      - textbox "Alterar data": 2026-09-20
      - button "Manhã"
      - button "Meio-dia"
      - button "Entardecer"
      - button "▶ Percorrer o dia"
      - combobox "Velocidade":
        - option "0.5×"
        - option "1×" [selected]
        - option "2×"
        - option "4×"
      - button "Verão"
      - button "Inverno"
      - button "Agora"
      - checkbox "Mostrar trajetória" [checked]
      - text: Mostrar trajetória
      - heading "Sol do meio-dia" [level=3]
      - text: ☀ Sala de jantar100% ☀ Cozinha100% ☀ suite_principal100% ☀ suite_2100% ☀ suite_3100% ☀ oficina100% ☀ sala_tv100% ☀ vestidor100% ☀ bano_principal100% ☀ bano_2100% ☀ bano_3100% ☀ Banheiro social100% ☀ Lavanderia100% ☀ despensa100% ☀ vestibulo100% ☀ Circulação100% ☀ pasillo100% ☀ terraza_frente100% ☀ terraza_gourmet100% ☀ terraza_lateral100%
      - strong: 20 de 20 ambientes iluminados
      - group: Dados da simulação
    - article:
      - heading "Unidade 601" [level=2]
      - text: Tipologia Garden 94 m² 2 dormitórios Andar 6
      - paragraph: Terraza Luz Arquitectura · naturaleza · luz
      - button "Falar pelo WhatsApp →"
  - button "Explorar"
  - button "Vista"
  - button "Mobiliado"
  - button "Medir"
  - button "Iluminação"
  - button "Salvar visualização"
  - button "Arredores"
```

# Test source

```ts
  1  | import {expect,test} from "@playwright/test";
  2  | 
  3  | test("carga Garden House y conserva una selección compartible",async({page})=>{
  4  |   await page.goto("/?vista=interior");
  5  |   await expect(page.getByText("GARDEN HOUSE 18")).toBeVisible({timeout:15_000});
  6  |   await expect(page.locator("canvas")).toBeVisible();
  7  |   await page.locator("nav").getByRole("button",{name:"Sala de jantar"}).click();
  8  |   await expect.poll(()=>page.evaluate(()=>Object.fromEntries(new URL(location.href).searchParams))).toMatchObject({maqueta:"garden_house_18",piso:"6",unidad:"601",area:"sala_comedor"});
  9  |   await expect(page.locator(".unit-card").getByRole("heading",{name:"Sala de jantar"})).toBeVisible();
  10 | });
  11 | 
  12 | test("cambia de maqueta desde el manifiesto",async({page})=>{
  13 |   await page.goto("/?vista=interior&maqueta=garden_house_18&piso=8&unidad=804");
  14 |   await page.getByLabel("Selecionar maquete").selectOption("terraza_luz");
  15 |   await expect(page).toHaveURL(/maqueta=terraza_luz/);
  16 |   await expect(page.getByText("TERRAZA LUZ",{exact:true})).toBeVisible({timeout:15_000});
  17 |   await expect(page.locator("nav").getByRole("button",{name:"Suíte",exact:true})).toBeVisible();
  18 | });
  19 | 
  20 | test("libera el renderer al alternar repetidamente",async({page})=>{
  21 |   test.setTimeout(120_000);
  22 |   await page.goto("/?vista=interior");
  23 |   await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer?.info?.memory?.geometries),{timeout:15_000}).toBeGreaterThan(0);
  24 |   let settled:{geometries:number;textures:number}|undefined;
  25 |   for(let index=0;index<2;index++){
  26 |     await page.getByLabel("Selecionar maquete").selectOption("terraza_luz");
> 27 |     await expect(page.getByText("TERRAZA LUZ",{exact:true})).toBeVisible({timeout:15_000});
     |                                                              ^ Error: expect(locator).toBeVisible() failed
  28 |     await page.getByLabel("Selecionar maquete").selectOption("garden_house_18");
  29 |     await expect(page.getByText("GARDEN HOUSE 18",{exact:true})).toBeVisible({timeout:15_000});
  30 |     await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer?.info?.memory?.textures)).toBeGreaterThan(3);
  31 |     const memory=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.renderer.info.memory);
  32 |     if(index===0)settled=memory;
  33 |   }
  34 |   const memory=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.renderer.info.memory);
  35 |   expect(memory.geometries).toBeLessThanOrEqual(settled!.geometries+2);
  36 |   expect(memory.textures).toBeLessThanOrEqual(settled!.textures+1);
  37 | });
  38 | 
  39 | test("funciona en móvil y no solicita recursos externos",async({page})=>{
  40 |   const external:string[]=[];
  41 |   page.on("request",request=>{const url=new URL(request.url());if(url.protocol!=="blob:"&&url.hostname!=="127.0.0.1")external.push(request.url())});
  42 |   await page.setViewportSize({width:390,height:844});
  43 |   await page.goto("/?vista=interior");
  44 |   await page.getByRole("button",{name:"Explorar ambientes"}).click();
  45 |   await expect(page.getByRole("heading",{name:"Ambientes"})).toBeVisible();
  46 |   await page.locator("nav").getByRole("button",{name:"Suíte principal"}).click();
  47 |   await expect(page).toHaveURL(/area=suite_principal/);
  48 |   expect(external).toEqual([]);
  49 | });
  50 | 
  51 | test("estudio solar cambia fecha, hora y estación",async({page})=>{
  52 |   await page.goto("/?vista=interior");
  53 |   await expect(page.getByRole("region",{name:"Estudo solar"})).toBeVisible({timeout:15_000});
  54 |   const slider=page.getByRole("slider",{name:"Horário local"});
  55 |   await slider.fill("720");
  56 |   await page.getByRole("button",{name:"Entardecer"}).click();
  57 |   expect(+await slider.inputValue()).toBeGreaterThan(720);
  58 |   await page.getByRole("button",{name:"Verão"}).click();
  59 |   await expect(page.locator("input[type=date]")).toHaveValue(/-12-21$/);
  60 | });
  61 | 
  62 | test("captura con un renderer temporal",async({page})=>{
  63 |   test.setTimeout(60_000);
  64 |   await page.goto("/?vista=interior");
  65 |   await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer),{timeout:30_000}).toBeTruthy();
  66 |   const download=page.waitForEvent("download");
  67 |   await page.getByRole("button",{name:"Salvar visualização"}).click();
  68 |   expect((await download).suggestedFilename()).toBe("garden_house_18-maqueta.png");
  69 | });
  70 | 
```