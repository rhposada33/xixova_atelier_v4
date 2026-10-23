import { normalizeDecimal, normalizeUnitCode, type DecimalString, type UnitRecord, type UnitStatus } from "./inventory";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;
export const CSV_COLUMNS = [
  "code", "floor", "type", "bedrooms", "bathrooms", "parking_spaces",
  "area_m2", "price_brl", "status", "published", "expected_version",
] as const;

export interface CsvIssue {
  row: number;
  column?: string;
  code: string;
  message: string;
}

export interface InventoryCsvRow {
  sourceLine: number;
  code: string;
  floor: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  areaM2: DecimalString;
  priceBRL: DecimalString | null;
  status: UnitStatus;
  published: boolean;
  expectedVersion: number | null;
}

export interface ParsedInventoryCsv {
  rows: InventoryCsvRow[];
  issues: CsvIssue[];
  bytes: number;
}

export interface PreviewLine {
  row: number;
  code: string;
  classification: "new" | "changed" | "unchanged" | "conflict";
  before?: UnitRecord;
  after?: InventoryCsvRow;
}

const issue = (row: number, code: string, message: string, column?: string): CsvIssue => ({ row, code, message, ...(column ? { column } : {}) });

async function readBounded(file: Blob): Promise<Uint8Array> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("O CSV excede 2 MiB.");
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMPORT_BYTES) throw new Error("O CSV excede 2 MiB.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

/** RFC 4180 fields, including quoted separators and newlines. Row numbers are physical start lines. */
function splitCsv(text: string, delimiter: ";" | ","): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cell = "";
  let line = 1;
  let rowStart = 1;
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else { cell += c; if (c === "\n") line++; }
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw new Error(`CSV malformado na linha ${line}.`);
      quoted = true;
    } else if (c === delimiter) {
      cells.push(cell); cell = ""; closed = false;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cells.push(cell);
      if (cells.some((value) => value.trim())) rows.push({ cells, line: rowStart });
      if (rows.length > MAX_IMPORT_ROWS + 1) throw new Error("O CSV excede 2.000 linhas de dados.");
      cells = []; cell = ""; closed = false; line++; rowStart = line;
    } else {
      if (closed && c !== " ") throw new Error(`CSV malformado na linha ${line}.`);
      cell += c;
    }
  }
  if (quoted) throw new Error(`Aspas não fechadas na linha ${rowStart}.`);
  cells.push(cell);
  if (cells.some((value) => value.trim())) rows.push({ cells, line: rowStart });
  if (rows.length > MAX_IMPORT_ROWS + 1) throw new Error("O CSV excede 2.000 linhas de dados.");
  return rows;
}

function nonnegativeInteger(value: string, max: number): number {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error("Informe um número inteiro não negativo.");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) throw new Error("Número fora do limite permitido.");
  return number;
}

