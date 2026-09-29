import {expect,test} from '@playwright/test';

test('landing pública apresenta a Promoven e mantém captação desativada sem dados legais',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page).toHaveTitle('Promoven | Experiências imobiliárias interativas');
  await expect(page.getByRole('heading',{level:1,name:'Transforme empreendimentos em experiências de compra'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Agendar uma apresentação'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Solicitar avaliação inicial'})).toHaveCount(0);
  await expect(page.locator('.hero-gallery img')).toHaveAttribute('src','/marketing/promoven-interior.jpg');
  await expect(page.getByRole('link',{name:/Explorar demonstração/}).first()).toHaveAttribute('href','/demo');
});

test('a página explica que o canal comercial ainda está em preparação',async({page})=>{
  await page.goto('/');
  await expect(page.getByText('O canal de solicitações comerciais está em preparação.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Explorar demonstração'}).last()).toHaveAttribute('href','/demo');
});

test('a disponibilidade ilustrativa é coerente e não promete abrir uma unidade real',async({page})=>{
  await page.goto('/');
  const cells=page.locator('.availability-cell');
  const available=await cells.filter({hasText:/Disponível/}).count();
  const reserved=await cells.filter({hasText:/Reservada/}).count();
  const sold=await cells.filter({hasText:/Vendida/}).count();
  expect(available+reserved+sold).toBe(60);
  await expect(page.locator('.availability-summary strong').nth(0)).toHaveText(String(available));
  await expect(page.locator('.availability-summary strong').nth(1)).toHaveText(String(reserved));
  await expect(page.locator('.availability-summary strong').nth(2)).toHaveText(String(sold));
  await expect(page.getByText('Filtrar unidades')).toHaveCount(0);
  await expect(page.locator('.availability-card').getByRole('link',{name:/Explorar demonstração/})).toHaveAttribute('href','/demo');
  await expect(page.locator('.availability-card')).toContainText('preço ilustrativo');
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
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Benefícios'}).click();
  await expect(page).toHaveURL(/#beneficios$/);
  await expect(page.locator('#beneficios')).toBeInViewport();

  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Abrir menu'}).click();
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Benefícios'}).click();
  await expect(page.getByRole('button',{name:'Abrir menu'})).toHaveAttribute('aria-expanded','false');
  await expect(page).toHaveURL(/#beneficios$/);
  await expect(page.locator('#beneficios')).toBeInViewport();

  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('html')).toHaveCSS('scroll-behavior','auto');
});

test('hero alterna as duas imagens locais sem carregar WebGL, GLB ou HDRI',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/');
  const gallery=page.locator('.hero-gallery');
  await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-interior.jpg');
  await expect.poll(()=>gallery.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  const building=gallery.getByRole('button',{name:'Edifício'});
  await building.focus();await page.keyboard.press('Enter');
  await expect(building).toHaveAttribute('aria-pressed','true');
  await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-tower.jpg');
  await expect.poll(()=>gallery.locator('img').evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
  await gallery.getByRole('button',{name:'Interior'}).click();
  await expect(gallery.locator('img')).toHaveAttribute('src','/marketing/promoven-interior.jpg');
  await page.waitForTimeout(350);
  expect(requests.some(url=>url.includes('/building/promoven-building-v2.glb')||url.includes('studio_small_03_1k.hdr')||/\/three-[^/]+\.js/.test(url))).toBe(false);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('ilustração de iluminação permanece arquivada e não carrega recursos 3D na landing',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('#experiencia,.building-feature,.hero-building,.lighting-preview')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Experiência 3D'})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Navegação do rodapé'}).getByRole('link',{name:'Experiência 3D'})).toHaveCount(0);
  await page.waitForTimeout(350);
  expect(requests.some(url=>url.includes('/building/promoven-building-v2.glb')||url.includes('studio_small_03_1k.hdr')||url.includes('/marketing/lighting/')||/\/three-[^/]+\.js/.test(url))).toBe(false);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('landing móvel oferece navegação, disponibilidade e acesso à demonstração',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const menu=page.getByRole('button',{name:'Abrir menu'});await menu.click();
  await expect(page.getByRole('navigation',{name:'Navegação principal'})).toBeVisible();
  await expect(page.locator('.menu-button')).toHaveCSS('min-height','44px');
  await page.getByRole('button',{name:/Unidade 1201/}).click();
  await expect(page.locator('.availability-card')).toContainText('preço ilustrativo');
  await page.locator('.availability-view img').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.locator('.availability-view img').evaluate((image:HTMLImageElement)=>image.currentSrc)).toContain('promoven-view-coast-mobile.webp');
  await expect(page.locator('body')).not.toHaveCSS('overflow-x','scroll');
  await expect(page.getByRole('link',{name:/Explorar demonstração/}).first()).toHaveAttribute('href','/demo');
});

test('compatibilidade legacy normaliza a URL da demonstração',async({page})=>{
  await page.goto('/?vista=edificio&unidad=1203&desconhecido=1');
  await expect(page).toHaveURL(/\/demo\?vista=edificio&unidad=1203$/);
  await expect(page.getByRole('heading',{name:/Encontre seu apartamento ideal/})).toBeVisible({timeout:20_000});
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
