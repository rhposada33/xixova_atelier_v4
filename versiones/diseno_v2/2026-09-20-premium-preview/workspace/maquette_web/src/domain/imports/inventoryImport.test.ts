import { describe, expect, it } from "vitest";
import { IMPORT_COLUMNS, MAX_IMPORT_BYTES, issuesCsv, parseInventoryCsv, protectSpreadsheetCell, templateCsv } from "./inventoryImport";

const file = (body: string, size = new TextEncoder().encode(body).length) => ({ name: "units.csv", size, text: async () => body });
const valid = (delimiter = ";") => `${IMPORT_COLUMNS.join(delimiter)}\nA101${delimiter}A${delimiter}F1${delimiter}T1${delimiter}REF${delimiter}north${delimiter}sea${delimiter}morning${delimiter}1${delimiter}250000,50${delimiter}BRL${delimiter}available${delimiter}false${delimiter}1`;

describe("inventory CSV", () => {
  it("aceita BOM, ponto e vírgula e decimal brasileiro", async () => {
    const parsed = await parseInventoryCsv(file(`\uFEFF${valid()}`));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ unit_code: "A101", price: "250000.50" });
  });
  it("aceita vírgula e campos RFC 4180 entre aspas", async () => {
    const body = `${IMPORT_COLUMNS.join(",")}\nA101,A,F1,T1,"REF, 1",north,sea,morning,1,250000.50,BRL,available,false,1`;
    const parsed = await parseInventoryCsv(file(body));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].external_reference).toBe("REF, 1");
  });
  it.each([
    ["arquivo vazio", "", "empty"],
    ["cabeçalho duplicado", `unit_code;unit_code\n1;2`, "duplicate_header"],
    ["cabeçalho desconhecido", `unknown\n1`, "headers"],
  ])("rejeita %s", async (_label, body, code) => expect((await parseInventoryCsv(file(body))).errors.some((x) => x.code === code)).toBe(true));
  it("rejeita números ambíguos", async () => {
    const parsed = await parseInventoryCsv(file(valid().replace("250000,50", "1.250")));
    expect(parsed.errors).toContainEqual(expect.objectContaining({ code: "ambiguous_number", column: "price" }));
  });
  it("limita linhas e bytes antes do envio", async () => {
    const header = IMPORT_COLUMNS.join(";");
    const row = valid().split("\n")[1];
    expect((await parseInventoryCsv(file(`${header}\n${Array(1001).fill(row).join("\n")}`))).errors.some((x) => x.code === "too_many_rows")).toBe(true);
    expect((await parseInventoryCsv(file(valid(), MAX_IMPORT_BYTES + 1))).errors[0].code).toBe("too_large");
  });
  it("gera modelo UTF-8 e neutraliza fórmulas nos relatórios", () => {
    expect(templateCsv()).toBe(`\uFEFF${IMPORT_COLUMNS.join(";")}\r\n`);
    expect(protectSpreadsheetCell("=1+1")).toBe("'=1+1");
    expect(issuesCsv([{ row: 2, code: "=CMD", message: "+erro", severity: "error" }])).toContain("\"'=CMD\"");
  });
});
