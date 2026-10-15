import {expect as baseExpect,test} from '@playwright/test';

const expect=baseExpect.configure({timeout:20_000});

test.setTimeout(60_000);
test.use({actionTimeout:20_000});

test.beforeEach(async({page})=>{
  await page.goto('/demo');
  await page.evaluate(()=>{sessionStorage.clear();localStorage.clear();});
  await page.reload();
  await expect(page.locator('.b-card-heading h2')).toBeVisible({timeout:20_000});
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203');
});

test('favoritos persistem e comparação acompanha a seleção',async({page})=>{
  await page.locator('.b-v2-card-actions').getByRole('button',{name:'Favoritar',exact:true}).click();
  await expect(page.locator('.b-v2-card-actions').getByRole('button',{name:'Favoritada',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.locator('.b-card-heading h2')).toBeVisible({timeout:20_000});
  await expect(page.locator('.b-v2-card-actions').getByRole('button',{name:'Favoritada',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.locator('.building-header-actions').getByRole('button',{name:/Favoritos/}).click();
  await expect(page.getByRole('dialog')).toContainText('Unidade 1203');
  await page.keyboard.press('Escape');
  await page.locator('.b-v2-card-actions').getByRole('button',{name:'Comparar',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Unidades',exact:true}).click();
  await page.getByRole('button',{name:'Unidade 1204, Disponível, 146 metros quadrados'}).click();
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1204');
  await page.locator('.b-v2-card-actions').getByRole('button',{name:'Comparar',exact:true}).click();
  await page.getByRole('navigation').getByRole('button',{name:/Comparar/}).click();
  await expect(page.getByRole('dialog')).toContainText('Unidade 1203');
  await expect(page.getByRole('dialog')).toContainText('Unidade 1204');
});

test('WhatsApp prepara a unidade e um link navegável sem enviar mensagem',async({page})=>{
  await page.evaluate(()=>{window.open=(url)=>{document.body.dataset.outbound=String(url);return null;};});
  await page.locator('.b-unit-card').getByRole('button',{name:'Falar pelo WhatsApp',exact:true}).click();
  const outgoing=await page.locator('body').getAttribute('data-outbound');
  const target=new URL(outgoing!);
  expect(target.hostname).toBe('wa.me');
  const message=target.searchParams.get('text')!;
  expect(message).toContain('Unidade 1203');
  const link=message.split('Link: ')[1];
  expect(new URL(link).pathname).toBe('/demo');
  await page.goto(link);
  await expect(page.locator('.b-card-heading h2')).toHaveText('Unidade 1203');
});
