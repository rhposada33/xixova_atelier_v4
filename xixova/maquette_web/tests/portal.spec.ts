import { expect, test, type Page } from "@playwright/test";

const userId = "30000000-0000-4000-8000-000000000001";
const organizationId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000002";
const unitId = "00000000-0000-4001-8000-000000001203";
const payload = Buffer.from(
  JSON.stringify({
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    exp: 4102444800,
  }),
).toString("base64url");
const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.test`;
const authUser = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "admin@escobar.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-09-13T00:00:00Z",
};
const baseUnit = {
  id: unitId,
  organization_id: organizationId,
  project_id: projectId,
  building_id: "00000000-0000-4000-8000-000000000003",
  floor_id: "f12",
  unit_type_id: "t3",
  code: "1203",
  floor: 12,
  unit_type_name: "Final 03",
  status: "available",
  bedrooms: 3,
  suites: 2,
  parking_spaces: 2,
  private_area_m2: 118,
  total_area_m2: 144,
  orientation: "southeast",
  view_type: "sea",
  sun_exposure: "morning",
  price_brl: 1460000,
  model_object_id: "UNIT_1203_PROXY",
  interior_project_id: "terraza_luz",
  published: true,
  reserved_by: null,
  reserved_at: null,
  reserved_until: null,
  version: 1,
  updated_at: "2026-09-13T10:00:00Z",
  total_count: 1,
};
const consoleErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !/Failed to load resource/.test(message.text())
    )
      errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page) ?? []).toEqual([]);
});

async function mockBackend(
  page: Page,
  options: {
    empty?: boolean;
    error?: boolean;
    conflict?: boolean;
    ambiguousApplied?: boolean;
    active?: boolean;
    noOrganizations?: boolean;
    role?: string;
    status?: "available" | "reserved" | "sold";
    delay?: boolean;
    invalidLogin?: boolean;
    auditEmpty?: boolean;
    auditError?: boolean;
  } = {},
) {
  let unit = { ...baseUnit, status: options.status ?? baseUnit.status };
  const importExpiry=new Date(Date.now()+30*60*1000).toISOString();
  const imports:any[]=[];
  await page.route("http://supabase.test/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/auth/v1/token") {
      if (options.invalidLogin)
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error_code: "invalid_credentials",
            msg: "Invalid login credentials",
          }),
        });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: token,
          refresh_token: "local-test-refresh",
          expires_in: 3600,
          expires_at: 4102444800,
          token_type: "bearer",
          user: authUser,
        }),
      });
    }
    if (path === "/auth/v1/user")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(authUser),
      });
    if (path === "/auth/v1/logout")
      return route.fulfill({ status: 204, body: "" });
    if (path === "/auth/v1/recover")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    if (options.error && path.includes("/rest/v1/rpc/admin_list_units"))
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "XX000", message: "internal" }),
      });
    if (path.includes("/rest/v1/profiles"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ active: options.active ?? true }),
      });
    if (path.includes("/rest/v1/platform_admins"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    if (path === "/rest/v1/organizations") {
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, 700));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          options.noOrganizations
            ? []
            : [{ id: organizationId, name: "Escobar", slug: "escobar" }],
        ),
      });
    }
    if (path === "/rest/v1/organization_members")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          options.noOrganizations
            ? []
            : [
                {
                  organization_id: organizationId,
                  role: options.role ?? "organization_admin",
                },
              ],
        ),
      });
    if (path.includes("/rest/v1/projects"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: projectId,
            organization_id: organizationId,
            name: "Escobar Residences",
            slug: "escobar-residences",
            status: "published",
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_get_project_summary"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            project_id: projectId,
            total: 72,
            available: 54,
            reserved: 6,
            sold: 12,
            hidden: 0,
            recently_updated: 4,
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_organizations"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: organizationId,
            name: "Escobar",
            legal_name: "Escobar Empreendimentos SA",
            slug: "escobar",
            country: "BR",
            state: "SP",
            city: "São Paulo",
            timezone: "America/Sao_Paulo",
            default_currency: "BRL",
            status: "active",
            version: 1,
            member_count: 3,
            project_count: 1,
            total_count: 1,
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_members"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            user_id: userId,
            full_name: "Administrador Local",
            role: "organization_admin",
            active: true,
            joined_at: "2026-09-13T00:00:00Z",
            version: 1,
            total_count: 1,
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_projects"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: projectId,
            organization_id: organizationId,
            name: "Escobar Residences",
            slug: "escobar-residences",
            description: "Empreendimento existente",
            status: "published",
            country: "BR",
            state: "SP",
            city: "São Paulo",
            timezone: "America/Sao_Paulo",
            currency: "BRL",
            north_offset_degrees: 0,
            public_inventory_enabled: true,
            visual_experience_enabled: true,
            version: 1,
            building_count: 1,
            floor_count: 18,
            unit_type_count: 8,
            unit_count: 72,
            total_count: 1,
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_buildings"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "building-1",
            project_id: projectId,
            code: "tower-a",
            name: "Torre A",
            display_order: 1,
            active: true,
            version: 1,
            floor_count: 18,
            unit_count: 72,
            model_path: "building/xixova-building.glb",
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_floors"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "floor-1",
            building_id: "building-1",
            code: "1",
            label: "Pavimento 1",
            floor_number: 1,
            display_order: 1,
            active: true,
            version: 1,
            unit_count: 4,
            model_object_id: "FLOOR_01",
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_unit_types"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "type-1",
            project_id: projectId,
            code: "final-01",
            name: "Final 01",
            private_area: 118,
            total_area: 144,
            bedrooms: 3,
            suites: 2,
            bathrooms: 2,
            parking_spaces: 2,
            active: true,
            version: 1,
            unit_count: 16,
            interior_project_id: "garden_house_18",
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_preview_inventory_import")) {
      const item={ id:"import-1",project_id:projectId,mode:"create_and_update",status:"validated",operation_id:"operation-1",payload_hash:"hash",created_at:new Date().toISOString(),expires_at:importExpiry,row_count:1,new_count:1,update_count:0,unchanged_count:0,warning_count:0,error_count:0 };
      imports.splice(0,imports.length,item);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(item) });
    }
    if (path.includes("/rest/v1/rpc/admin_confirm_inventory_import")) {
      const item={...imports[0],status:"completed",completed_at:new Date().toISOString()};imports.splice(0,imports.length,item);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(item) });
    }
    if (path.includes("/rest/v1/rpc/admin_list_inventory_imports"))
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(imports) });
    if (path.includes("/rest/v1/rpc/admin_get_inventory_import"))
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id:"import-1",status:"completed",row_count:1,new_count:1,update_count:0,unchanged_count:0,warning_count:0,error_count:0,completed_at:"2026-09-14T10:00:00Z" }) });
    if (path.includes("/rest/v1/inventory_import_errors"))
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(imports.length?[{row_number:2,column_name:null,code:"new",message:"Nova unidade",severity:"warning",classification:"new"}]:[]) });
    if (path.includes("/rest/v1/rpc/admin_validate_project_readiness"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ready: true,
          errors: [],
          warnings: [],
          buildings: 1,
          floors: 18,
          unitTypes: 8,
          units: 72,
          invalidReferences: 0,
          duplicateCodes: 0,
          missingValues: 0,
        }),
      });
    if (path.includes("/rest/v1/organization_invitations"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "invite-1",
            organization_id: organizationId,
            email_normalized: "novo.usuario@example.test",
            role: "viewer",
            status: "sent",
            expires_at: "2026-09-20T00:00:00Z",
            sent_at: "2026-09-13T00:00:00Z",
            delivery_attempts: 1,
            version: 1,
          },
        ]),
      });
    if (path.includes("/functions/v1/invite-organization-member"))
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ status: "sent", invitationId: "invite-2" }),
      });
    if (path.includes("/rest/v1/rpc/accept_organization_invitation"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { organization_id: organizationId, role: "viewer" },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_units"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(options.empty ? [] : [unit]),
      });
    if (path.includes("/rest/v1/rpc/admin_get_unit_history"))
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "audit-1",
            organization_id: organizationId,
            project_id: projectId,
            unit_id: unitId,
            unit_code: "1203",
            action: "unit.status_changed",
            old_values: { status: "available" },
            new_values: { status: "reserved", version: 2 },
            reason: "Contato confirmado",
            performed_by: userId,
            created_at: "2026-09-13T11:00:00Z",
          },
        ]),
      });
    if (path.includes("/rest/v1/rpc/admin_list_audit_logs")) {
      if(options.auditError)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'XX000',message:'internal'})});
      const filters=route.request().postDataJSON() as Record<string,unknown>;
      const actions=['organization.created','invitation.created','invitation.sent','invitation.accepted','membership.bootstrap'];
      const events=actions.map((action,index)=>({id:`admin-audit-${index}`,organization_id:organizationId,organization_name:'Escobar',project_id:null,project_name:null,action,resource_type:index===0?'organization':index===4?'membership':'invitation',resource_name:index===0?'Escobar':'Registro administrativo',actor_id:userId,actor_name:'Administrador Local',created_at:`2026-09-15T0${index}:00:00Z`,old_values:{},new_values:{role:'organization_admin',status:index===3?'accepted':'sent'},reason:null,total_count:5}));
      const filtered=options.auditEmpty?[]:events.filter(item=>(!filters.p_action||item.action===filters.p_action)&&(!filters.p_resource_type||item.resource_type===filters.p_resource_type));
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(filtered.map(item=>({...item,total_count:filtered.length})))});
    }
    if(path.includes('/rest/v1/rpc/admin_list_audit_actors'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{actor_id:userId,actor_name:'Administrador Local'}])});
    if (path.includes("/rest/v1/rpc/admin_change_unit_status")) {
      if (options.conflict)
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "P0001",
            message: "inventory_admin_error",
            details: '{"code":"version_conflict"}',
          }),
        });
      if (options.ambiguousApplied) {
        unit = {
          ...unit,
          status: "reserved",
          reserved_by: userId,
          reserved_at: "2026-09-13T11:00:00Z",
          version: unit.version + 1,
        };
        return route.abort("failed");
      }
      unit = {
        ...unit,
        status: "reserved",
        reserved_by: userId,
        reserved_at: "2026-09-13T11:00:00Z",
        version: unit.version + 1,
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(unit),
      });
    }
    if (path.includes("/rest/v1/rpc/admin_update_unit_price")) {
      unit = { ...unit, price_brl: 1500000, version: unit.version + 1 };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(unit),
      });
    }
    if (path.includes("/rest/v1/rpc/admin_set_unit_published")) {
      unit = { ...unit, published: false, version: unit.version + 1 };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(unit),
      });
    }
    if (path.includes("/rest/v1/units")) {
      if (options.conflict) unit = { ...unit, price_brl: 1490000, version: 2 };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...unit,
          floors: { number: 12 },
          unit_types: {
            name: "Final 03",
            bedrooms: 3,
            suites: 2,
            private_area_m2: 118,
            total_area_m2: 144,
            interior_project_id: "terraza_luz",
          },
          projects: { organization_id: organizationId },
        }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
}
async function login(page: Page, expected = /\/portal$/) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@escobar.test");
  await page.getByLabel("Senha").fill("SenhaLocal123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(expected);
}

test('atividade administrativa é separada, filtrável e não expõe dados sensíveis',async({page})=>{
  await mockBackend(page);
  await login(page);
  await page.goto('/portal/history');
  await expect(page.getByRole('heading',{name:'Histórico'})).toBeVisible();
  await page.getByRole('link',{name:'Atividade administrativa'}).click();
  await expect(page.locator('.history-card .status').filter({hasText:'Convite aceito'})).toBeVisible();
  await expect(page.locator('.history-card .status').filter({hasText:'Organização criada'})).toBeVisible();
  await page.getByRole('combobox',{name:'Ação',exact:true}).selectOption('invitation.accepted');
  await expect(page.locator('.history-card .status').filter({hasText:'Convite aceito'})).toBeVisible();
  await expect(page.locator('.history-card .status').filter({hasText:'Organização criada'})).toHaveCount(0);
  await page.getByRole('button',{name:'Ver detalhes'}).click();
  await expect(page.getByRole('dialog',{name:'Detalhes da atividade administrativa'})).toBeVisible();
  await expect(page.locator('body')).not.toContainText('private@example.com');
  await expect(page.locator('body')).not.toContainText('token_hash');
  await page.screenshot({path:'test-results/visuals/admin-audit-desktop.png',fullPage:true});
  await page.setViewportSize({width:768,height:1024});
  await page.screenshot({path:'test-results/visuals/admin-audit-tablet.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/visuals/admin-audit-mobile.png',fullPage:true});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Detalhes da atividade administrativa'})).toHaveCount(0);
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'test-results/visuals/admin-audit-page-desktop.png',fullPage:true});
  await page.setViewportSize({width:768,height:1024});
  await page.screenshot({path:'test-results/visuals/admin-audit-page-tablet.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/visuals/admin-audit-page-mobile.png',fullPage:true});
  await page.getByRole('link',{name:'Inventário'}).last().click();
  await expect(page).toHaveURL(/\/portal\/history$/);
});

test('atividade administrativa trata estado vazio',async({page})=>{
  await mockBackend(page,{auditEmpty:true});await login(page);await page.goto('/portal/history/admin');
  await expect(page.getByRole('heading',{name:'Nenhuma atividade encontrada'})).toBeVisible();
});

test('atividade administrativa trata erro e oferece retry',async({page})=>{
  await mockBackend(page,{auditError:true});await login(page);await page.goto('/portal/history/admin');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await expect(page.getByRole('button',{name:'Tentar novamente'})).toBeVisible();
  await expect(page.locator('body')).not.toContainText('internal');
});

test('seller não pode abrir auditoria administrativa',async({page})=>{
  await mockBackend(page,{role:'seller'});await login(page);await page.goto('/portal/history');
  await expect(page.getByRole('link',{name:'Atividade administrativa'})).toHaveCount(0);
  await page.goto('/portal/history/admin');await expect(page).toHaveURL(/\/portal$/);
});

test("login e dashboard responsivos", async ({ page }) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Acesse o Portal Escobar" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/login-desktop.png",
    fullPage: true,
  });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await expect(page.getByText("72", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: "test-results/visuals/dashboard-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/visuals/dashboard-mobile.png",
    fullPage: true,
  });
});

test("inventário, edição e histórico", async ({ page }) => {
  await mockBackend(page);
  await login(page);
  await page.getByRole("link", { name: "Inventário", exact: true }).click();
  await expect(
    page.getByText("Unidade", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/inventory-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Status").selectOption("reserved");
  await expect(dialog.getByLabel("Motivo da alteração")).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/editor-tablet.png",
    fullPage: true,
  });
  await dialog.getByLabel("Motivo da alteração").fill("Contato confirmado");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    page.getByText("Unidade 1203 atualizada com sucesso."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Histórico", exact: true }).click();
  await expect(page.getByText("Contato confirmado")).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/history-desktop.png",
    fullPage: true,
  });
});

test("importação CSV exige dry-run e confirmação explícita", async ({ page }) => {
  await mockBackend(page);
  await login(page);
  await page.getByRole("link", { name: "Importações" }).click();
  await expect(page.getByRole("heading", { name: "Importar inventário" })).toBeVisible();
  const csv = "unit_code;building_code;floor_code;unit_type_code;external_reference;orientation;view_type;solar_exposure;parking_spaces;price;currency;status;published;expected_version\n101;A;F1;T1;EXT;north;sea;morning;1;500000;BRL;available;false;";
  await page.getByLabel("Arquivo CSV").setInputFiles({ name:"units.csv",mimeType:"text/csv",buffer:Buffer.from(csv) });
  await page.getByRole("button", { name: "Executar dry-run" }).click();
  await expect(page.getByText("Dry-run concluído. Revise antes de confirmar.")).toBeVisible();
  await expect(page.getByRole("heading", { name:"Linhas normalizadas" })).toBeVisible();
  await expect(page.getByText("31/12/2098")).toHaveCount(0);
  await expect(page.getByText("Validada",{exact:true})).toBeVisible();
  await page.screenshot({ path:"test-results/visuals/import-preview-desktop.png",fullPage:true });
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  const confirmation=page.getByRole("dialog");
  await expect(confirmation.getByText("Escobar Residences")).toBeVisible();
  await expect(confirmation.getByText(/operação é atômica/i)).toBeVisible();
  await page.screenshot({path:"test-results/visuals/import-confirmation-desktop.png",fullPage:true});
  await confirmation.getByRole("button",{name:"Confirmar aplicação"}).click();
  await expect(page.getByText("Importação concluída: 1 linhas processadas.")).toBeVisible();
  await expect(page.getByText("Concluída",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/visuals/import-history-desktop.png",fullPage:true});
  await page.setViewportSize({ width:768,height:1024 });
  await page.screenshot({ path:"test-results/visuals/import-tablet.png",fullPage:true });
  await page.setViewportSize({ width:390,height:844 });
  await page.screenshot({ path:"test-results/visuals/import-mobile.png",fullPage:true });
});

test("seller não vê nem acessa importações", async ({ page }) => {
  await mockBackend(page, { role:"seller" });
  await login(page);
  await expect(page.getByRole("link", { name:"Importações" })).toHaveCount(0);
  await page.goto(`/portal/projects/${projectId}/imports`);
  await expect(page).toHaveURL(/\/portal$/);
});

test("conflito preserva a intenção e exige nova revisão", async ({ page }) => {
  await mockBackend(page, { conflict: true });
  await login(page);
  await page.goto(`/portal/inventory/${unitId}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Status").selectOption("reserved");
  await dialog.getByLabel("Motivo da alteração").fill("Reserva solicitada");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alteração concorrente detectada")).toBeVisible();
  await expect(
    page.getByText(/Esta unidade foi alterada por outro usuário/),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/version-conflict.png",
    fullPage: true,
  });
});

