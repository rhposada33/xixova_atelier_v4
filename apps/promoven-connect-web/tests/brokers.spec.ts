import { expect, test } from "@playwright/test";

test("convite por Mailpit, aceite, revisão e revogação local", async ({ browser, page }) => {
  test.skip(!process.env.CONNECT_E2E_EMAIL || !process.env.CONNECT_E2E_PASSWORD, "Credenciais locais ausentes.");
  test.setTimeout(90_000);
  const email = `broker-${Date.now()}@test.local`;
  const slug = `pc03-e2e-${Date.now()}`;
  const baseline = await (await page.request.get("http://127.0.0.1:56324/api/v1/messages")).json() as { messages: { ID: string }[] };
  const seen = new Set(baseline.messages.map(item => item.ID));
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.CONNECT_E2E_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.CONNECT_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no portal" }).click();
  const organizationId = await page.getByRole("combobox", { name: "Organização ativa" }).inputValue();
  const projectId = await page.evaluate(async ({ organizationId, slug }) => {
    const modulePath = "/src/supabase.ts";
    const { connectClient } = await import(/* @vite-ignore */ modulePath);
    const { data, error } = await connectClient().rpc("connect_create_project", { p_data: { organizationId, name: "Projeto Corretores E2E", slug, publicSlug: slug, city: "São Paulo", state: "SP" } });
    if (error) throw new Error(error.message);
    return data.id as string;
  }, { organizationId, slug });
  const race = await page.evaluate(async (id) => {
    const modulePath = "/src/supabase.ts";
    const { connectClient } = await import(/* @vite-ignore */ modulePath);
    const email = `race-${crypto.randomUUID()}@test.local`;
    const run = () => connectClient().rpc("connect_create_broker_invitation", { p_project_id: id, p_email: email, p_token_hash: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join(""), p_operation_id: crypto.randomUUID() });
    const responses = await Promise.all([run(), run()]);
    const winner = responses.find(r => !r.error);
    if (winner) await connectClient().rpc("connect_cancel_broker_invitation", { p_id: winner.data.id, p_expected_version: winner.data.version });
    return { successes: responses.filter(r => !r.error).length, conflicts: responses.filter(r => r.error?.code === "23505").length };
  }, projectId);
  expect(race).toEqual({ successes: 1, conflicts: 1 });
  await page.getByRole("link", { name: "Corretores", exact: true }).click();
  await page.locator("form.broker-invite-form").getByLabel("Empreendimento").selectOption(projectId);
  await page.getByLabel("E-mail profissional").fill(email);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByRole("status")).toContainText("Convite enviado", { timeout: 15_000 });
  await expect.poll(async () => {
    const listing = await (await page.request.get("http://127.0.0.1:56324/api/v1/messages")).json() as { messages: { ID: string; To: { Address: string }[] }[] };
    return listing.messages.filter(m => !seen.has(m.ID) && m.To.some(to => to.Address === email)).length;
  }).toBe(1);
  const listing = await (await page.request.get("http://127.0.0.1:56324/api/v1/messages")).json() as { messages: { ID: string; To: { Address: string }[] }[] };
  const mailId = listing.messages.find(m => !seen.has(m.ID) && m.To.some(to => to.Address === email))!.ID;
  const mail = await (await page.request.get(`http://127.0.0.1:56324/api/v1/message/${mailId}`)).json() as { Text: string };
  const links = mail.Text.match(/https?:\/\/[^\s)]+/g) ?? [];
  expect(links).toHaveLength(2);
  expect(/^#invite=[a-f0-9]{64}$/.test(new URL(links[1]).hash)).toBe(true);
  const broker = await browser.newContext();
  const brokerPage = await broker.newPage();
  await brokerPage.goto(links[0]);
  await expect(brokerPage.getByRole("heading", { name: "Convite Promoven Connect" })).toBeVisible();
  await expect.poll(() => brokerPage.evaluate(async () => { const modulePath="/src/supabase.ts";const {connectClient}=await import(/* @vite-ignore */ modulePath);return !!(await connectClient().auth.getSession()).data.session; })).toBe(true);
  await brokerPage.goto(links[1]);
  await expect(brokerPage.getByRole("link", { name: "Completar perfil profissional" })).toBeVisible({ timeout: 10_000 });
  for (const width of [390, 768, 1440]) {
    await brokerPage.setViewportSize({ width, height: 900 });
    expect(await brokerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await brokerPage.screenshot({ path: `test-results/visuals/invite-${width}.png`, fullPage: true });
  }
  await brokerPage.getByRole("link", { name: "Completar perfil profissional" }).click();
  await brokerPage.getByLabel("Nome profissional").fill("Corretor E2E");
  await brokerPage.getByLabel("Telefone profissional").fill("11999990000");
  await brokerPage.getByLabel("Número CRECI").fill("12345");
  await brokerPage.getByLabel("UF CRECI").fill("SP");
  await brokerPage.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(brokerPage.getByRole("status")).toContainText("Perfil salvo");
  await brokerPage.goto("/invite");
  await brokerPage.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(brokerPage.getByRole("status")).toContainText("Convite aceito");
  await page.reload();
  await page.getByRole("combobox", { name: "Empreendimento" }).last().selectOption(projectId);
  await expect(page.getByText("Corretor E2E")).toBeVisible();
  await page.getByRole("button", { name: "Verificar CRECI" }).click();
  await expect(page.getByText("Verificado manualmente", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Ativar" }).click();
  await page.evaluate(async (id) => {
    const modulePath="/src/supabase.ts";const {connectClient}=await import(/* @vite-ignore */ modulePath);
    const client=connectClient();
    for(const [code,floor,type,area,price] of [["A101",1,"Apartamento","70.125","500000.10"],["A102",2,"Studio","42.500","340000.25"]] as const){
      const {error}=await client.rpc("connect_create_unit",{p_project_id:id,p_data:{code,floor,type,bedrooms:code==="A101"?2:1,bathrooms:1,parkingSpaces:1,areaM2:area,priceBRL:price,status:"available",published:true}});if(error)throw error;
    }
    const {error}=await client.rpc("connect_publish_project",{p_id:id,p_expected_version:1,p_status:"published"});if(error)throw error;
  },projectId);
  await brokerPage.goto("/connect/broker");
  await expect(brokerPage.getByRole("heading", { name: "Projeto Corretores E2E" })).toBeVisible();
  await brokerPage.getByRole("link",{name:"Ver catálogo"}).click();
  await expect(brokerPage.getByRole("heading",{name:"Projeto Corretores E2E"})).toBeVisible();
  await brokerPage.getByRole("link",{name:/Projeto Corretores E2E/}).click();
  await expect(brokerPage.getByText("Preço sob consulta").first()).toBeVisible();
  await brokerPage.getByLabel("Tipologia").selectOption("Studio");
  await brokerPage.getByRole("button",{name:"Aplicar filtros"}).click();
  await expect(brokerPage.getByText("1 resultados")).toBeVisible();
  await brokerPage.getByRole("button",{name:"Limpar"}).click();
  await expect(brokerPage.getByText("2 resultados")).toBeVisible();
  await brokerPage.getByRole("button",{name:"☆ Favoritar"}).first().click();
  await brokerPage.getByRole("button",{name:"Comparar",exact:true}).first().click();
  await brokerPage.getByRole("button",{name:"Comparar",exact:true}).click();
  await brokerPage.getByRole("button",{name:"Comparar selecionadas"}).click();
  await expect(brokerPage.getByRole("table",{name:"Comparação de unidades"})).toBeVisible();
  for(const width of [390,768,1440]){await brokerPage.setViewportSize({width,height:900});expect(await brokerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await brokerPage.screenshot({path:`test-results/visuals/catalog-compare-${width}.png`,fullPage:true});}
  await brokerPage.getByRole("link",{name:"Ver detalhes"}).first().click();
  await expect(brokerPage.getByRole("heading",{name:"Unidade A101"})).toBeVisible();
  for(const width of [390,768,1440]){await brokerPage.setViewportSize({width,height:900});expect(await brokerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await brokerPage.screenshot({path:`test-results/visuals/catalog-unit-${width}.png`,fullPage:true});}
  await brokerPage.getByRole("link",{name:"Voltar às unidades"}).click();
  await page.evaluate(async id=>{const modulePath="/src/supabase.ts";const {connectClient}=await import(/* @vite-ignore */ modulePath);const {error}=await connectClient().rpc("connect_set_broker_price_visibility",{p_project_id:id,p_expected_version:2,p_visible:true});if(error)throw error;},projectId);
  await brokerPage.reload();
  await expect(brokerPage.getByText("R$ 500.000,10")).toBeVisible();
  for(const width of [390,768,1440]){await brokerPage.setViewportSize({width,height:900});expect(await brokerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await brokerPage.screenshot({path:`test-results/visuals/catalog-${width}.png`,fullPage:true});}
  await brokerPage.getByRole("link",{name:"← Empreendimentos"}).click();
  for(const width of [390,768,1440]){await brokerPage.setViewportSize({width,height:900});expect(await brokerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await brokerPage.screenshot({path:`test-results/visuals/catalog-projects-${width}.png`,fullPage:true});}
  await brokerPage.goto(`/connect/broker/projects/${projectId}`);
  for (const width of [390, 768, 1440]) {
    await brokerPage.setViewportSize({ width, height: 900 });
    expect(await brokerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await brokerPage.screenshot({ path: `test-results/visuals/broker-home-${width}.png`, fullPage: true });
    await brokerPage.goto("/connect/broker/profile");
    await expect(brokerPage.getByRole("heading", { name: "Perfil profissional" })).toBeVisible();
    expect(await brokerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await brokerPage.screenshot({ path: `test-results/visuals/broker-profile-${width}.png`, fullPage: true });
    await brokerPage.goto("/connect/broker");
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/visuals/brokers-${width}.png`, fullPage: true });
  }
  page.once("dialog", dialog => void dialog.accept());
  await page.getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByText("Revogado", { exact: false }).first()).toBeVisible();
  await brokerPage.reload();
  await expect(brokerPage.getByRole("heading", { name: "Nenhum projeto ativo" })).toBeVisible();
  await brokerPage.goto(`/connect/broker/projects/${projectId}`);
  await expect(brokerPage.getByRole("alert")).toContainText("acesso não autorizado");
  await broker.close();
});
