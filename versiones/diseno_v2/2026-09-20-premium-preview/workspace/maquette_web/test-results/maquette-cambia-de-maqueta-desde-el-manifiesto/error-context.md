# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: maquette.spec.ts >> cambia de maqueta desde el manifiesto
- Location: tests/maquette.spec.ts:12:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText('TERRAZA LUZ', { exact: true })
Expected: visible
Received: undefined

Call log:
  - Expect "toBeVisible" getByText('TERRAZA LUZ', { exact: true }) with timeout 15000ms
  - waiting for getByText('TERRAZA LUZ', { exact: true })
  - Protocol error (Runtime.callFunctionOn): Internal server error, session closed.

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - button "← Voltar ao edifício" [ref=e3] [cursor=pointer]
  - main [ref=e4]:
    - generic [ref=e5]: XV
    - generic [ref=e6]: Preparando seu novo lar…
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
> 16 |   await expect(page.getByText("TERRAZA LUZ",{exact:true})).toBeVisible({timeout:15_000});
     |                                                            ^ Error: expect(locator).toBeVisible() failed
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
  27 |     await expect(page.getByText("TERRAZA LUZ",{exact:true})).toBeVisible({timeout:15_000});
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