export async function parseInventoryCsv(file: Blob): Promise<ParsedInventoryCsv> {
  const bytes = await readBounded(file);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { return { rows: [], issues: [issue(1, "encoding", "Use um arquivo CSV em UTF-8.")], bytes: bytes.length }; }
  if (!text.trim()) return { rows: [], issues: [issue(1, "empty", "O arquivo está vazio.")], bytes: bytes.length };
  let raw: ReturnType<typeof splitCsv>;
  try {
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";
    raw = splitCsv(text, delimiter);
  } catch (error) {
    return { rows: [], issues: [issue(1, "malformed", error instanceof Error ? error.message : "CSV malformado.")], bytes: bytes.length };
  }
  const header = raw[0]?.cells.map((cell) => cell.trim().toLowerCase());
  if (!header || new Set(header).size !== header.length || header.length !== CSV_COLUMNS.length || CSV_COLUMNS.some((column, index) => header[index] !== column)) {
    return { rows: [], issues: [issue(1, "headers", `Cabeçalhos esperados: ${CSV_COLUMNS.join(";")}.`)], bytes: bytes.length };
  }
  const rows: InventoryCsvRow[] = [];
  const issues: CsvIssue[] = [];
  const seen = new Set<string>();
  for (const record of raw.slice(1)) {
    if (record.cells.length !== CSV_COLUMNS.length) { issues.push(issue(record.line, "columns", "Quantidade de colunas inválida.")); continue; }
    const values = Object.fromEntries(header.map((name, index) => [name, record.cells[index].trim()])) as Record<(typeof CSV_COLUMNS)[number], string>;
    const field = <T>(name: (typeof CSV_COLUMNS)[number], parse: () => T): T | undefined => {
      try { return parse(); }
      catch (error) { issues.push(issue(record.line, "invalid", error instanceof Error ? error.message : "Valor inválido.", name)); return undefined; }
    };
    const code = field("code", () => normalizeUnitCode(values.code));
    const floor = field("floor", () => nonnegativeInteger(values.floor, 500));
    const type = field("type", () => { if (!values.type || values.type.length > 80) throw new Error("Tipologia obrigatória, até 80 caracteres."); return values.type; });
    const bedrooms = field("bedrooms", () => nonnegativeInteger(values.bedrooms, 30));
    const bathrooms = field("bathrooms", () => nonnegativeInteger(values.bathrooms, 30));
    const parkingSpaces = field("parking_spaces", () => nonnegativeInteger(values.parking_spaces, 30));
    const areaM2 = field("area_m2", () => { const value = normalizeDecimal(values.area_m2, 3); if (Number(value) <= 0) throw new Error("Área deve ser positiva."); return value; });
    const priceBRL = field("price_brl", () => values.price_brl ? normalizeDecimal(values.price_brl, 2) : null);
    const status = field("status", () => { if (!["available", "reserved", "sold", "unavailable"].includes(values.status)) throw new Error("Disponibilidade inválida."); return values.status as UnitStatus; });
    const published = field("published", () => { if (values.published !== "true" && values.published !== "false") throw new Error("Use true ou false."); return values.published === "true"; });
    const expectedVersion = field("expected_version", () => values.expected_version ? nonnegativeInteger(values.expected_version, 2147483647) : null);
    if (code && seen.has(code)) issues.push(issue(record.line, "duplicate", "Código repetido no CSV após normalização.", "code"));
    if (code) seen.add(code);
    if (code !== undefined && floor !== undefined && type !== undefined && bedrooms !== undefined && bathrooms !== undefined && parkingSpaces !== undefined && areaM2 !== undefined && priceBRL !== undefined && status !== undefined && published !== undefined && expectedVersion !== undefined) {
      rows.push({ sourceLine: record.line, code, floor, type, bedrooms, bathrooms, parkingSpaces, areaM2, priceBRL, status, published, expectedVersion });
    }
  }
  return { rows, issues, bytes: bytes.length };
}

export function previewInventoryDiff(rows: readonly InventoryCsvRow[], existing: readonly UnitRecord[]): PreviewLine[] {
  const byCode = new Map(existing.map((unit) => [unit.code, unit]));
  return rows.map((row) => {
    const before = byCode.get(row.code);
    if (!before) return { row: row.sourceLine, code: row.code, classification: row.expectedVersion === null ? "new" : "conflict", after: row };
    if (row.expectedVersion !== before.version) return { row: row.sourceLine, code: row.code, classification: "conflict", before, after: row };
    const unchanged = before.floor === row.floor && before.type === row.type && before.bedrooms === row.bedrooms && before.bathrooms === row.bathrooms && before.parkingSpaces === row.parkingSpaces && before.areaM2 === row.areaM2 && before.priceBRL === row.priceBRL && before.status === row.status && before.published === row.published;
    return { row: row.sourceLine, code: row.code, classification: unchanged ? "unchanged" : "changed", before, after: row };
  });
}

export function canConfirmPreview(parsed: ParsedInventoryCsv, diff: readonly PreviewLine[]): boolean {
  return parsed.issues.length === 0 && parsed.rows.length > 0 && diff.length === parsed.rows.length && diff.every((line) => line.classification !== "conflict");
}

export function csvTemplate(): string { return `\uFEFF${CSV_COLUMNS.join(";")}\r\n`; }
