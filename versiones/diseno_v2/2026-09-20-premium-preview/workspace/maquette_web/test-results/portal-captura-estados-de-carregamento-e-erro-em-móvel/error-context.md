# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: portal.spec.ts >> captura estados de carregamento e erro em móvel
- Location: tests/portal.spec.ts:863:1

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
  820 |   await mockBackend(page);
  821 |   await login(page);
  822 |   await page.getByRole("link", { name: "Clientes" }).click();
  823 |   await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  824 |   await expect(page.getByText("escobar", { exact: true })).toBeVisible();
  825 |   await page.screenshot({
  826 |     path: "test-results/visuals/clients-desktop.png",
  827 |     fullPage: true,
  828 |   });
  829 |   await page.getByRole("link", { name: "Usuários" }).click();
  830 |   await expect(page.getByText("Administrador Local")).toBeVisible();
  831 |   await expect(page.getByText("no***@example.test")).toBeVisible();
  832 |   await page.setViewportSize({ width: 768, height: 1024 });
  833 |   await page.screenshot({
  834 |     path: "test-results/visuals/users-tablet.png",
  835 |     fullPage: true,
  836 |   });
  837 |   await page.setViewportSize({ width: 390, height: 844 });
  838 |   await page.screenshot({
  839 |     path: "test-results/visuals/users-mobile.png",
  840 |     fullPage: true,
  841 |   });
  842 | });
  843 | 
  844 | test("aceitação de convite exige sessão e retorna ao callback", async ({
  845 |   page,
  846 | }) => {
  847 |   await mockBackend(page);
  848 |   const opaque = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  849 |   await page.goto(`/accept-invitation?token=${opaque}`);
  850 |   await expect(
  851 |     page.getByRole("heading", { name: "Entre para aceitar" }),
  852 |   ).toBeVisible();
  853 |   await page.getByRole("link", { name: "Entrar" }).click();
  854 |   await page.getByLabel("E-mail").fill("admin@escobar.test");
  855 |   await page.getByLabel("Senha").fill("SenhaLocal123!");
  856 |   await page.getByRole("button", { name: "Entrar" }).click();
  857 |   await expect(page).toHaveURL(/accept-invitation/);
  858 |   await expect(
  859 |     page.getByText("Convite aceito. Seu acesso à organização está ativo."),
  860 |   ).toBeVisible();
  861 | });
  862 | 
  863 | test("captura estados de carregamento e erro em móvel", async ({ page }) => {
  864 |   await page.setViewportSize({ width: 390, height: 844 });
  865 |   await mockBackend(page, { delay: true, error: true });
> 866 |   await page.goto("/login");
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8892/login
  867 |   await page.getByLabel("E-mail").fill("admin@escobar.test");
  868 |   await page.getByLabel("Senha").fill("SenhaLocal123!");
  869 |   await page.getByRole("button", { name: "Entrar" }).click();
  870 |   await expect(
  871 |     page.getByText("Estamos restaurando sua sessão e validando o acesso."),
  872 |   ).toBeVisible();
  873 |   await page.screenshot({
  874 |     path: "test-results/visuals/portal-loading-mobile.png",
  875 |     fullPage: true,
  876 |   });
  877 |   await page.goto("/portal/inventory");
  878 |   await expect(page.getByRole("alert")).toBeVisible();
  879 |   await page.screenshot({
  880 |     path: "test-results/visuals/inventory-error-mobile.png",
  881 |     fullPage: true,
  882 |   });
  883 | });
  884 | 
  885 | test("projetos e estrutura funcionam em rotas diretas responsivas", async ({
  886 |   page,
  887 | }) => {
  888 |   await mockBackend(page);
  889 |   await login(page);
  890 |   await page.getByRole("link", { name: "Projetos" }).click();
  891 |   await expect(page.getByRole("heading", { name: "Projetos" })).toBeVisible();
  892 |   await expect(page.getByRole("cell", { name: /Escobar Residences/ })).toBeVisible();
  893 |   await page.screenshot({
  894 |     path: "test-results/visuals/projects-desktop.png",
  895 |     fullPage: true,
  896 |   });
  897 |   await page.getByRole("link", { name: "Abrir" }).click();
  898 |   await page.getByRole("button", { name: "Validar preparação" }).click();
  899 |   await expect(
  900 |     page.getByRole("heading", { name: "Projeto pronto" }),
  901 |   ).toBeVisible();
  902 |   await page.getByRole("link", { name: "Administrar estrutura" }).click();
  903 |   await expect(page.getByText("Torre A")).toBeVisible();
  904 |   await page.setViewportSize({ width: 768, height: 1024 });
  905 |   await page.screenshot({
  906 |     path: "test-results/visuals/structure-tablet.png",
  907 |     fullPage: true,
  908 |   });
  909 |   await page.goto(`/portal/projects/${projectId}/unit-types`);
  910 |   await expect(page.getByText("garden_house_18")).toBeVisible();
  911 |   await page.setViewportSize({ width: 390, height: 844 });
  912 |   await page.screenshot({
  913 |     path: "test-results/visuals/unit-types-mobile.png",
  914 |     fullPage: true,
  915 |   });
  916 | });
  917 | 
```