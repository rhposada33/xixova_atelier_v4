import {expect,test} from "@playwright/test";

test("carga Garden House y conserva una selección compartible",async({page})=>{
  await page.goto("/");
  await expect(page.getByText("GARDEN HOUSE 18")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.locator("nav").getByRole("button",{name:"Sala comedor"}).click();
  await expect.poll(()=>page.evaluate(()=>Object.fromEntries(new URL(location.href).searchParams))).toMatchObject({maqueta:"garden_house_18",piso:"6",unidad:"601",area:"sala_comedor"});
  await expect(page.locator(".unit-card").getByRole("heading",{name:"Sala comedor"})).toBeVisible();
});

test("cambia de maqueta desde el manifiesto",async({page})=>{
  await page.goto("/?maqueta=garden_house_18&piso=8&unidad=804");
  await page.getByLabel("Seleccionar maqueta").selectOption("terraza_luz");
  await expect(page).toHaveURL(/maqueta=terraza_luz/);
  await expect(page.locator("header .title strong")).toHaveText("TERRAZA LUZ");
  await expect(page.locator("nav").getByRole("button",{name:"Suite",exact:true})).toBeVisible();
});

test("libera el renderer al alternar repetidamente",async({page})=>{
  test.setTimeout(60_000);
  await page.goto("/");
  await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer?.info?.memory?.geometries)).toBeGreaterThan(0);
  const baseline=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.renderer.info.memory);
  for(let index=0;index<2;index++){
    await page.getByLabel("Seleccionar maqueta").selectOption("terraza_luz");
    await expect(page.locator("header .title strong")).toHaveText("TERRAZA LUZ");
    await page.getByLabel("Seleccionar maqueta").selectOption("garden_house_18");
    await expect(page.locator("header .title strong")).toHaveText("GARDEN HOUSE 18");
  }
  const memory=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.renderer.info.memory);
  expect(memory.geometries).toBeLessThanOrEqual(baseline.geometries+5);
  expect(memory.textures).toBeLessThanOrEqual(baseline.textures+2);
});

test("funciona en móvil y no solicita recursos externos",async({page})=>{
  const external:string[]=[];
  page.on("request",request=>{const url=new URL(request.url());if(url.protocol!=="blob:"&&url.hostname!=="127.0.0.1")external.push(request.url())});
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.getByRole("button",{name:"Explorar ambientes"}).click();
  await expect(page.getByRole("heading",{name:"Ambientes"})).toBeVisible();
  await page.locator("nav").getByRole("button",{name:"Suite Principal"}).click();
  await expect(page).toHaveURL(/area=suite_principal/);
  expect(external).toEqual([]);
});

test("estudio solar cambia fecha, hora y estación",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("region",{name:"Estudio solar"})).toBeVisible();
  const slider=page.getByRole("slider",{name:"Hora local"});
  await slider.fill("720");
  await page.getByRole("button",{name:"Atardecer"}).click();
  expect(+await slider.inputValue()).toBeGreaterThan(720);
  await page.getByRole("button",{name:"Verano"}).click();
  await expect(page.locator("input[type=date]")).toHaveValue(/-12-21$/);
});

test("captura con un renderer temporal",async({page})=>{
  await page.goto("/");
  await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.renderer)).toBeTruthy();
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Guardar vista"}).click();
  expect((await download).suggestedFilename()).toBe("garden_house_18-maqueta.png");
});
