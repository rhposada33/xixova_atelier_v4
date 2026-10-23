import {test,expect} from '@playwright/test';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
test('privacidade administrativa sem execução irreversível e preview sem PII',async({page})=>{
 test.skip(!process.env.CONNECT_E2E_EMAIL,'Conta sintética local ausente');
 const pilot=JSON.parse(await readFile('pilot-results/pc07a.json','utf8')) as {organizationId:string};
 const db=new pg.Client({host:'127.0.0.1',port:56322,user:'postgres',password:'postgres',database:'postgres'});await db.connect();
 const lead=randomUUID(),ticket=`PRIVACY-E2E-${Date.now()}`,canary=`Synthetic buyer ${randomUUID()}`;
 try{
  const project=(await db.query('select id from public.projects where organization_id=$1 limit 1',[pilot.organizationId])).rows[0].id as string;
  await db.query("insert into public.leads(id,organization_id,project_id,buyer_name,contact_channel,contact_value,message,source,privacy_notice_version) values($1,$2,$3,$4,'email',$5,$4,'public','2026-10-23')",[lead,pilot.organizationId,project,canary,`${lead}@example.invalid`]);
 }finally{await db.end();}
 await page.goto('/login');await page.getByLabel('E-mail').fill(process.env.CONNECT_E2E_EMAIL!);await page.getByLabel('Senha',{exact:true}).fill(process.env.CONNECT_E2E_PASSWORD!);await page.getByRole('button',{name:'Entrar no portal'}).click();
 await page.getByRole('combobox',{name:'Organização ativa'}).selectOption(pilot.organizationId);
 await page.getByRole('link',{name:'Privacidade',exact:true}).click();
 await page.getByLabel('Identificador do lead').fill(lead);await page.getByLabel('Protocolo sem dados pessoais').fill(ticket);await page.getByRole('button',{name:'Registrar solicitação',exact:true}).click();
 const row=page.locator('article').filter({hasText:ticket});await expect(row).toBeVisible();
 await row.getByRole('button',{name:'Registrar verificação de identidade'}).click();await expect(row.getByText('Identidade verificada',{exact:true})).toBeVisible();
 await row.getByRole('button',{name:'Aprovar revisão independente'}).click();await expect(page.getByRole('alert')).toContainText('Acesso negado');
 await row.getByRole('button',{name:'Registrar retenção legal'}).click();await expect(row).toContainText('Retenção legal ativa');
 await row.getByRole('button',{name:'Ver preview'}).click();const preview=page.getByRole('region',{name:'Preview sem dados pessoais'});await expect(preview).toContainText('Bloqueado por retenção legal');
 await expect(page.getByText(canary,{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Executar|Anonimizar|Eliminar/})).toHaveCount(0);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/visuals/privacy-${width}.png`,fullPage:true});}
 await page.getByRole('combobox',{name:'Organização ativa'}).selectOption({label:'Segundo piloto'});await expect(page.getByText('Esta área exige um administrador da organização.')).toBeVisible();await expect(page.getByText(ticket)).toHaveCount(0);
});