test("estados vazio e erro possuem tratamento visual", async ({ page }) => {
  await mockBackend(page, { empty: true });
  await login(page);
  await page.getByRole("link", { name: "Inventário", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma unidade encontrada" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/inventory-empty-mobile.png",
    fullPage: true,
  });
});

test("recuperação não revela se o e-mail existe", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail").fill("usuario@escobar.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verifique sua caixa de entrada" }),
  ).toBeVisible();
});

test("rota protegida redireciona e refresh direto funciona após login", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/portal/inventory");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, /\/portal\/inventory$/);
  await page.goto("/portal/inventory");
  await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
});

test("login inválido, logout e callback inválido têm mensagens seguras", async ({
  page,
}) => {
  await mockBackend(page, { invalidLogin: true });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("x@escobar.test");
  await page.getByLabel("Senha").fill("incorreta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "E-mail ou senha inválidos.",
  );
  await page.goto("/reset-password");
  await expect(
    page.getByRole("heading", { name: "Link inválido ou expirado" }),
  ).toBeVisible();
});

test("usuário inativo e usuário sem organização ficam bloqueados", async ({
  page,
}) => {
  await mockBackend(page, { active: false });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Acesso indisponível" }),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  const second = await page.context().newPage();
  await mockBackend(second, { noOrganizations: true });
  await login(second);
  await expect(
    second.getByRole("heading", { name: "Nenhuma organização disponível" }),
  ).toBeVisible();
});

