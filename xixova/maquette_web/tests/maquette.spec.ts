import{test,expect}from'@playwright/test';

test('carga la maqueta, selecciona espacios y controla paredes',async({page})=>{
 await page.goto('/');
 await expect(page.getByText('Garden House')).toBeVisible();
 await expect(page.locator('canvas')).toBeVisible();
 await expect(page.getByText('Veranda',{exact:true}).first()).toBeVisible();
 await page.locator('nav').getByRole('button',{name:'Veranda'}).click();
 await expect(page).toHaveURL(/area=veranda/);
 await expect(page.locator('.info article').getByRole('heading',{name:'Veranda'})).toBeVisible();
 await page.locator('.info select').selectOption('ocultas');
 expect(await page.locator('.info select').inputValue()).toBe('ocultas');
});

test('rota, amplía y ejecuta el recorrido automático',async({page})=>{
 await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.camera?.position?.toArray())).toBeTruthy();
 const before=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.position.toArray());
 await page.getByRole('button',{name:'Girar 45 grados'}).click();
 const after=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.position.toArray());
 expect(after).not.toEqual(before);
 const zoom=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.zoom);
 const canvas=page.locator('canvas');await canvas.hover();await page.mouse.wheel(0,-500);await page.waitForTimeout(200);
 expect(await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.zoom)).toBeGreaterThan(zoom);
 await page.getByRole('button',{name:'Recorrido automático'}).click();
 await page.waitForTimeout(3400);
 await expect(page).toHaveURL(/area=/);
});

test('funciona en móvil y no solicita recursos externos',async({page})=>{
 const external:string[]=[];page.on('request',request=>{if(new URL(request.url()).hostname!=='127.0.0.1')external.push(request.url())});
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByRole('button',{name:'Espacios'})).toBeVisible();
 await page.getByRole('button',{name:'Espacios'}).click();
 await expect(page.getByRole('heading',{name:'Explora el proyecto'})).toBeVisible();
 await page.locator('nav').getByRole('button',{name:'Suite',exact:true}).click();
 await expect(page).toHaveURL(/area=suite/);expect(external).toEqual([]);
});

test('estudio solar cambia fecha, hora, estación y trayectoria',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Estudio solar/}).click();
 await expect(page.getByRole('heading',{name:'Iluminación natural'})).toBeVisible();
 await expect(page.getByText(/Estimación solar/)).toBeVisible();
 await expect(page.getByText('America/Sao_Paulo')).toBeVisible();
 const slider=page.getByRole('slider',{name:'Hora local'});await slider.fill('720');
 await page.getByRole('button',{name:'Atardecer'}).click();expect(+await slider.inputValue()).toBeGreaterThan(720);
 await page.getByRole('button',{name:'Verano'}).click();await expect(page.locator('input[type=date]')).toHaveValue(/-12-21$/);
 await page.getByLabel('Mostrar trayectoria solar').uncheck();
 expect(await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.path.visible)).toBe(false);
});
