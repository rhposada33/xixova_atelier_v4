import {expect,test} from '@playwright/test';

test('landing pública apresenta a Promoven e mantém contato não configurado oculto',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page).toHaveTitle('Promoven | Experiências imobiliárias interativas');
  await expect(page.getByRole('heading',{level:1,name:'Transforme empreendimentos em experiências de compra'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Falar com a Promoven'})).toHaveCount(0);
  await expect(page.locator('.hero-gallery img')).toHaveAttribute('src','/marketing/promoven-tower.jpg');
  await expect(page.getByRole('link',{name:/Explorar demonstração/}).first()).toHaveAttribute('href','/demo');
});

test('CTAs comerciais e formulário validam localmente sem transmissão',async({page})=>{
  await page.goto('/');
  await page.getByRole('link',{name:'Agendar uma apresentação'}).click();
  await expect(page).toHaveURL(/#contato$/);
  await expect(page.getByRole('heading',{name:'Vamos avaliar o seu próximo lançamento?'})).toBeVisible();
  await page.getByRole('button',{name:'Solicitar avaliação inicial'}).click();
  await expect(page.getByText('Informe WhatsApp ou e-mail corporativo.')).toBeVisible();
  await page.getByLabel('Nome').fill('Ana Silva');
  await page.getByLabel('Empresa').fill('Construtora Exemplo');
  await page.getByLabel('Cidade / UF').fill('São Paulo / SP');
  await page.getByLabel('E-mail corporativo').fill('ana@exemplo.com');
  await page.getByLabel('Número de unidades').selectOption({label:'31 a 80'});
  await page.getByLabel('Previsão de lançamento').selectOption({label:'De 3 a 6 meses'});
  await page.getByLabel('Possui modelo 3D?').selectOption({label:'Ainda não'});
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Solicitar avaliação inicial'}).click();
  await expect(page.getByText('Validação local concluída')).toBeVisible();
  await expect(page.getByText('não foram transmitidos para a Promoven')).toBeVisible();
  await expect(page.getByRole('link',{name:'Explorar demonstração'}).last()).toHaveAttribute('href','/demo');
});

test('privacidade é pública e rotas privadas não são incluídas no sitemap',async({page})=>{
  await page.goto('/privacidade');
  await expect(page.getByRole('heading',{name:'Política de Privacidade'})).toBeVisible();
  const sitemap=await page.request.get('/sitemap.xml');
  const body=await sitemap.text();
  expect(body).toContain('https://www.promoven.online/privacidade');
  expect(body).not.toContain('/portal');
});

test('menu desliza até a seção sem ocultá-la atrás do cabeçalho',async({page})=>{
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('scroll-behavior','smooth');
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Soluções'}).click();
  await expect(page).toHaveURL(/#solucoes$/);
  await expect.poll(()=>page.locator('#solucoes').evaluate(element=>Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(80);
  await expect.poll(()=>page.locator('#solucoes').evaluate(element=>Math.round(element.getBoundingClientRect().top))).toBeLessThanOrEqual(96);

  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Abrir menu'}).click();
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Experiência 3D'}).click();
  await expect(page.getByRole('button',{name:'Abrir menu'})).toHaveAttribute('aria-expanded','false');
  await expect(page).toHaveURL(/#experiencia$/);
  await expect.poll(()=>page.locator('#experiencia').evaluate(element=>Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(72);
  await expect.poll(()=>page.locator('#experiencia').evaluate(element=>Math.round(element.getBoundingClientRect().top))).toBeLessThanOrEqual(88);

  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('html')).toHaveCSS('scroll-behavior','auto');
});

test('hero alterna as duas imagens locais sem carregar WebGL, GLB ou HDRI',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/');
  const gallery=page.locator('.hero-gallery');
  await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-tower.jpg');
  await expect.poll(()=>gallery.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  const interior=gallery.getByRole('button',{name:'Interior'});
  await interior.focus();await page.keyboard.press('Enter');
  await expect(interior).toHaveAttribute('aria-pressed','true');
  await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-interior.jpg');
  await expect.poll(()=>gallery.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  await gallery.getByRole('button',{name:'Edifício'}).click();
  await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-tower.jpg');
  await page.waitForTimeout(350);
  expect(requests.some(url=>url.includes('/building/promoven-building-v2.glb')||url.includes('studio_small_03_1k.hdr')||/\/three-[^/]+\.js/.test(url))).toBe(false);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('seção inferior carrega o GLB exclusivo Promoven sem inventário ou Supabase',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/');
  await page.locator('#experiencia').scrollIntoViewIfNeeded();
  await expect(page.locator('#experiencia .hero-building')).toHaveAttribute('data-status','ready',{timeout:30_000});
  expect(requests.some(url=>url.endsWith('/building/promoven-building-v2.glb'))).toBe(true);
  expect(requests.some(url=>url.endsWith('/building/xixova-building.glb'))).toBe(false);
  expect(requests.some(url=>url.includes('inventory.json')||url.includes('supabase'))).toBe(false);
});

test('edifício Promoven responde ao mouse e oferece fallback para movimento reduzido',async({page})=>{
  await page.goto('/');
  const preview=page.locator('#experiencia .hero-building');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-status','ready',{timeout:30_000});
  const canvas=preview.locator('canvas');await expect(canvas).toBeVisible();
  const box=await canvas.boundingBox();expect(box).not.toBeNull();
  const oldCamera=await preview.getAttribute('data-camera');
  await page.mouse.move(box!.x+box!.width*.55,box!.y+box!.height*.5);
  await page.mouse.down();await page.mouse.move(box!.x+box!.width*.75,box!.y+box!.height*.5,{steps:8});await page.mouse.up();
  await expect.poll(()=>preview.getAttribute('data-camera')).not.toBe(oldCamera);
  const afterDrag=await preview.getAttribute('data-camera');
  await page.mouse.wheel(0,-250);
  await expect.poll(()=>preview.getAttribute('data-camera')).not.toBe(afterDrag);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-status','fallback');
  await expect(preview.locator('canvas')).toHaveCount(0);
  await expect(preview.locator('img')).toBeVisible();
});

test('preview interrompe renderização quando sai do viewport',async({page})=>{
  await page.goto('/');
  const preview=page.locator('#experiencia .hero-building');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-status','ready',{timeout:30_000});
  await expect.poll(async()=>Number(await preview.getAttribute('data-render-count'))).toBeGreaterThan(2);
  await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
  await expect.poll(()=>preview.evaluate(element=>new Promise<boolean>(resolve=>{
    const observer=new IntersectionObserver(entries=>{resolve(!entries[0].isIntersecting);observer.disconnect();});
    observer.observe(element);
  }))).toBe(true);
  await page.waitForTimeout(150);
  const stopped=await preview.getAttribute('data-render-count');
  await page.waitForTimeout(180);
  await expect(preview).toHaveAttribute('data-render-count',stopped!);
});

test('seção 3D usa o poster quando WebGL não está disponível',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'WebGLRenderingContext',{value:undefined,configurable:true}));
  await page.goto('/');
  const preview=page.locator('#experiencia .hero-building');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-status','fallback');
  await expect(preview.locator('img')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('landing móvel oferece navegação acessível e tabs de experiências',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const menu=page.getByRole('button',{name:'Abrir menu'});await menu.click();
  await expect(page.getByRole('navigation',{name:'Navegação principal'})).toBeVisible();
  await page.getByRole('tab',{name:/Terraza Luz/}).click();
  await expect(page.locator('.browser img')).toHaveAttribute('src','/marketing/terraza-luz.jpg');
  await expect.poll(()=>page.locator('.browser img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link',{name:'Abrir experiência 3D'})).toHaveAttribute('href','/demo?vista=interior&maqueta=terraza_luz&piso=6&unidad=601');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x','scroll');
});

for(const demo of [
  {tab:'Garden House',image:'/marketing/garden-house.jpg',project:'garden_house_18'},
  {tab:'Terraza Luz',image:'/marketing/terraza-luz.jpg',project:'terraza_luz'},
])test(`${demo.tab} mostra imagem local e abre a maqueta correta`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('tab',{name:new RegExp(demo.tab)}).click();
  const image=page.locator('.browser img');
  await expect(image).toHaveAttribute('src',demo.image);
  await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('link',{name:'Abrir experiência 3D'}).click();
  await expect(page).toHaveURL(/\/demo\?/);
  await expect.poll(()=>new URL(page.url()).searchParams.get('maqueta')).toBe(demo.project);
  await expect.poll(()=>new URL(page.url()).searchParams.get('unidad')).toBe('601');
  await expect(page.getByRole('combobox',{name:'Selecionar maquete'})).toHaveValue(demo.project,{timeout:20_000});
});

test('as maquetes na landing giram com o mouse e mantêm apenas um visor ativo',async({page})=>{
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('tab',{name:/Garden House/}).click();
  await expect(page.locator('#experiencia .hero-building')).toHaveAttribute('data-status','fallback');
  const preview=page.locator('.interior-preview');
  await expect(preview).toHaveAttribute('data-status','ready',{timeout:30_000});
  const canvas=preview.locator('canvas');await expect(canvas).toBeVisible();
  const box=await canvas.boundingBox();expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width*.45,box!.y+box!.height*.5);
  await page.mouse.down();await page.mouse.move(box!.x+box!.width*.7,box!.y+box!.height*.5,{steps:8});await page.mouse.up();
  await expect(preview).toHaveAttribute('data-camera',/.+/);
  const firstCamera=await preview.getAttribute('data-camera');
  await page.mouse.move(box!.x+box!.width*.7,box!.y+box!.height*.5);
  await page.mouse.down();await page.mouse.move(box!.x+box!.width*.4,box!.y+box!.height*.5,{steps:8});await page.mouse.up();
  await expect.poll(()=>preview.getAttribute('data-camera')).not.toBe(firstCamera);
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('tab',{name:/Terraza Luz/}).click();
  await expect(page.locator('.interior-preview')).toHaveAttribute('data-project','terraza_luz');
  await expect(page.locator('.interior-preview')).toHaveAttribute('data-status','ready',{timeout:30_000});
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('#experiencia').getByRole('button',{name:'Ativar visualização 3D do edifício'}).click();
  await expect(page.locator('#experiencia .hero-building')).toHaveAttribute('data-status','ready',{timeout:30_000});
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('compatibilidade legacy normaliza a URL da demonstração',async({page})=>{
  await page.goto('/?vista=edificio&unidad=1203&desconhecido=1');
  await expect(page).toHaveURL(/\/demo\?vista=edificio&unidad=1203$/);
  await expect(page.getByRole('heading',{name:/Encontre seu apartamento ideal/})).toBeVisible();
});

test('demo direta remove parâmetros desconhecidos',async({page})=>{
  await page.goto('/demo?vista=edificio&unidad=1203&token=segredo');
  await expect(page).toHaveURL(/\/demo\?vista=edificio&unidad=1203$/);
});

test('query comum não desvia a landing e rota desconhecida mostra 404',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/?utm_source=campanha');
  await expect(page.getByRole('heading',{level:1})).toContainText('Transforme empreendimentos');
  await page.goto('/nao-existe');
  await expect(page.getByRole('heading',{name:'Página não encontrada'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Abrir demonstração'})).toHaveAttribute('href','/demo');
});