test("seller só recebe ações permitidas e viewer não acessa histórico", async ({
  page,
}) => {
  await mockBackend(page, { role: "seller" });
  await login(page);
  await page.goto(`/portal/inventory/${unitId}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Preço")).toBeDisabled();
  await expect(dialog.getByLabel("Unidade publicada")).toBeDisabled();
  await expect(dialog.getByLabel("Status")).toContainText("Reservada");
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  const viewer = await page.context().newPage();
  await mockBackend(viewer, { role: "viewer" });
  await login(viewer);
  await expect(viewer.getByRole("link", { name: "Histórico" })).toHaveCount(0);
});

test("reversão de venda exige confirmação reforçada", async ({ page }) => {
  await mockBackend(page, { status: "sold" });
  await login(page);
  await page.goto(`/portal/inventory/${unitId}`);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status").selectOption("available");
  await dialog.getByLabel("Motivo da alteração").fill("Contrato cancelado");
  await expect(
    dialog.getByRole("button", { name: "Salvar alterações" }),
  ).toBeDisabled();
  await dialog.getByLabel(/Confirmo que desejo reverter/).check();
  await expect(
    dialog.getByRole("button", { name: "Salvar alterações" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/visuals/sold-reversal-confirmation.png",
    fullPage: true,
  });
});

test("resultado de rede ambíguo é verificado sem reenviar a mutação", async ({
  page,
}) => {
  await mockBackend(page, { ambiguousApplied: true });
  await login(page);
  await page.goto(`/portal/inventory/${unitId}`);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Status").selectOption("reserved");
  await dialog.getByLabel("Motivo da alteração").fill("Contato confirmado");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    page.getByText("Unidade 1203 atualizada com sucesso."),
  ).toBeVisible();
});

test("clientes e usuários funcionam em desktop, tablet e móvel", async ({
  page,
}) => {
  await mockBackend(page);
  await login(page);
  await page.getByRole("link", { name: "Clientes" }).click();
  await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  await expect(page.getByText("escobar", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/clients-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Usuários" }).click();
  await expect(page.getByText("Administrador Local")).toBeVisible();
  await expect(page.getByText("no***@example.test")).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: "test-results/visuals/users-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/visuals/users-mobile.png",
    fullPage: true,
  });
});

test("aceitação de convite exige sessão e retorna ao callback", async ({
  page,
}) => {
  await mockBackend(page);
  const opaque = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  await page.goto(`/accept-invitation?token=${opaque}`);
  await expect(
    page.getByRole("heading", { name: "Entre para aceitar" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Entrar" }).click();
  await page.getByLabel("E-mail").fill("admin@escobar.test");
  await page.getByLabel("Senha").fill("SenhaLocal123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/accept-invitation/);
  await expect(
    page.getByText("Convite aceito. Seu acesso à organização está ativo."),
  ).toBeVisible();
});

test("captura estados de carregamento e erro em móvel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, { delay: true, error: true });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("admin@escobar.test");
  await page.getByLabel("Senha").fill("SenhaLocal123!");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByText("Estamos restaurando sua sessão e validando o acesso."),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/portal-loading-mobile.png",
    fullPage: true,
  });
  await page.goto("/portal/inventory");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/inventory-error-mobile.png",
    fullPage: true,
  });
});

test("projetos e estrutura funcionam em rotas diretas responsivas", async ({
  page,
}) => {
  await mockBackend(page);
  await login(page);
  await page.getByRole("link", { name: "Projetos" }).click();
  await expect(page.getByRole("heading", { name: "Projetos" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Escobar Residences/ })).toBeVisible();
  await page.screenshot({
    path: "test-results/visuals/projects-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Abrir" }).click();
  await page.getByRole("button", { name: "Validar preparação" }).click();
  await expect(
    page.getByRole("heading", { name: "Projeto pronto" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Administrar estrutura" }).click();
  await expect(page.getByText("Torre A")).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.screenshot({
    path: "test-results/visuals/structure-tablet.png",
    fullPage: true,
  });
  await page.goto(`/portal/projects/${projectId}/unit-types`);
  await expect(page.getByText("garden_house_18")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/visuals/unit-types-mobile.png",
    fullPage: true,
  });
});
