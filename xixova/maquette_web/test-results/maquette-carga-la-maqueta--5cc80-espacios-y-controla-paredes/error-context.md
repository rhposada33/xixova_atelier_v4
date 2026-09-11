# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: maquette.spec.ts >> carga la maqueta, selecciona espacios y controla paredes
- Location: tests/maquette.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Garden House')
Expected: visible
Error: strict mode violation: getByText('Garden House') resolved to 2 elements:
    1) <strong>Garden House</strong> aka getByRole('strong').filter({ hasText: 'Garden House' })
    2) <option value="garden">Garden House</option> aka getByLabel('Seleccionar maqueta')

Call log:
  - Expect "toBeVisible" getByText('Garden House') with timeout 5000ms
  - waiting for getByText('Garden House')

```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: XV
      - generic [ref=e7]:
        - strong [ref=e8]: XIXOVA
        - generic [ref=e9]: MAQUETA INTERACTIVA
    - generic [ref=e10]:
      - strong [ref=e11]: Garden House
      - generic [ref=e12]: lujo contemporaneo
    - combobox "Seleccionar maqueta" [ref=e13]:
      - option "Garden House" [selected]
      - option "Terraza Luz"
    - button "☀ Estudio solar" [ref=e14] [cursor=pointer]
  - generic [ref=e15]:
    - complementary [ref=e16]:
      - heading "Explora el proyecto" [level=2] [ref=e17]
      - paragraph [ref=e18]: Selecciona un espacio para conocer su distribución.
      - img [ref=e19]:
        - generic [ref=e20] [cursor=pointer]
        - generic [ref=e21] [cursor=pointer]
        - generic [ref=e22] [cursor=pointer]
        - generic [ref=e23] [cursor=pointer]
        - generic [ref=e24] [cursor=pointer]
        - generic [ref=e25] [cursor=pointer]
        - generic [ref=e26] [cursor=pointer]
        - generic [ref=e27] [cursor=pointer]
        - generic [ref=e28] [cursor=pointer]
      - navigation [ref=e29]:
        - button "Veranda" [ref=e30] [cursor=pointer]:
          - generic [ref=e32]:
            - text: Veranda
            - generic [ref=e33]: · 14,57 m²
        - button "Área servicio" [ref=e34] [cursor=pointer]:
          - generic [ref=e36]:
            - text: Área servicio
            - generic [ref=e37]: · 2,25 m²
        - button "Cocina" [ref=e38] [cursor=pointer]:
          - generic [ref=e40]:
            - text: Cocina
            - generic [ref=e41]: · 6,07 m²
        - button "Sala comedor" [ref=e42] [cursor=pointer]:
          - generic [ref=e44]:
            - text: Sala comedor
            - generic [ref=e45]: · 15,13 m²
        - button "Circulación" [ref=e46] [cursor=pointer]:
          - generic [ref=e48]:
            - text: Circulación
            - generic [ref=e49]: · 3,85 m²
        - button "Dormitorio" [ref=e50] [cursor=pointer]:
          - generic [ref=e52]:
            - text: Dormitorio
            - generic [ref=e53]: · 8,12 m²
        - button "Suite" [ref=e54] [cursor=pointer]:
          - generic [ref=e56]:
            - text: Suite
            - generic [ref=e57]: · 10,79 m²
        - button "Baño social" [ref=e58] [cursor=pointer]:
          - generic [ref=e60]:
            - text: Baño social
            - generic [ref=e61]: · 2,96 m²
        - button "Baño Suite" [ref=e62] [cursor=pointer]:
          - generic [ref=e64]:
            - text: Baño Suite
            - generic [ref=e65]: · 2,94 m²
    - generic [ref=e66]:
      - generic:
        - button "Veranda" [ref=e68] [cursor=pointer]
        - button "Área servicio" [ref=e69] [cursor=pointer]
        - button "Cocina" [ref=e70] [cursor=pointer]
        - button "Sala comedor" [ref=e71] [cursor=pointer]
        - button "Circulación" [ref=e72] [cursor=pointer]
        - button "Dormitorio" [ref=e73] [cursor=pointer]
        - button "Suite" [ref=e74] [cursor=pointer]
        - button "Baño social" [ref=e75] [cursor=pointer]
        - button "Baño Suite" [ref=e76] [cursor=pointer]
      - generic "Norte verdadero según la orientación configurada" [ref=e77]:
        - generic [ref=e78]: ↑
        - generic [ref=e79]: "N"
      - generic [ref=e80]:
        - button "Vista inicial" [ref=e81] [cursor=pointer]: ⌂
        - button "Girar 45 grados" [ref=e82] [cursor=pointer]: ↻ 45°
        - button "Guardar imagen" [ref=e83] [cursor=pointer]: ▣
      - generic: Arrastra para rotar · Rueda para acercar · Selecciona para explorar
    - complementary [ref=e84]:
      - heading "Exploración" [level=3] [ref=e85]
      - button "Recorrido automático" [ref=e86] [cursor=pointer]
      - generic [ref=e87]:
        - heading "Capas" [level=3] [ref=e88]
        - combobox "Modo de paredes" [ref=e89]:
          - option "Paredes inteligentes" [selected]
          - option "Todas las paredes"
          - option "Sólo contorno"
          - option "Sin paredes"
        - generic [ref=e90]:
          - checkbox "Marcadores de ambientes" [checked] [ref=e91]
          - text: Marcadores de ambientes
```

