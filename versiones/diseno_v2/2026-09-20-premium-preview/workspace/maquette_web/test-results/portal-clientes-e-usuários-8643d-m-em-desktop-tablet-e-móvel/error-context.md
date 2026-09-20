# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: portal.spec.ts >> clientes e usuários funcionam em desktop, tablet e móvel
- Location: tests/portal.spec.ts:817:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8892/login
Call log:
  - navigating to "http://127.0.0.1:8892/login", waiting until "load"

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
  413 |             organization_id: organizationId,
  414 |             project_id: projectId,
  415 |             unit_id: unitId,
  416 |             unit_code: "1203",
  417 |             action: "unit.status_changed",
  418 |             old_values: { status: "available" },
  419 |             new_values: { status: "reserved", version: 2 },
  420 |             reason: "Contato confirmado",
  421 |             performed_by: userId,
  422 |             created_at: "2026-09-13T11:00:00Z",
  423 |           },
  424 |         ]),
  425 |       });
  426 |     if (path.includes("/rest/v1/rpc/admin_list_audit_logs")) {
  427 |       if(options.auditError)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'XX000',message:'internal'})});
  428 |       const filters=route.request().postDataJSON() as Record<string,unknown>;
  429 |       const actions=['organization.created','invitation.created','invitation.sent','invitation.accepted','membership.bootstrap'];
  430 |       const events=actions.map((action,index)=>({id:`admin-audit-${index}`,organization_id:organizationId,organization_name:'Escobar',project_id:null,project_name:null,action,resource_type:index===0?'organization':index===4?'membership':'invitation',resource_name:index===0?'Escobar':'Registro administrativo',actor_id:userId,actor_name:'Administrador Local',created_at:`2026-09-15T0${index}:00:00Z`,old_values:{},new_values:{role:'organization_admin',status:index===3?'accepted':'sent'},reason:null,total_count:5}));
  431 |       const filtered=options.auditEmpty?[]:events.filter(item=>(!filters.p_action||item.action===filters.p_action)&&(!filters.p_resource_type||item.resource_type===filters.p_resource_type));
  432 |       return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(filtered.map(item=>({...item,total_count:filtered.length})))});
  433 |     }
  434 |     if(path.includes('/rest/v1/rpc/admin_list_audit_actors'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{actor_id:userId,actor_name:'Administrador Local'}])});
  435 |     if (path.includes("/rest/v1/rpc/admin_change_unit_status")) {
  436 |       if (options.conflict)
  437 |         return route.fulfill({
  438 |           status: 400,
  439 |           contentType: "application/json",
  440 |           body: JSON.stringify({
  441 |             code: "P0001",
  442 |             message: "inventory_admin_error",
  443 |             details: '{"code":"version_conflict"}',
  444 |           }),
  445 |         });
  446 |       if (options.ambiguousApplied) {
  447 |         unit = {
  448 |           ...unit,
  449 |           status: "reserved",
  450 |           reserved_by: userId,
  451 |           reserved_at: "2026-09-13T11:00:00Z",
  452 |           version: unit.version + 1,
  453 |         };
  454 |         return route.abort("failed");
  455 |       }
  456 |       unit = {
  457 |         ...unit,
  458 |         status: "reserved",
  459 |         reserved_by: userId,
  460 |         reserved_at: "2026-09-13T11:00:00Z",
  461 |         version: unit.version + 1,
  462 |       };
  463 |       return route.fulfill({
  464 |         status: 200,
  465 |         contentType: "application/json",
  466 |         body: JSON.stringify(unit),
  467 |       });
  468 |     }
  469 |     if (path.includes("/rest/v1/rpc/admin_update_unit_price")) {
  470 |       unit = { ...unit, price_brl: 1500000, version: unit.version + 1 };
  471 |       return route.fulfill({
  472 |         status: 200,
  473 |         contentType: "application/json",
  474 |         body: JSON.stringify(unit),
  475 |       });
  476 |     }
  477 |     if (path.includes("/rest/v1/rpc/admin_set_unit_published")) {
  478 |       unit = { ...unit, published: false, version: unit.version + 1 };
  479 |       return route.fulfill({
  480 |         status: 200,
  481 |         contentType: "application/json",
  482 |         body: JSON.stringify(unit),
  483 |       });
  484 |     }
  485 |     if (path.includes("/rest/v1/units")) {
  486 |       if (options.conflict) unit = { ...unit, price_brl: 1490000, version: 2 };
  487 |       return route.fulfill({
  488 |         status: 200,
  489 |         contentType: "application/json",
  490 |         body: JSON.stringify({
  491 |           ...unit,
  492 |           floors: { number: 12 },
  493 |           unit_types: {
  494 |             name: "Final 03",
  495 |             bedrooms: 3,
  496 |             suites: 2,
  497 |             private_area_m2: 118,
  498 |             total_area_m2: 144,
  499 |             interior_project_id: "terraza_luz",
  500 |           },
  501 |           projects: { organization_id: organizationId },
  502 |         }),
  503 |       });
  504 |     }
  505 |     return route.fulfill({
  506 |       status: 404,
  507 |       contentType: "application/json",
  508 |       body: "{}",
  509 |     });
  510 |   });
  511 | }
  512 | async function login(page: Page, expected = /\/portal$/) {
> 513 |   await page.goto("/login");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8892/login
  514 |   await page.getByLabel("E-mail").fill("admin@escobar.test");
  515 |   await page.getByLabel("Senha").fill("SenhaLocal123!");
  516 |   await page.getByRole("button", { name: "Entrar" }).click();
  517 |   await expect(page).toHaveURL(expected);
  518 | }
  519 | 
  520 | test('atividade administrativa é separada, filtrável e não expõe dados sensíveis',async({page})=>{
  521 |   await mockBackend(page);
  522 |   await login(page);
  523 |   await page.goto('/portal/history');
  524 |   await expect(page.getByRole('heading',{name:'Histórico'})).toBeVisible();
  525 |   await page.getByRole('link',{name:'Atividade administrativa'}).click();
  526 |   await expect(page.locator('.history-card .status').filter({hasText:'Convite aceito'})).toBeVisible();
  527 |   await expect(page.locator('.history-card .status').filter({hasText:'Organização criada'})).toBeVisible();
  528 |   await page.getByRole('combobox',{name:'Ação',exact:true}).selectOption('invitation.accepted');
  529 |   await expect(page.locator('.history-card .status').filter({hasText:'Convite aceito'})).toBeVisible();
  530 |   await expect(page.locator('.history-card .status').filter({hasText:'Organização criada'})).toHaveCount(0);
  531 |   await page.getByRole('button',{name:'Ver detalhes'}).click();
  532 |   await expect(page.getByRole('dialog',{name:'Detalhes da atividade administrativa'})).toBeVisible();
  533 |   await expect(page.locator('body')).not.toContainText('private@example.com');
  534 |   await expect(page.locator('body')).not.toContainText('token_hash');
  535 |   await page.screenshot({path:'test-results/visuals/admin-audit-desktop.png',fullPage:true});
  536 |   await page.setViewportSize({width:768,height:1024});
  537 |   await page.screenshot({path:'test-results/visuals/admin-audit-tablet.png',fullPage:true});
  538 |   await page.setViewportSize({width:390,height:844});
  539 |   await page.screenshot({path:'test-results/visuals/admin-audit-mobile.png',fullPage:true});
  540 |   await page.keyboard.press('Escape');
  541 |   await expect(page.getByRole('dialog',{name:'Detalhes da atividade administrativa'})).toHaveCount(0);
  542 |   await page.setViewportSize({width:1440,height:900});
  543 |   await page.screenshot({path:'test-results/visuals/admin-audit-page-desktop.png',fullPage:true});
  544 |   await page.setViewportSize({width:768,height:1024});
  545 |   await page.screenshot({path:'test-results/visuals/admin-audit-page-tablet.png',fullPage:true});
  546 |   await page.setViewportSize({width:390,height:844});
  547 |   await page.screenshot({path:'test-results/visuals/admin-audit-page-mobile.png',fullPage:true});
  548 |   await page.getByRole('link',{name:'Inventário'}).last().click();
  549 |   await expect(page).toHaveURL(/\/portal\/history$/);
  550 | });
  551 | 
  552 | test('atividade administrativa trata estado vazio',async({page})=>{
  553 |   await mockBackend(page,{auditEmpty:true});await login(page);await page.goto('/portal/history/admin');
  554 |   await expect(page.getByRole('heading',{name:'Nenhuma atividade encontrada'})).toBeVisible();
  555 | });
  556 | 
  557 | test('atividade administrativa trata erro e oferece retry',async({page})=>{
  558 |   await mockBackend(page,{auditError:true});await login(page);await page.goto('/portal/history/admin');
  559 |   await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  560 |   await expect(page.getByRole('button',{name:'Tentar novamente'})).toBeVisible();
  561 |   await expect(page.locator('body')).not.toContainText('internal');
  562 | });
  563 | 
  564 | test('seller não pode abrir auditoria administrativa',async({page})=>{
  565 |   await mockBackend(page,{role:'seller'});await login(page);await page.goto('/portal/history');
  566 |   await expect(page.getByRole('link',{name:'Atividade administrativa'})).toHaveCount(0);
  567 |   await page.goto('/portal/history/admin');await expect(page).toHaveURL(/\/portal$/);
  568 | });
  569 | 
  570 | test("login e dashboard responsivos", async ({ page }) => {
  571 |   await mockBackend(page);
  572 |   await page.setViewportSize({ width: 1440, height: 900 });
  573 |   await page.goto("/login");
  574 |   await expect(
  575 |     page.getByRole("heading", { name: "Acesse o Portal Escobar" }),
  576 |   ).toBeVisible();
  577 |   await page.screenshot({
  578 |     path: "test-results/visuals/login-desktop.png",
  579 |     fullPage: true,
  580 |   });
  581 |   await login(page);
  582 |   await expect(
  583 |     page.getByRole("heading", { name: "Visão geral" }),
  584 |   ).toBeVisible();
  585 |   await expect(page.getByText("72", { exact: true })).toBeVisible();
  586 |   await page.screenshot({
  587 |     path: "test-results/visuals/dashboard-desktop.png",
  588 |     fullPage: true,
  589 |   });
  590 |   await page.setViewportSize({ width: 768, height: 1024 });
  591 |   await page.screenshot({
  592 |     path: "test-results/visuals/dashboard-tablet.png",
  593 |     fullPage: true,
  594 |   });
  595 |   await page.setViewportSize({ width: 390, height: 844 });
  596 |   await page.screenshot({
  597 |     path: "test-results/visuals/dashboard-mobile.png",
  598 |     fullPage: true,
  599 |   });
  600 | });
  601 | 
  602 | test("inventário, edição e histórico", async ({ page }) => {
  603 |   await mockBackend(page);
  604 |   await login(page);
  605 |   await page.getByRole("link", { name: "Inventário", exact: true }).click();
  606 |   await expect(
  607 |     page.getByText("Unidade", { exact: true }).first(),
  608 |   ).toBeVisible();
  609 |   await page.screenshot({
  610 |     path: "test-results/visuals/inventory-desktop.png",
  611 |     fullPage: true,
  612 |   });
  613 |   await page.getByRole("button", { name: "Editar" }).click();
```