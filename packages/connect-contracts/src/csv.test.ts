import { describe, expect, it } from "vitest";
import { canConfirmPreview, CSV_COLUMNS, MAX_IMPORT_BYTES, parseInventoryCsv, previewInventoryDiff } from "./csv";
import { normalizeDecimal, type UnitRecord } from "./inventory";

const header = CSV_COLUMNS.join(";");
const row = (code = "A101", version = "") => `${code};1;2 quartos;2;1;1;72,500;1.250.000,90;available;true;${version}`;
const file = (body: string) => new Blob([body], { type: "text/csv" });
const existing: UnitRecord = {
  id: "unit-a", organizationId: "org-a", projectId: "project-a", code: "A101", floor: 1,
  type: "2 quartos", bedrooms: 2, bathrooms: 1, parkingSpaces: 1,
  areaM2: normalizeDecimal("72,500", 3), priceBRL: normalizeDecimal("1250000,90", 2),
  status: "available", published: true, version: 3,
};

describe("prévia CSV Connect sem mutação", () => {
  it("aceita BOM, decimal brasileiro e preserva precisão", async () => {
    const parsed = await parseInventoryCsv(file(`\uFEFF${header}\r\n${row()}`));
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ code: "A101", areaM2: "72.500", priceBRL: "1250000.90" });
  });
  it("aceita campo entre aspas com separador e quebra de linha", async () => {
    const parsed = await parseInventoryCsv(file(`${header}\nA101;1;"2 quartos;\ncompacto";2;1;1;72,500;100,00;available;true;`));
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0].type).toBe("2 quartos;\ncompacto");
  });
  it("rejeita código duplicado após normalização e CSV malformado", async () => {
    expect((await parseInventoryCsv(file(`${header}\n${row("a101")}\n${row("A101")}`))).issues).toContainEqual(expect.objectContaining({ code: "duplicate" }));
    expect((await parseInventoryCsv(file(`${header}\n"A101;1`))).issues).toContainEqual(expect.objectContaining({ code: "malformed" }));
  });
  it("limita bytes e linhas antes da prévia", async () => {
    await expect(parseInventoryCsv(new Blob([new Uint8Array(MAX_IMPORT_BYTES + 1)]))).rejects.toThrow("2 MiB");
    const parsed = await parseInventoryCsv(file(`${header}\n${Array(2001).fill(row()).join("\n")}`));
    expect(parsed.issues[0].code).toBe("malformed");
    expect(parsed.rows).toHaveLength(0);
  });
  it("classifica novo, igual, alterado e conflito de versão", async () => {
    const parsed = await parseInventoryCsv(file(`${header}\n${row("A101", "3")}\n${row("A102")}`));
    expect(previewInventoryDiff(parsed.rows, [existing]).map((line) => line.classification)).toEqual(["unchanged", "new"]);
    expect(canConfirmPreview(parsed, previewInventoryDiff(parsed.rows, [existing]))).toBe(true);
    const changed = { ...parsed.rows[0], status: "sold" as const };
    expect(previewInventoryDiff([changed], [existing])[0].classification).toBe("changed");
    const conflict = previewInventoryDiff([{ ...changed, expectedVersion: 2 }], [existing]);
    expect(conflict[0].classification).toBe("conflict");
    expect(canConfirmPreview(parsed, conflict)).toBe(false);
  });
});
