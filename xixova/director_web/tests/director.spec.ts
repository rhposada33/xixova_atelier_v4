import{test,expect}from'@playwright/test';

test('reproduce la cámara y descubre los guiones',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.viewtag',{hasText:'VISTA 3D'})).toBeVisible();
 await page.getByRole('button',{name:/guion activo/i}).click();
 await expect(page.getByRole('heading',{name:'Guiones del proyecto'})).toBeVisible();
 await expect(page.getByText('Guion de cámara original')).toBeVisible();
 await page.getByRole('button',{name:'×'}).click();
 const before=await page.evaluate(()=>(window as any).__XIXOVA_DIRECTOR__.film.position.toArray());
 await page.locator('.transport .play').click();
 await expect(page.getByText(/CÁMARA ACTIVA/)).toBeVisible();
 await page.waitForTimeout(700);
 const after=await page.evaluate(()=>(window as any).__XIXOVA_DIRECTOR__.film.position.toArray());
 expect(after).not.toEqual(before);
 await expect(page.locator('.transport code')).not.toContainText('0.00s');
});

test('la vista libre orbita con el botón central',async({page})=>{
 await page.goto('/');
 const canvas=page.locator('.viewport canvas'),box=await canvas.boundingBox();expect(box).toBeTruthy();
 const before=await page.evaluate(()=>(window as any).__XIXOVA_DIRECTOR__.free.position.toArray());
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
 await page.mouse.down({button:'middle'});await page.mouse.move(box!.x+box!.width*.7,box!.y+box!.height*.35,{steps:8});await page.mouse.up({button:'middle'});
 await page.waitForTimeout(150);
 const after=await page.evaluate(()=>(window as any).__XIXOVA_DIRECTOR__.free.position.toArray());
 expect(after).not.toEqual(before);
});

test('abre el panel integrado de Validar toma',async({page})=>{
 await page.route('**/api/preview/shot',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'demo',tipo:'shot',toma:'sala_presentacion',estado:'ejecutando',progreso:.2,artefactos:[]})}));
 await page.goto('/');
 await page.getByRole('button',{name:'Validar toma'}).click();
 await expect(page.getByRole('heading',{name:'Validar toma'})).toBeVisible();
 await expect(page.getByText('Renderizando imágenes…')).toBeVisible();
});

test('propone un recorrido por todas las áreas sin cambiar el guion',async({page})=>{
 await page.goto('/');const title=await page.locator('.scriptpicker b').textContent();
 await page.getByRole('button',{name:/Crear recorrido automático/}).click();
 await expect(page.getByRole('heading',{name:'¿Qué áreas mostramos?'})).toBeVisible();
 await page.getByRole('button',{name:'Continuar'}).click();
 await expect(page.getByText(/áreas · aproximadamente/)).toBeVisible();
 await page.getByRole('button',{name:'Generar propuesta'}).click();
 await expect(page.getByRole('heading',{name:/Propuesta/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Guardar como guion'})).toBeEnabled();
 await page.getByRole('button',{name:'×'}).click();
 await expect(page.locator('.scriptpicker b')).toHaveText(title||'');
});
