# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: marketing.spec.ts >> query comum não desvia a landing e rota desconhecida mostra 404
- Location: tests/marketing.spec.ts:153:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8892/?utm_source=campanha
Call log:
  - navigating to "http://127.0.0.1:8892/?utm_source=campanha", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: 127.0.0.1
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
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
  96  |   await page.getByRole('tab',{name:/Terraza Luz/}).click();
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
> 155 |   await page.goto('/?utm_source=campanha');
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8892/?utm_source=campanha
  156 |   await expect(page.getByRole('heading',{level:1})).toContainText('Transforme empreendimentos');
  157 |   await page.goto('/nao-existe');
  158 |   await expect(page.getByRole('heading',{name:'Página não encontrada'})).toBeVisible();
  159 |   await expect(page.getByRole('link',{name:'Abrir demonstração'})).toHaveAttribute('href','/demo');
  160 | });
  161 | 
```