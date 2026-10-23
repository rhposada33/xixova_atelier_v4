import { describe, expect, it } from "vitest";
import { chooseOrganization, safeReturnTo, visibleOrganizations } from "./access";

describe("navegação e seleção local", () => {
  it("aceita somente retorno ao portal Connect", () => {
    expect(safeReturnTo("/connect/profile")).toBe("/connect/profile");
    expect(safeReturnTo("//evil.test")).toBe("/connect");
    expect(safeReturnTo("/connectevil")).toBe("/connect");
    expect(safeReturnTo("/portal")).toBe("/connect");
  });
  it("descarta organização selecionada que não está mais ativa", () => {
    const orgs = [{ id: "a", name: "A", slug: "a", status: "active" as const, version: 1 }, { id: "b", name: "B", slug: "b", status: "active" as const, version: 1 }];
    const memberships = [{ organizationId: "a", userId: "u", role: "organization_admin" as const, active: true, version: 1 }, { organizationId: "b", userId: "u", role: "sales_manager" as const, active: false, version: 1 }];
    const visible = visibleOrganizations(orgs, memberships);
    expect(chooseOrganization(visible, "b")).toBe("a");
  });
});
