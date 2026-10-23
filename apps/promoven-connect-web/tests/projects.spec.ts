import { expect, test } from "@playwright/test";

test("projeto, unidade, publicação e CSV no Connect local", async ({ page }) => {
  test.skip(!process.env.CONNECT_E2E_EMAIL || !process.env.CONNECT_E2E_PASSWORD, "Credenciais locais sintéticas ausentes.");
  const slug = `pc02-e2e-${Date.now()}`;
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.CONNECT_E2E_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.CONNECT_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no portal" }).click();
  await page.getByRole("combobox", { name: "Organização ativa" }).selectOption({ label: "Organização piloto" });
  await expect(page.getByRole("heading", { name: "Seu espaço comercial" })).toBeVisible();
  await page.getByRole("link", { name: "Empreendimentos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Empreendimentos" })).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("Residencial E2E");
  await page.getByLabel("Identificador público").fill(slug);
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").fill("SP");
  await page.getByRole("button", { name: "Criar empreendimento" }).click();
  await expect(page.locator(`a.project-card[data-project-slug="${slug}"]`)).toBeVisible();
  await page.locator(`a.project-card[data-project-slug="${slug}"]`).click();
  await expect(page.getByRole("heading", { name: "Residencial E2E", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Gerir unidades" }).click();
  await page.getByRole("button", { name: "Adicionar unidade" }).click();
  await page.getByLabel("Código").fill("A-101");
  await page.getByLabel("Tipologia").fill("Apartamento");
  await page.getByLabel("Área m²").fill("58,250");
  await page.getByLabel("Preço BRL").fill("450000,00");
  await page.getByLabel("Unidade publicada").check();
  await page.getByRole("button", { name: "Salvar unidade" }).click();
  await expect(page.getByRole("cell", { name: "A-101" })).toBeVisible();
  await page.getByRole("link", { name: /Projeto/ }).click();
  await page.getByRole("button", { name: "Publicar projeto" }).click();
  await expect(page.getByText("Publicado · VERSÃO 2")).toBeVisible();
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const conflictStatus = await page.evaluate(async (id) => {
    const modulePath = "/src/supabase.ts";
    const { connectClient } = await import(/* @vite-ignore */ modulePath);
    const response = await connectClient().rpc("connect_update_project", { p_id: id, p_expected_version: 1, p_data: { name: "Versão antiga" } });
    return response.status;
  }, projectId);
  expect(conflictStatus).toBe(409);
  await page.getByRole("link", { name: "Importar CSV" }).click();
  const csv = "code;floor;type;bedrooms;bathrooms;parking_spaces;area_m2;price_brl;status;published;expected_version\r\nA-102;3;Apartamento;2;1;1;58,250;460000,00;available;true;\r\n";
  await page.getByLabel("Selecionar arquivo CSV").setInputFiles({ name: "inventario.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("heading", { name: "Prévia de 1 linhas" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("status")).toContainText("1 novas");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("link", { name: /Projeto/ }).click();
    await expect(page.getByRole("heading", { name: "Residencial E2E", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/visuals/project-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "Importar CSV" }).click();
  }
});