# Test source

```ts
  1  | import{test,expect}from'@playwright/test';
  2  | 
  3  | test('carga la maqueta, selecciona espacios y controla paredes',async({page})=>{
  4  |  await page.goto('/');
> 5  |  await expect(page.getByText('Garden House')).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  6  |  await expect(page.locator('canvas')).toBeVisible();
  7  |  await expect(page.getByText('Veranda',{exact:true}).first()).toBeVisible();
  8  |  await page.locator('nav').getByRole('button',{name:'Veranda'}).click();
  9  |  await expect(page).toHaveURL(/area=veranda/);
  10 |  await expect(page.locator('.info article').getByRole('heading',{name:'Veranda'})).toBeVisible();
  11 |  await page.locator('.info select').selectOption('ocultas');
  12 |  expect(await page.locator('.info select').inputValue()).toBe('ocultas');
  13 | });
  14 | 
  15 | test('rota, amplía y ejecuta el recorrido automático',async({page})=>{
  16 |  await page.goto('/');
  17 |  await expect.poll(()=>page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__?.camera?.position?.toArray())).toBeTruthy();
  18 |  const before=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.position.toArray());
  19 |  await page.getByRole('button',{name:'Girar 45 grados'}).click();
  20 |  const after=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.position.toArray());
  21 |  expect(after).not.toEqual(before);
  22 |  const zoom=await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.zoom);
  23 |  const canvas=page.locator('canvas');await canvas.hover();await page.mouse.wheel(0,-500);await page.waitForTimeout(200);
  24 |  expect(await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.camera.zoom)).toBeGreaterThan(zoom);
  25 |  await page.getByRole('button',{name:'Recorrido automático'}).click();
  26 |  await page.waitForTimeout(3400);
  27 |  await expect(page).toHaveURL(/area=/);
  28 | });
  29 | 
  30 | test('funciona en móvil y no solicita recursos externos',async({page})=>{
  31 |  const external:string[]=[];page.on('request',request=>{if(new URL(request.url()).hostname!=='127.0.0.1')external.push(request.url())});
  32 |  await page.setViewportSize({width:390,height:844});await page.goto('/');
  33 |  await expect(page.getByRole('button',{name:'Espacios'})).toBeVisible();
  34 |  await page.getByRole('button',{name:'Espacios'}).click();
  35 |  await expect(page.getByRole('heading',{name:'Explora el proyecto'})).toBeVisible();
  36 |  await page.locator('nav').getByRole('button',{name:'Suite',exact:true}).click();
  37 |  await expect(page).toHaveURL(/area=suite/);expect(external).toEqual([]);
  38 | });
  39 | 
  40 | test('estudio solar cambia fecha, hora, estación y trayectoria',async({page})=>{
  41 |  await page.goto('/');await page.getByRole('button',{name:/Estudio solar/}).click();
  42 |  await expect(page.getByRole('region',{name:'Estudio solar'})).toBeVisible();await expect(page.getByText('ILUMINACIÓN NATURAL')).toBeVisible();
  43 |  await expect(page.getByText(/Estimación/)).toBeVisible();
  44 |  await expect(page.getByText('America/Sao_Paulo')).toBeVisible();
  45 |  const slider=page.getByRole('slider',{name:'Hora local'});await slider.fill('720');
  46 |  await page.getByRole('button',{name:'Atardecer'}).click();expect(+await slider.inputValue()).toBeGreaterThan(720);
  47 |  await page.getByRole('button',{name:'Verano'}).click();await expect(page.locator('input[type=date]')).toHaveValue(/-12-21$/);
  48 |  await page.getByLabel('Mostrar trayectoria').uncheck();
  49 |  expect(await page.evaluate(()=>(window as any).__XIXOVA_MAQUETA__.path.visible)).toBe(false);
  50 | });
  51 | 
```