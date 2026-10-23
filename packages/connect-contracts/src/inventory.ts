export type ProjectStatus = "draft" | "published" | "archived";
export type UnitStatus = "available" | "reserved" | "sold" | "unavailable";
export type DecimalString = string & { readonly __decimal: unique symbol };

export interface CommercialVisibility {
  description: boolean;
  unitFeatures: boolean;
  price: boolean;
  images: boolean;
  floorPlans: boolean;
  availability: boolean;
}

export const PRIVATE_VISIBILITY: Readonly<CommercialVisibility> = Object.freeze({
  description: false,
  unitFeatures: false,
  price: false,
  images: false,
  floorPlans: false,
  availability: false,
});

export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  publicSlug: string;
  description: string | null;
  city: string;
  state: string;
  address: string | null;
  status: ProjectStatus;
  visibility: CommercialVisibility;
  brokerPriceVisible: boolean;
  version: number;
}

export interface UnitRecord {
  id: string;
  organizationId: string;
  projectId: string;
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
  version: number;
}

export interface ProjectAssetRecord {
  id: string;
  organizationId: string;
  projectId: string;
  unitId: string | null;
  assetType: "image" | "floor_plan" | "document" | "3d_model";
  storagePath: string;
  visibility: "public" | "private";
  mimeType: string;
  checksum: string;
}

export interface ApiError {
  error: {
    code: "validation" | "forbidden" | "not_found" | "conflict" | "rate_limited" | "internal";
    message: string;
    fieldErrors?: Record<string, string>;
    requestId: string;
  };
}

export interface Page<T> {
  data: T[];
  meta: { nextCursor: string | null };
}

export interface VersionedUpdate {
  expectedVersion: number;
}

export interface UnitUpdate extends VersionedUpdate {
  floor?: number;
  type?: string;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  areaM2?: DecimalString;
  priceBRL?: DecimalString | null;
  status?: UnitStatus;
  published?: boolean;
}

export interface ProjectCreate {
  organizationId: string;
  name: string;
  slug: string;
  publicSlug: string;
  description?: string | null;
  city: string;
  state: string;
  address?: string | null;
}

export interface ProjectUpdate extends VersionedUpdate {
  name?: string;
  description?: string | null;
  city?: string;
  state?: string;
  address?: string | null;
  visibility?: CommercialVisibility;
}

export interface UnitCreate {
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
}

export interface InventoryImportSummary {
  id: string;
  projectId: string;
  status: "validated" | "invalid" | "completed" | "conflict";
  fileHash: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdAt: string;
  confirmedAt: string | null;
}

export function normalizeUnitCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(normalized)) {
    throw new Error("Código da unidade inválido; use 1 a 32 letras, números, _ ou -.");
  }
  return normalized;
}

/** Shape validation only. Tenant membership, slug uniqueness and publication live on the server. */
export function parseProjectCreate(input: unknown): ProjectCreate {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Projeto inválido.");
  const value = input as Record<string, unknown>;
  const allowed = new Set(["organizationId", "name", "slug", "publicSlug", "description", "city", "state", "address"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("Campo de projeto não permitido.");
  const required = (key: "organizationId" | "name" | "slug" | "publicSlug" | "city" | "state", max: number): string => {
    const field = value[key];
    if (typeof field !== "string" || !field.trim() || field.trim().length > max) throw new Error(`Campo ${key} inválido.`);
    return field.trim();
  };
  const optional = (key: "description" | "address", max: number): string | null | undefined => {
    const field = value[key];
    if (field === undefined || field === null) return field;
    if (typeof field !== "string" || field.trim().length > max) throw new Error(`Campo ${key} inválido.`);
    return field.trim();
  };
  const organizationId = required("organizationId", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) throw new Error("Organização inválida.");
  const slug = required("slug", 80);
  const publicSlug = required("publicSlug", 100);
  if (![slug, publicSlug].every((item) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item))) throw new Error("Slug inválido.");
  const state = required("state", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw new Error("UF inválida.");
  return {
    organizationId, name: required("name", 160), slug, publicSlug,
    city: required("city", 120), state,
    ...(value.description !== undefined ? { description: optional("description", 2000) } : {}),
    ...(value.address !== undefined ? { address: optional("address", 300) } : {}),
  };
}

/** Accept canonical decimal or Brazilian grouping with comma decimal, never floating point. */
export function normalizeDecimal(value: string, scale: 2 | 3): DecimalString {
  const input = value.trim();
  const canonical = /^\d+(?:\.\d+)?$/.test(input)
    ? input
    : /^\d{1,3}(?:\.\d{3})+,\d+$/.test(input)
      ? input.replaceAll(".", "").replace(",", ".")
      : /^\d+,\d+$/.test(input)
        ? input.replace(",", ".")
        : "";
  const match = /^(\d+)(?:\.(\d+))?$/.exec(canonical);
  if (!match || (match[2]?.length ?? 0) > scale || match[1].length > 12) {
    throw new Error("Valor decimal inválido ou ambíguo.");
  }
  const integer = match[1].replace(/^0+(?=\d)/, "");
  return `${integer}.${(match[2] ?? "").padEnd(scale, "0")}` as DecimalString;
}

/** Presentation projection only; the server must authorize and select columns before calling. */
export function publicProjectProjection(project: ProjectRecord, units: readonly UnitRecord[]) {
  if (project.status !== "published") return null;
  const visibility = project.visibility;
  return {
    publicSlug: project.publicSlug,
    name: project.name,
    city: project.city,
    state: project.state,
    ...(visibility.description ? { description: project.description } : {}),
    units: units.filter((unit) => unit.projectId === project.id && unit.published).map((unit) => ({
      code: unit.code,
      ...(visibility.unitFeatures ? {
        floor: unit.floor,
        type: unit.type,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        parkingSpaces: unit.parkingSpaces,
        areaM2: unit.areaM2,
      } : {}),
      ...(visibility.price ? { priceBRL: unit.priceBRL } : {}),
      ...(visibility.availability ? { status: unit.status } : {}),
    })),
  };
}
