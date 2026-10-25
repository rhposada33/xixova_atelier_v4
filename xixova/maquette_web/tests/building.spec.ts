import {expect,test} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>{sessionStorage.clear();localStorage.clear();});});

test('portada del edificio, filtros combinados y limpieza accesible',async({page})=>{
  test.setTimeout(60_000);
  await page.goto('/?vista=edificio');
  await expect(page.locator('.building-filters h1')).toBeVisible({timeout:15_000});
  await expect(page.locator('.building-filters .b-availability')).toContainText('54');
  await expect(page.locator('.building-stage canvas')).toBeVisible({timeout:20_000});
  await page.getByLabel('Andar',{exact:true}).selectOption('12');
  await page.getByLabel('Dormitórios',{exact:true}).selectOption('3');
  await expect(page.getByText('2 unidades correspondem aos seus filtros')).toBeVisible();
  await page.locator('.b-advanced summary').click();
  await page.getByRole('button',{name:/Sol da tarde/}).click();
  await expect(page.getByText('0 unidades correspondem aos seus filtros')).toBeVisible();
  await page.getByRole('button',{name:'Limpar filtros'}).click();
  await expect(page.getByText('72 unidades no edifício')).toBeVisible();
});
test('matriz, selección, estados e interior no disponible',async({page})=>{
  await page.goto('/?vista=edificio');
  await page.getByRole('navigation',{name:'Navegação do edifício'}).getByRole('button',{name:'Unidades'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Unidade 1201, Reservada, 118 metros quadrados'}).click();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1201');
  await expect(page.getByRole('button',{name:'Consultar disponibilidade'})).toBeVisible();
  await expect(page).toHaveURL(/unidad=1201/);
  await page.getByRole('navigation',{name:'Navegação do edifício'}).getByRole('button',{name:'Unidades'}).click();
  await page.getByRole('button',{name:'Unidade 1302, Vendida, 82 metros quadrados'}).click();
  await expect(page.getByRole('button',{name:'Ver unidades semelhantes'})).toBeVisible();
  await expect(page.locator('.building-header-actions').getByRole('button',{name:'Falar pelo WhatsApp'})).toBeDisabled();
});
test('interior se carga al entrar y el regreso conserva filtros y selección',async({page})=>{
  test.setTimeout(60_000);
  const interiorRequests:string[]=[];
  page.on('request',r=>{if(/scene\.json|catalog\.json/.test(r.url()))interiorRequests.push(r.url());});
  await page.goto('/?vista=edificio&unidad=1203');
  await expect(page.locator('.building-stage canvas')).toBeVisible({timeout:20_000});
  expect(interiorRequests).toEqual([]);
  await page.getByLabel('Andar',{exact:true}).selectOption('12');
  await page.getByRole('button',{name:'Ver interior'}).click();
  await expect(page).toHaveURL(/vista=interior/);
  await expect(page.getByText('TERRAZA LUZ',{exact:true})).toBeVisible({timeout:15_000});
  await page.getByRole('button',{name:'Voltar ao edifício'}).click();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203',{timeout:15_000});
  await expect(page.getByLabel('Andar',{exact:true})).toHaveValue('12');
});
test('modo atardecer y navegación móvil',async({page})=>{
  test.setTimeout(60_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?vista=edificio');
  await page.getByRole('button',{name:'Entardecer',exact:true}).click();
  await expect(page.locator('.building-stage')).toHaveClass(/warm_dusk/);
  await page.locator('.building-mobile-tabs').getByRole('button',{name:/Filtros/}).click();
  await expect(page.locator('.building-filters h1')).toBeVisible();
  await page.locator('.b-mobile-close[aria-label="Fechar filtros"]').click();
  await page.locator('.building-mobile-tabs').getByRole('button',{name:'Unidades',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('la maqueta deja de dibujar en reposo y despierta al cambiar la luz',async({page})=>{
  test.setTimeout(60_000);
  await page.goto('/demo?vista=edificio');
  const stage=page.locator('.building-stage');
  await expect.poll(async()=>Number(await stage.getAttribute('data-render-count')),{timeout:20_000}).toBeGreaterThan(0);
  await expect(stage.locator('.building-loading')).toHaveCount(0,{timeout:20_000});
  await expect(page.locator('.building-unit-label')).toHaveCSS('display','block');
  await expect.poll(async()=>await page.locator('.building-unit-label').evaluate(el=>Boolean(el.style.left&&el.style.top))).toBe(true);
  await page.waitForTimeout(1800);
  const idle=Number(await stage.getAttribute('data-render-count'));
  await page.waitForTimeout(500);
  expect(Number(await stage.getAttribute('data-render-count'))).toBe(idle);
  await page.getByRole('button',{name:'Entardecer',exact:true}).click();
  await expect.poll(async()=>Number(await stage.getAttribute('data-render-count'))).toBeGreaterThan(idle);
  await page.waitForTimeout(3000);
  const settled=Number(await stage.getAttribute('data-render-count'));
  await page.waitForTimeout(500);
  expect(Number(await stage.getAttribute('data-render-count'))).toBe(settled);
});

test('selector de edificios, enlaces y favoritos separados',async({page})=>{
  test.setTimeout(90_000);
  await page.goto('/demo?vista=edificio&unidad=1203');
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203',{timeout:20_000});
  await page.locator('.b-v2-card-actions').getByRole('button',{name:'Favoritar',exact:true}).click();
  await page.getByLabel('Selecionar edifício').first().selectOption('jequitiba');
  await expect.poll(()=>new URL(page.url()).searchParams.get('edificio')).toBe('jequitiba');
  await expect.poll(()=>new URL(page.url()).searchParams.get('unidad')).toBe('101');
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 101',{timeout:20_000});
  await expect(page.locator('.building-stage .building-loading')).toHaveCount(0,{timeout:20_000});
  await expect(page.getByRole('button',{name:'Interior ainda não disponível'})).toBeDisabled();
  await page.locator('.building-header-actions').getByRole('button',{name:/Favoritos/}).click();
  await expect(page.getByRole('dialog')).toContainText('Salve unidades');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 101',{timeout:20_000});
  await page.getByLabel('Selecionar edifício').first().selectOption('escobar');
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203',{timeout:20_000});
  await page.locator('.building-header-actions').getByRole('button',{name:/Favoritos/}).click();
  await expect(page.getByRole('dialog')).toContainText('Unidade 1203');
});

test('enlace antiguo y selector móvil de Jequitibá',async({page})=>{
  test.setTimeout(60_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/demo?cliente=jequitiba&vista=edificio&unidad=2003');
  await expect(page).toHaveURL(/edificio=jequitiba.*unidad=2003/);
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 2003',{timeout:20_000});
  await expect(page.locator('.building-picker.mobile select')).toBeVisible();
  await page.locator('.building-mobile-tabs').getByRole('button',{name:'Unidades',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Andar 20');
  await page.keyboard.press('Escape');
  await page.locator('.building-picker.mobile select').selectOption('escobar');
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203');
});

test('Canto do Forte: GLB, 64 unidades, enlace compartido y favoritos propios',async({page})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  const glb=page.waitForResponse(response=>response.url().endsWith('/building/canto-do-forte.glb')&&response.ok());
  await page.goto('/demo?edificio=canto-do-forte&unidad=1203');
  await glb;
  await expect(page.locator('.building-loading')).toHaveCount(0,{timeout:45_000});
  await expect(page.locator('.building-error')).toHaveCount(0);
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203');
  await expect(page.getByText('64 unidades no edifício')).toBeVisible();
  await expect(page.getByRole('button',{name:'Interior ainda não disponível'})).toBeDisabled();
  await page.getByRole('navigation').getByRole('button',{name:'Unidades',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('button',{name:/^Unidade \d+,/})).toHaveCount(64);
  await page.getByRole('button',{name:/^Unidade 1604,/}).click();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1604');
  await expect(page).toHaveURL(/edificio=canto-do-forte&unidad=1604/);
  const shared=page.url();
  await page.locator('.b-v2-card-actions').getByRole('button',{name:'Favoritar',exact:true}).click();
  await page.getByLabel('Andar',{exact:true}).selectOption('16');
  await page.getByLabel('Selecionar edifício').first().selectOption('jequitiba');
  await expect(page.getByLabel('Andar',{exact:true})).toHaveValue('');
  await page.locator('.building-header-actions').getByRole('button',{name:/Favoritos/}).click();
  await expect(page.getByRole('dialog')).toContainText('Salve unidades');
  await page.keyboard.press('Escape');
  await page.goto(shared);
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1604');
  await expect(page.locator('.b-v2-card-actions').getByRole('button',{name:'Favoritada',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('Canto do Forte en móvil: selector, matriz e interior bloqueado',async({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/demo?edificio=canto-do-forte&vista=interior&unidad=1203&maqueta=terraza_luz');
  await expect(page).toHaveURL(/vista=edificio/);
  await expect(page.locator('.building-loading')).toHaveCount(0,{timeout:45_000});
  await expect(page.locator('.building-error')).toHaveCount(0);
  await expect(page.locator('.building-picker.mobile select')).toHaveValue('canto-do-forte');
  await page.locator('.building-mobile-tabs').getByRole('button',{name:'Unidades',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Andar 16');
  await expect(page.getByRole('dialog')).not.toContainText('Andar 17');
  await page.getByRole('button',{name:/^Unidade 1603,/}).click();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1603');
  await expect(page.locator('.b-card-heading h2')).toBeVisible();
  await expect(page.getByRole('button',{name:'Interior ainda não disponível'})).toBeDisabled();
  await page.locator('.building-picker.mobile select').selectOption('escobar');
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203');
});
