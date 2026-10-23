import { describe, expect, it } from "vitest";
import { normalizeDecimal, normalizeUnitCode, parseProjectCreate, PRIVATE_VISIBILITY, publicProjectProjection, type ProjectRecord, type UnitRecord } from "./inventory";

const project: ProjectRecord = {
  id: "project-a", organizationId: "org-a", name: "Jardins", slug: "jardins",
  publicSlug: "org-a-jardins", description: "Vista mar", city: "Santos", state: "SP",
  address: "Rua privada", status: "published", visibility: { ...PRIVATE_VISIBILITY }, brokerPriceVisible: false, version: 1,
};
const unit: UnitRecord = {
  id: "unit-a", organizationId: "org-a", projectId: "project-a", code: "A101", floor: 1,
  type: "2 quartos", bedrooms: 2, bathrooms: 1, parkingSpaces: 1,
  areaM2: normalizeDecimal("72,500", 3), priceBRL: normalizeDecimal("1250000,90", 2),
  status: "available", published: true, version: 2,
};

describe("contratos de inventário Connect", () => {
  it("normaliza códigos e rejeita formato não permitido", () => {
    expect(normalizeUnitCode(" a-101 ")).toBe("A-101");
    expect(() => normalizeUnitCode("A 101")).toThrow();
  });
  it("mantém centavos como string e rejeita precisão excessiva", () => {
    expect(normalizeDecimal("1.250.000,90", 2)).toBe("1250000.90");
    expect(normalizeDecimal("0,10", 2)).toBe("0.10");
    expect(() => normalizeDecimal("1.00,99", 2)).toThrow();
    expect(() => normalizeDecimal("12.345", 2)).toThrow();
  });
  it("valida entrada de projeto e rejeita campos de ownership alternativos", () => {
    const input = { organizationId: "00000000-0000-4000-8000-000000000001", name: "Jardins", slug: "jardins", publicSlug: "org-a-jardins", city: "Santos", state: "sp" };
    expect(parseProjectCreate(input).state).toBe("SP");
    expect(() => parseProjectCreate({ ...input, ownerId: "other" })).toThrow("não permitido");
    expect(() => parseProjectCreate({ ...input, publicSlug: "Outro Projeto" })).toThrow("Slug");
  });
  it("não projeta rascunho ou preço privado", () => {
    expect(publicProjectProjection({ ...project, status: "draft" }, [unit])).toBeNull();
    const data = publicProjectProjection(project, [unit]);
    expect(JSON.stringify(data)).not.toContain("1250000.90");
    expect(JSON.stringify(data)).not.toContain("Rua privada");
    expect(data?.units).toEqual([{ code: "A101" }]);
  });
  it("projeta somente campos explicitamente autorizados e unidades publicadas", () => {
    const data = publicProjectProjection({ ...project, visibility: { ...PRIVATE_VISIBILITY, price: true, availability: true } }, [unit, { ...unit, id: "unit-b", code: "A102", published: false }]);
    expect(data?.units).toEqual([{ code: "A101", priceBRL: "1250000.90", status: "available" }]);
  });
});
