# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: portal.spec.ts >> rota protegida redireciona e refresh direto funciona após login
- Location: tests/portal.spec.ts:715:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8892/portal/inventory
Call log:
  - navigating to "http://127.0.0.1:8892/portal/inventory", waiting until "load"

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
  619 |     path: "test-results/visuals/editor-tablet.png",
  620 |     fullPage: true,
  621 |   });
  622 |   await dialog.getByLabel("Motivo da alteração").fill("Contato confirmado");
  623 |   await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  624 |   await expect(
  625 |     page.getByText("Unidade 1203 atualizada com sucesso."),
  626 |   ).toBeVisible();
  627 |   await page.getByRole("link", { name: "Histórico", exact: true }).click();
  628 |   await expect(page.getByText("Contato confirmado")).toBeVisible();
  629 |   await page.screenshot({
  630 |     path: "test-results/visuals/history-desktop.png",
  631 |     fullPage: true,
  632 |   });
  633 | });
  634 | 
  635 | test("importação CSV exige dry-run e confirmação explícita", async ({ page }) => {
  636 |   await mockBackend(page);
  637 |   await login(page);
  638 |   await page.getByRole("link", { name: "Importações" }).click();
  639 |   await expect(page.getByRole("heading", { name: "Importar inventário" })).toBeVisible();
  640 |   const csv = "unit_code;building_code;floor_code;unit_type_code;external_reference;orientation;view_type;solar_exposure;parking_spaces;price;currency;status;published;expected_version\n101;A;F1;T1;EXT;north;sea;morning;1;500000;BRL;available;false;";
  641 |   await page.getByLabel("Arquivo CSV").setInputFiles({ name:"units.csv",mimeType:"text/csv",buffer:Buffer.from(csv) });
  642 |   await page.getByRole("button", { name: "Executar dry-run" }).click();
  643 |   await expect(page.getByText("Dry-run concluído. Revise antes de confirmar.")).toBeVisible();
  644 |   await expect(page.getByRole("heading", { name:"Linhas normalizadas" })).toBeVisible();
  645 |   await expect(page.getByText("31/12/2098")).toHaveCount(0);
  646 |   await expect(page.getByText("Validada",{exact:true})).toBeVisible();
  647 |   await page.screenshot({ path:"test-results/visuals/import-preview-desktop.png",fullPage:true });
  648 |   await page.getByRole("button", { name: "Confirmar importação" }).click();
  649 |   const confirmation=page.getByRole("dialog");
  650 |   await expect(confirmation.getByText("Escobar Residences")).toBeVisible();
  651 |   await expect(confirmation.getByText(/operação é atômica/i)).toBeVisible();
  652 |   await page.screenshot({path:"test-results/visuals/import-confirmation-desktop.png",fullPage:true});
  653 |   await confirmation.getByRole("button",{name:"Confirmar aplicação"}).click();
  654 |   await expect(page.getByText("Importação concluída: 1 linhas processadas.")).toBeVisible();
  655 |   await expect(page.getByText("Concluída",{exact:true})).toBeVisible();
  656 |   await page.screenshot({path:"test-results/visuals/import-history-desktop.png",fullPage:true});
  657 |   await page.setViewportSize({ width:768,height:1024 });
  658 |   await page.screenshot({ path:"test-results/visuals/import-tablet.png",fullPage:true });
  659 |   await page.setViewportSize({ width:390,height:844 });
  660 |   await page.screenshot({ path:"test-results/visuals/import-mobile.png",fullPage:true });
  661 | });
  662 | 
  663 | test("seller não vê nem acessa importações", async ({ page }) => {
  664 |   await mockBackend(page, { role:"seller" });
  665 |   await login(page);
  666 |   await expect(page.getByRole("link", { name:"Importações" })).toHaveCount(0);
  667 |   await page.goto(`/portal/projects/${projectId}/imports`);
  668 |   await expect(page).toHaveURL(/\/portal$/);
  669 | });
  670 | 
  671 | test("conflito preserva a intenção e exige nova revisão", async ({ page }) => {
  672 |   await mockBackend(page, { conflict: true });
  673 |   await login(page);
  674 |   await page.goto(`/portal/inventory/${unitId}`);
  675 |   const dialog = page.getByRole("dialog");
  676 |   await expect(dialog).toBeVisible();
  677 |   await dialog.getByLabel("Status").selectOption("reserved");
  678 |   await dialog.getByLabel("Motivo da alteração").fill("Reserva solicitada");
  679 |   await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  680 |   await expect(page.getByText("Alteração concorrente detectada")).toBeVisible();
  681 |   await expect(
  682 |     page.getByText(/Esta unidade foi alterada por outro usuário/),
  683 |   ).toBeVisible();
  684 |   await page.screenshot({
  685 |     path: "test-results/visuals/version-conflict.png",
  686 |     fullPage: true,
  687 |   });
  688 | });
  689 | 
  690 | test("estados vazio e erro possuem tratamento visual", async ({ page }) => {
  691 |   await mockBackend(page, { empty: true });
  692 |   await login(page);
  693 |   await page.getByRole("link", { name: "Inventário", exact: true }).click();
  694 |   await expect(
  695 |     page.getByRole("heading", { name: "Nenhuma unidade encontrada" }),
  696 |   ).toBeVisible();
  697 |   await page.screenshot({
  698 |     path: "test-results/visuals/inventory-empty-mobile.png",
  699 |     fullPage: true,
  700 |   });
  701 | });
  702 | 
  703 | test("recuperação não revela se o e-mail existe", async ({ page }) => {
  704 |   await mockBackend(page);
  705 |   await page.goto("/forgot-password");
  706 |   await page.getByLabel("E-mail").fill("usuario@escobar.test");
  707 |   await page
  708 |     .getByRole("button", { name: "Enviar link de recuperação" })
  709 |     .click();
  710 |   await expect(
  711 |     page.getByRole("heading", { name: "Verifique sua caixa de entrada" }),
  712 |   ).toBeVisible();
  713 | });
  714 | 
  715 | test("rota protegida redireciona e refresh direto funciona após login", async ({
  716 |   page,
  717 | }) => {
  718 |   await mockBackend(page);
> 719 |   await page.goto("/portal/inventory");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8892/portal/inventory
  720 |   await expect(page).toHaveURL(/\/login$/);
  721 |   await login(page, /\/portal\/inventory$/);
  722 |   await page.goto("/portal/inventory");
  723 |   await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
  724 |   await page.goBack();
  725 |   await page.goForward();
  726 |   await expect(page.getByRole("heading", { name: "Inventário" })).toBeVisible();
  727 | });
  728 | 
  729 | test("login inválido, logout e callback inválido têm mensagens seguras", async ({
  730 |   page,
  731 | }) => {
  732 |   await mockBackend(page, { invalidLogin: true });
  733 |   await page.goto("/login");
  734 |   await page.getByLabel("E-mail").fill("x@escobar.test");
  735 |   await page.getByLabel("Senha").fill("incorreta");
  736 |   await page.getByRole("button", { name: "Entrar" }).click();
  737 |   await expect(page.getByRole("alert")).toHaveText(
  738 |     "E-mail ou senha inválidos.",
  739 |   );
  740 |   await page.goto("/reset-password");
  741 |   await expect(
  742 |     page.getByRole("heading", { name: "Link inválido ou expirado" }),
  743 |   ).toBeVisible();
  744 | });
  745 | 
  746 | test("usuário inativo e usuário sem organização ficam bloqueados", async ({
  747 |   page,
  748 | }) => {
  749 |   await mockBackend(page, { active: false });
  750 |   await login(page);
  751 |   await expect(
  752 |     page.getByRole("heading", { name: "Acesso indisponível" }),
  753 |   ).toBeVisible();
  754 |   await page.context().clearCookies();
  755 |   await page.evaluate(() => localStorage.clear());
  756 |   const second = await page.context().newPage();
  757 |   await mockBackend(second, { noOrganizations: true });
  758 |   await login(second);
  759 |   await expect(
  760 |     second.getByRole("heading", { name: "Nenhuma organização disponível" }),
  761 |   ).toBeVisible();
  762 | });
  763 | 
  764 | test("seller só recebe ações permitidas e viewer não acessa histórico", async ({
  765 |   page,
  766 | }) => {
  767 |   await mockBackend(page, { role: "seller" });
  768 |   await login(page);
  769 |   await page.goto(`/portal/inventory/${unitId}`);
  770 |   const dialog = page.getByRole("dialog");
  771 |   await expect(dialog.getByLabel("Preço")).toBeDisabled();
  772 |   await expect(dialog.getByLabel("Unidade publicada")).toBeDisabled();
  773 |   await expect(dialog.getByLabel("Status")).toContainText("Reservada");
  774 |   await page.context().clearCookies();
  775 |   await page.evaluate(() => localStorage.clear());
  776 |   const viewer = await page.context().newPage();
  777 |   await mockBackend(viewer, { role: "viewer" });
  778 |   await login(viewer);
  779 |   await expect(viewer.getByRole("link", { name: "Histórico" })).toHaveCount(0);
  780 | });
  781 | 
  782 | test("reversão de venda exige confirmação reforçada", async ({ page }) => {
  783 |   await mockBackend(page, { status: "sold" });
  784 |   await login(page);
  785 |   await page.goto(`/portal/inventory/${unitId}`);
  786 |   const dialog = page.getByRole("dialog");
  787 |   await dialog.getByLabel("Status").selectOption("available");
  788 |   await dialog.getByLabel("Motivo da alteração").fill("Contrato cancelado");
  789 |   await expect(
  790 |     dialog.getByRole("button", { name: "Salvar alterações" }),
  791 |   ).toBeDisabled();
  792 |   await dialog.getByLabel(/Confirmo que desejo reverter/).check();
  793 |   await expect(
  794 |     dialog.getByRole("button", { name: "Salvar alterações" }),
  795 |   ).toBeEnabled();
  796 |   await page.screenshot({
  797 |     path: "test-results/visuals/sold-reversal-confirmation.png",
  798 |     fullPage: true,
  799 |   });
  800 | });
  801 | 
  802 | test("resultado de rede ambíguo é verificado sem reenviar a mutação", async ({
  803 |   page,
  804 | }) => {
  805 |   await mockBackend(page, { ambiguousApplied: true });
  806 |   await login(page);
  807 |   await page.goto(`/portal/inventory/${unitId}`);
  808 |   const dialog = page.getByRole("dialog");
  809 |   await dialog.getByLabel("Status").selectOption("reserved");
  810 |   await dialog.getByLabel("Motivo da alteração").fill("Contato confirmado");
  811 |   await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  812 |   await expect(
  813 |     page.getByText("Unidade 1203 atualizada com sucesso."),
  814 |   ).toBeVisible();
  815 | });
  816 | 
  817 | test("clientes e usuários funcionam em desktop, tablet e móvel", async ({
  818 |   page,
  819 | }) => {
```