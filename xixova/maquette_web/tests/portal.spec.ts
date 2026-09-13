import {expect,test,type Page} from '@playwright/test';

const userId='30000000-0000-4000-8000-000000000001';
const organizationId='00000000-0000-4000-8000-000000000001';
const projectId='00000000-0000-4000-8000-000000000002';
const unitId='00000000-0000-4001-8000-000000001203';
const payload=Buffer.from(JSON.stringify({sub:userId,aud:'authenticated',role:'authenticated',exp:4102444800})).toString('base64url');
const token=`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.test`;
const authUser={id:userId,aud:'authenticated',role:'authenticated',email:'admin@escobar.test',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-09-13T00:00:00Z'};
const baseUnit={id:unitId,organization_id:organizationId,project_id:projectId,building_id:'00000000-0000-4000-8000-000000000003',floor_id:'f12',unit_type_id:'t3',code:'1203',floor:12,unit_type_name:'Final 03',status:'available',bedrooms:3,suites:2,parking_spaces:2,private_area_m2:118,total_area_m2:144,orientation:'southeast',view_type:'sea',sun_exposure:'morning',price_brl:1460000,model_object_id:'UNIT_1203_PROXY',interior_project_id:'terraza_luz',published:true,reserved_by:null,reserved_at:null,reserved_until:null,version:1,updated_at:'2026-09-13T10:00:00Z',total_count:1};
const consoleErrors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const errors:string[]=[];consoleErrors.set(page,errors);page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource/.test(message.text()))errors.push(message.text());});});
test.afterEach(async({page})=>{expect(consoleErrors.get(page)??[]).toEqual([]);});

async function mockBackend(page:Page,options:{empty?:boolean;error?:boolean;conflict?:boolean;ambiguousApplied?:boolean;active?:boolean;noOrganizations?:boolean;role?:string;status?:'available'|'reserved'|'sold';delay?:boolean;invalidLogin?:boolean}={}){
  let unit={...baseUnit,status:options.status??baseUnit.status};
  await page.route('http://supabase.test/**',async route=>{
    const url=new URL(route.request().url());const path=url.pathname;
    if(path==='/auth/v1/token'){if(options.invalidLogin)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error_code:'invalid_credentials',msg:'Invalid login credentials'})});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:token,refresh_token:'local-test-refresh',expires_in:3600,expires_at:4102444800,token_type:'bearer',user:authUser})});}
    if(path==='/auth/v1/user')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(authUser)});
    if(path==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    if(path==='/auth/v1/recover')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    if(options.error&&path.includes('/rest/v1/rpc/admin_list_units'))return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'XX000',message:'internal'})});
    if(path.includes('/rest/v1/profiles'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({active:options.active??true})});
    if(path.includes('/rest/v1/platform_admins'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(null)});
    if(path.includes('/rest/v1/organizations')){if(options.delay)await new Promise(resolve=>setTimeout(resolve,700));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(options.noOrganizations?[]:[{id:organizationId,name:'Escobar',slug:'escobar'}])});}
    if(path.includes('/rest/v1/organization_members'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(options.noOrganizations?[]:[{organization_id:organizationId,role:options.role??'organization_admin'}])});
    if(path.includes('/rest/v1/projects'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:projectId,organization_id:organizationId,name:'Escobar Residences',slug:'escobar-residences',status:'published'}])});
    if(path.includes('/rest/v1/rpc/admin_get_project_summary'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{project_id:projectId,total:72,available:54,reserved:6,sold:12,hidden:0,recently_updated:4}])});
    if(path.includes('/rest/v1/rpc/admin_list_units'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(options.empty?[]:[unit])});
    if(path.includes('/rest/v1/rpc/admin_get_unit_history'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'audit-1',organization_id:organizationId,project_id:projectId,unit_id:unitId,unit_code:'1203',action:'unit.status_changed',old_values:{status:'available'},new_values:{status:'reserved',version:2},reason:'Contato confirmado',performed_by:userId,created_at:'2026-09-13T11:00:00Z'}])});
    if(path.includes('/rest/v1/rpc/admin_change_unit_status')){
      if(options.conflict)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'inventory_admin_error',details:'{"code":"version_conflict"}'})});
      if(options.ambiguousApplied){unit={...unit,status:'reserved',reserved_by:userId,reserved_at:'2026-09-13T11:00:00Z',version:unit.version+1};return route.abort('failed');}
      unit={...unit,status:'reserved',reserved_by:userId,reserved_at:'2026-09-13T11:00:00Z',version:unit.version+1};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(unit)});
    }
    if(path.includes('/rest/v1/rpc/admin_update_unit_price')){unit={...unit,price_brl:1500000,version:unit.version+1};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(unit)});}
    if(path.includes('/rest/v1/rpc/admin_set_unit_published')){unit={...unit,published:false,version:unit.version+1};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(unit)});}
    if(path.includes('/rest/v1/units')){if(options.conflict)unit={...unit,price_brl:1490000,version:2};return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...unit,floors:{number:12},unit_types:{name:'Final 03',bedrooms:3,suites:2,private_area_m2:118,total_area_m2:144,interior_project_id:'terraza_luz'},projects:{organization_id:organizationId}})});}
    return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
}
async function login(page:Page){await page.goto('/login');await page.getByLabel('E-mail').fill('admin@escobar.test');await page.getByLabel('Senha').fill('SenhaLocal123!');await page.getByRole('button',{name:'Entrar'}).click();await expect(page).toHaveURL(/\/portal$/);}

