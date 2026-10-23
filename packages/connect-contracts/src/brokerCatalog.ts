import type { DecimalString, UnitStatus } from "./inventory";

export interface BrokerCatalogProject {
  projectId: string;
  organizationName: string;
  name: string;
  city: string;
  state: string;
  status: "published";
  types: string[];
  availableCount: number;
}
export interface BrokerCatalogDetail extends BrokerCatalogProject {
  description: string | null;
  priceVisible: boolean;
}
export interface BrokerCatalogUnit {
  id: string;
  code: string;
  floor: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  areaM2: DecimalString;
  priceBRL: DecimalString | null;
  status: UnitStatus;
}
export interface BrokerInventoryFilters {
  floor?: number;
  type?: string;
  bedrooms?: number;
  minArea?: DecimalString;
  maxArea?: DecimalString;
  minPrice?: DecimalString;
  maxPrice?: DecimalString;
  status?: UnitStatus;
  sort?: "code" | "price" | "area" | "floor";
  direction?: "asc" | "desc";
}
export interface BrokerInventoryPage { data: BrokerCatalogUnit[]; total: number; nextOffset: number | null; }

export function validateBrokerInventoryFilters(value: BrokerInventoryFilters, priceVisible: boolean): BrokerInventoryFilters {
  const keys = ["floor","type","bedrooms","minArea","maxArea","minPrice","maxPrice","status","sort","direction"];
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error("Filtro inválido.");
  if (!priceVisible && (value.minPrice !== undefined || value.maxPrice !== undefined || value.sort === "price")) throw new Error("Preço não autorizado neste empreendimento.");
  if (value.floor !== undefined && (!Number.isInteger(value.floor) || value.floor < 0 || value.floor > 500)) throw new Error("Andar inválido.");
  if (value.bedrooms !== undefined && (!Number.isInteger(value.bedrooms) || value.bedrooms < 0 || value.bedrooms > 30)) throw new Error("Dormitórios inválidos.");
  if (value.type !== undefined && (!value.type.trim() || value.type.length > 80)) throw new Error("Tipologia inválida.");
  for (const key of ["minArea","maxArea","minPrice","maxPrice"] as const) {
    const field = value[key];
    if (field !== undefined && !/^\d{1,12}\.\d{2,3}$/.test(field)) throw new Error("Valor do filtro inválido.");
  }
  return value;
}
