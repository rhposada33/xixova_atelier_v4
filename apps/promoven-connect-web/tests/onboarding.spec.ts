import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('roteiro do piloto, recuperação de erro e navegação por teclado',async({page})=>{
 test.skip(!process.env.CONNECT_E2E_EMAIL,'Conta sintética local ausente');
 const pilot=JSON.parse(await readFile('pilot-results/pc07c1.json','utf8')) as {organizationId:string};
 await page.goto('/login');
 await page.getByLabel('E-mail').fill(process.env.CONNECT_E2E_EMAIL!);
 await page.getByLabel('Senha',{exact:true}).fill(process.env.CONNECT_E2E_PASSWORD!);
 await page.getByRole('button',{name:'Entrar no portal'}).click();
 await page.getByRole('combobox',{name:'Organização ativa'}).selectOption(pilot.organizationId);
 await page.getByRole('link',{name:'Preparar minha operação →'}).click();
 await expect(page.getByRole('heading',{name:'Preparar minha operação'})).toBeVisible();
 await expect(page.getByText('8 de 8 etapas com dados registrados')).toBeVisible();
 for(const width of [390,768,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/visuals/onboarding-${width}.png`,fullPage:true});
 }
 await page.getByLabel('E-mail da conta').fill('absent-pc07a@test.local');
 await page.getByRole('button',{name:'Adicionar membro'}).click();
 await expect(page.getByRole('status')).toContainText('ainda não foi provisionada');
 await page.route('**/rest/v1/rpc/connect_onboarding',route=>route.fulfill({status:503,body:'{}'}));
 await page.getByRole('button',{name:'Atualizar progresso'}).click();
 await expect(page.getByRole('alert')).toContainText('Não foi possível');
 await page.unroute('**/rest/v1/rpc/connect_onboarding');
 await page.getByRole('button',{name:'Tentar novamente'}).click();
 await expect(page.getByText('8 de 8 etapas com dados registrados')).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 const menu=page.getByRole('button',{name:/Menu/});
 await menu.focus();await page.keyboard.press('Enter');
 await expect(menu).toHaveAttribute('aria-expanded','true');
 await page.getByRole('link',{name:'Primeiros passos',exact:true}).focus();
 await expect(page.getByRole('link',{name:'Primeiros passos',exact:true})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Preparar minha operação'})).toBeVisible();
 await page.getByRole('combobox',{name:'Organização ativa'}).selectOption({label:'Segundo piloto'});
 await expect(page.getByRole('heading',{name:'Configurar equipe interna'})).toHaveCount(0);
});