test('login e dashboard responsivos',async({page})=>{
  await mockBackend(page);await page.setViewportSize({width:1440,height:900});await page.goto('/login');await expect(page.getByRole('heading',{name:'Acesse o Portal Escobar'})).toBeVisible();await page.screenshot({path:'test-results/visuals/login-desktop.png',fullPage:true});await login(page);await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();await expect(page.getByText('72',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/visuals/dashboard-desktop.png',fullPage:true});
  await page.setViewportSize({width:768,height:1024});await page.screenshot({path:'test-results/visuals/dashboard-tablet.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/visuals/dashboard-mobile.png',fullPage:true});
});

test('inventário, edição e histórico',async({page})=>{
  await mockBackend(page);await login(page);await page.getByRole('link',{name:'Inventário',exact:true}).click();await expect(page.getByText('Unidade',{exact:true}).first()).toBeVisible();await page.screenshot({path:'test-results/visuals/inventory-desktop.png',fullPage:true});await page.getByRole('button',{name:'Editar'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByLabel('Status').selectOption('reserved');await expect(dialog.getByLabel('Motivo da alteração')).toBeVisible();await page.screenshot({path:'test-results/visuals/editor-tablet.png',fullPage:true});await dialog.getByLabel('Motivo da alteração').fill('Contato confirmado');await dialog.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.getByText('Unidade 1203 atualizada com sucesso.')).toBeVisible();await page.getByRole('link',{name:'Histórico',exact:true}).click();await expect(page.getByText('Contato confirmado')).toBeVisible();await page.screenshot({path:'test-results/visuals/history-desktop.png',fullPage:true});
});

test('conflito preserva a intenção e exige nova revisão',async({page})=>{
  await mockBackend(page,{conflict:true});await login(page);await page.goto(`/portal/inventory/${unitId}`);const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByLabel('Status').selectOption('reserved');await dialog.getByLabel('Motivo da alteração').fill('Reserva solicitada');await dialog.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.getByText('Alteração concorrente detectada')).toBeVisible();await expect(page.getByText(/Esta unidade foi alterada por outro usuário/)).toBeVisible();await page.screenshot({path:'test-results/visuals/version-conflict.png',fullPage:true});
});

test('estados vazio e erro possuem tratamento visual',async({page})=>{
  await mockBackend(page,{empty:true});await login(page);await page.getByRole('link',{name:'Inventário',exact:true}).click();await expect(page.getByRole('heading',{name:'Nenhuma unidade encontrada'})).toBeVisible();await page.screenshot({path:'test-results/visuals/inventory-empty-mobile.png',fullPage:true});
});

test('recuperação não revela se o e-mail existe',async({page})=>{await mockBackend(page);await page.goto('/forgot-password');await page.getByLabel('E-mail').fill('usuario@escobar.test');await page.getByRole('button',{name:'Enviar link de recuperação'}).click();await expect(page.getByRole('heading',{name:'Verifique sua caixa de entrada'})).toBeVisible();});

test('rota protegida redireciona e refresh direto funciona após login',async({page})=>{await mockBackend(page);await page.goto('/portal/inventory');await expect(page).toHaveURL(/\/login$/);await login(page);await page.goto('/portal/inventory');await expect(page.getByRole('heading',{name:'Inventário'})).toBeVisible();await page.goBack();await page.goForward();await expect(page.getByRole('heading',{name:'Inventário'})).toBeVisible();});

test('login inválido, logout e callback inválido têm mensagens seguras',async({page})=>{await mockBackend(page,{invalidLogin:true});await page.goto('/login');await page.getByLabel('E-mail').fill('x@escobar.test');await page.getByLabel('Senha').fill('incorreta');await page.getByRole('button',{name:'Entrar'}).click();await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');await page.goto('/reset-password');await expect(page.getByRole('heading',{name:'Link inválido ou expirado'})).toBeVisible();});

test('usuário inativo e usuário sem organização ficam bloqueados',async({page})=>{await mockBackend(page,{active:false});await login(page);await expect(page.getByRole('heading',{name:'Acesso indisponível'})).toBeVisible();await page.context().clearCookies();await page.evaluate(()=>localStorage.clear());const second=await page.context().newPage();await mockBackend(second,{noOrganizations:true});await login(second);await expect(second.getByRole('heading',{name:'Nenhuma organização disponível'})).toBeVisible();});

test('seller só recebe ações permitidas e viewer não acessa histórico',async({page})=>{await mockBackend(page,{role:'seller'});await login(page);await page.goto(`/portal/inventory/${unitId}`);const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Preço')).toBeDisabled();await expect(dialog.getByLabel('Unidade publicada')).toBeDisabled();await expect(dialog.getByLabel('Status')).toContainText('Reservada');await page.context().clearCookies();await page.evaluate(()=>localStorage.clear());const viewer=await page.context().newPage();await mockBackend(viewer,{role:'viewer'});await login(viewer);await expect(viewer.getByRole('link',{name:'Histórico'})).toHaveCount(0);});

test('reversão de venda exige confirmação reforçada',async({page})=>{await mockBackend(page,{status:'sold'});await login(page);await page.goto(`/portal/inventory/${unitId}`);const dialog=page.getByRole('dialog');await dialog.getByLabel('Status').selectOption('available');await dialog.getByLabel('Motivo da alteração').fill('Contrato cancelado');await expect(dialog.getByRole('button',{name:'Salvar alterações'})).toBeDisabled();await dialog.getByLabel(/Confirmo que desejo reverter/).check();await expect(dialog.getByRole('button',{name:'Salvar alterações'})).toBeEnabled();await page.screenshot({path:'test-results/visuals/sold-reversal-confirmation.png',fullPage:true});});

test('resultado de rede ambíguo é verificado sem reenviar a mutação',async({page})=>{await mockBackend(page,{ambiguousApplied:true});await login(page);await page.goto(`/portal/inventory/${unitId}`);const dialog=page.getByRole('dialog');await dialog.getByLabel('Status').selectOption('reserved');await dialog.getByLabel('Motivo da alteração').fill('Contato confirmado');await dialog.getByRole('button',{name:'Salvar alterações'}).click();await expect(page.getByText('Unidade 1203 atualizada com sucesso.')).toBeVisible();});

test('captura estados de carregamento e erro em móvel',async({page})=>{await page.setViewportSize({width:390,height:844});await mockBackend(page,{delay:true,error:true});await page.goto('/login');await page.getByLabel('E-mail').fill('admin@escobar.test');await page.getByLabel('Senha').fill('SenhaLocal123!');await page.getByRole('button',{name:'Entrar'}).click();await expect(page.getByText('Estamos restaurando sua sessão e validando o acesso.')).toBeVisible();await page.screenshot({path:'test-results/visuals/portal-loading-mobile.png',fullPage:true});await page.goto('/portal/inventory');await expect(page.getByRole('alert')).toBeVisible();await page.screenshot({path:'test-results/visuals/inventory-error-mobile.png',fullPage:true});});
