import {expect,test} from "@playwright/test";

test("carga Garden House y conserva una selección compartible",async({page})=>{
  await page.goto("/?vista=interior");
  await expect(page.getByText("GARDEN HOUSE 18")).toBeVisible({timeout:15_000});
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("nav").getByRole("button",{name:"Sala de jantar"}).click();
  await expect.poll(()=>page.evaluate(()=>Object.fromEntries(new URL(location.href).searchParams))).toMatchObject({maqueta:"garden_house_18",piso:"6",unidad:"601",area:"sala_comedor"});
  await expect(page.locator(".unit-card").getByRole("heading",{name:"Sala de jantar"})).toBeVisible();
});

test("cambia de maqueta desde el manifiesto",async({page})=>{
  await page.goto("/?vista=interior&maqueta=garden_house_18&piso=8&unidad=804");
  await page.getByLabel("Selecionar maquete").selectOption("terraza_luz");
  await expect(page).toHaveURL(/maqueta=terraza_luz/);
  await expect(page.getByText("TERRAZA LUZ",{exact:true})).toBeVisible({timeout:15_000});
  await expect(page.locator("nav").getByRole("button",{name:"Suíte",exact:true})).toBeVisible();
});

test("libera el renderer al alternar repetidamente",async({page})=>{
  test.setTimeout(120_000);
  await page.goto("/?vista=interior");
  await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer?.info?.memory?.geometries),{timeout:15_000}).toBeGreaterThan(0);
  let settled:{geometries:number;textures:number}|undefined;
  for(let index=0;index<2;index++){
    await page.getByLabel("Selecionar maquete").selectOption("terraza_luz");
    await expect(page.getByText("TERRAZA LUZ",{exact:true})).toBeVisible({timeout:15_000});
    await page.getByLabel("Selecionar maquete").selectOption("garden_house_18");
    await expect(page.getByText("GARDEN HOUSE 18",{exact:true})).toBeVisible({timeout:15_000});
    await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer?.info?.memory?.textures)).toBeGreaterThan(3);
    const memory=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.renderer.info.memory);
    if(index===0)settled=memory;
  }
  const memory=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.renderer.info.memory);
  expect(memory.geometries).toBeLessThanOrEqual(settled!.geometries+2);
  expect(memory.textures).toBeLessThanOrEqual(settled!.textures+1);
});

test("funciona en móvil y no solicita recursos externos",async({page})=>{
  const external:string[]=[];
  page.on("request",request=>{const url=new URL(request.url());if(url.protocol!=="blob:"&&url.hostname!=="127.0.0.1")external.push(request.url())});
  await page.setViewportSize({width:390,height:844});
  await page.goto("/?vista=interior");
  await page.getByRole("button",{name:"Explorar ambientes"}).click();
  await expect(page.getByRole("heading",{name:"Ambientes"})).toBeVisible();
  await page.locator("nav").getByRole("button",{name:"Suíte principal"}).click();
  await expect(page).toHaveURL(/area=suite_principal/);
  expect(external).toEqual([]);
});

test("estudio solar cambia fecha, hora y estación",async({page})=>{
  await page.goto("/?vista=interior");
  await expect(page.getByRole("region",{name:"Estudo solar"})).toBeVisible({timeout:15_000});
  const slider=page.getByRole("slider",{name:"Horário local"});
  await slider.fill("720");
  await page.getByRole("button",{name:"Entardecer"}).click();
  expect(+await slider.inputValue()).toBeGreaterThan(720);
  await page.getByRole("button",{name:"Verão"}).click();
  await expect(page.locator("input[type=date]")).toHaveValue(/-12-21$/);
});

test("captura con un renderer temporal",async({page})=>{
  test.setTimeout(60_000);
  await page.goto("/?vista=interior");
  await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer),{timeout:30_000}).toBeTruthy();
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Salvar visualização"}).click();
  expect((await download).suggestedFilename()).toBe("garden_house_18-maqueta.png");
});
