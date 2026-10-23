import { expect, test } from "@playwright/test";

test("rota privada exige login", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/connect/profile");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fconnect%2Fprofile/);
  await expect(page.getByRole("heading", { name: "Boas-vindas de volta" })).toBeVisible();
  await page.screenshot({ path: "test-results/visuals/login-390.png", fullPage: true });
});

test("recuperação solicita mensagem sem revelar existência da conta", async ({ page }) => {
  test.skip(!process.env.CONNECT_E2E_RECOVERY_PASSWORD, "Senha de teste local ausente.");
  const before = await (await page.request.get("http://127.0.0.1:56324/api/v1/messages")).json() as { messages: { ID: string }[] };
  const seen = new Set(before.messages.map((item) => item.ID));
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail").fill("recovery@test.local");
  await page.getByRole("button", { name: "Enviar instruções" }).click();
  await expect(page.getByRole("status")).toContainText("Se o endereço estiver cadastrado");
  await expect.poll(async () => {
    const result = await page.request.get("http://127.0.0.1:56324/api/v1/messages");
    if (!result.ok()) return 0;
    const data = await result.json() as { messages: { To: { Address: string }[] }[] };
    return data.messages.filter((message) => !seen.has(message.ID) && message.To.some((recipient) => recipient.Address === "recovery@test.local")).length;
  }).toBeGreaterThan(0);
  const listing = await (await page.request.get("http://127.0.0.1:56324/api/v1/messages")).json() as { messages: { ID: string; To: { Address: string }[] }[] };
  const messageId = listing.messages.find((message) => !seen.has(message.ID) && message.To.some((recipient) => recipient.Address === "recovery@test.local"))!.ID;
  const message = await (await page.request.get(`http://127.0.0.1:56324/api/v1/message/${messageId}`)).json() as { Text: string };
  const link = message.Text.match(/https?:\/\/[^\s)]+/)?.[0];
  expect(link).toBeTruthy();
  await page.goto(link!);
  await expect(page.getByRole("heading", { name: "Nova senha" })).toBeVisible();
  const nextPassword = `${process.env.CONNECT_E2E_RECOVERY_PASSWORD!}-${Date.now()}`;
  await page.getByLabel("Nova senha").fill(nextPassword);
  await page.getByLabel("Confirmar senha").fill(nextPassword);
  await page.getByRole("button", { name: "Atualizar senha" }).click();
  await expect(page.getByRole("status")).toContainText("Senha atualizada");
});

test("login, organização e perfil reais no Connect local", async ({ page }) => {
  test.skip(!process.env.CONNECT_E2E_EMAIL || !process.env.CONNECT_E2E_PASSWORD, "Credenciais locais sintéticas ausentes.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.CONNECT_E2E_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.CONNECT_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no portal" }).click();
  await expect(page.getByRole("heading", { name: "Seu espaço comercial" })).toBeVisible();
  await expect(page.getByText("Organização piloto", { exact: true }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Organização ativa" }).selectOption({ label: "Segundo piloto" });
  await expect(page.getByText("Gerente comercial", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Organização ativa" }).selectOption({ label: "Organização piloto" });
  await expect(page.getByText("Administrador", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Meu perfil" }).click();
  await expect(page.getByRole("heading", { name: "Meu perfil" })).toBeVisible();
  await page.getByRole("link", { name: "Visão geral" }).click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "Seu espaço comercial" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/visuals/dashboard-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/login/);
});
