import {expect,test} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');await page.evaluate(()=>{sessionStorage.clear();localStorage.clear();});});

test('portada del edificio, filtros combinados y limpieza accesible',async({page})=>{
  await page.goto('/?vista=edificio');
  await expect(page.getByRole('heading',{name:'Encuentra tu apartamento ideal'})).toBeVisible();
  await expect(page.getByText('54 de 72 unidades disponibles')).toBeVisible();
  await expect(page.locator('.building-stage canvas')).toBeVisible();
  await page.getByLabel('Piso',{exact:true}).selectOption('12');
  await page.locator('.b-bedroom-buttons').getByRole('button',{name:'3',exact:true}).click();
  await expect(page.getByText('2 unidades coinciden con tus filtros')).toBeVisible();
  await page.getByRole('button',{name:'Sol de tarde'}).click();
  await expect(page.getByText('0 unidades coinciden con tus filtros')).toBeVisible();
  await page.getByRole('button',{name:'Limpiar filtros'}).click();
  await expect(page.getByText('72 unidades en el edificio')).toBeVisible();
});
test('matriz, selección, estados e interior no disponible',async({page})=>{
  await page.goto('/?vista=edificio');
  await page.getByRole('button',{name:'Ver matriz de unidades'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Unidad 1201, Reservada, 118 metros cuadrados'}).click();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidad 1201');
  await expect(page.getByRole('button',{name:'Consultar disponibilidad'})).toBeVisible();
  await expect(page).toHaveURL(/unidad=1201/);
  await page.getByRole('button',{name:'Ver matriz de unidades'}).click();
  await page.getByRole('button',{name:'Unidad 1302, Vendida, 82 metros cuadrados'}).click();
  await expect(page.getByRole('button',{name:'Ver unidades similares'})).toBeVisible();
  await expect(page.locator('.building-header-actions').getByRole('button',{name:'Solicitar propuesta'})).toBeDisabled();
});
test('interior se carga al entrar y el regreso conserva filtros y selección',async({page})=>{
  const interiorRequests:string[]=[];
  page.on('request',r=>{if(/scene\.json|catalog\.json/.test(r.url()))interiorRequests.push(r.url());});
  await page.goto('/?vista=edificio&unidad=1203');
  await expect(page.locator('.building-stage canvas')).toBeVisible();
  expect(interiorRequests).toEqual([]);
  await page.getByLabel('Piso',{exact:true}).selectOption('12');
  await page.getByRole('button',{name:'Explorar apartamento'}).click();
  await expect(page).toHaveURL(/vista=interior/);
  await expect(page.getByText('TERRAZA LUZ',{exact:true})).toBeVisible({timeout:15_000});
  await page.getByRole('button',{name:'Volver al edificio'}).click();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidad 1203');
  await expect(page.getByLabel('Piso',{exact:true})).toHaveValue('12');
});
test('modo atardecer y navegación móvil',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?vista=edificio');
  await page.getByRole('button',{name:'Atardecer',exact:true}).click();
  await expect(page.locator('.building-stage')).toHaveClass(/warm_dusk/);
  await page.locator('.building-mobile-tabs').getByRole('button',{name:'Filtros'}).click();
  await expect(page.getByRole('heading',{name:'Encuentra tu apartamento ideal'})).toBeVisible();
  await page.getByRole('button',{name:'Cerrar filtros'}).click();
  await page.locator('.building-mobile-tabs').getByRole('button',{name:'Unidades',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
