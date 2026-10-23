import { connectClient } from "./supabase";
import type { CommercialVisibility, InventoryCsvRow, Page, ProjectCreate, ProjectRecord, ProjectStatus, ProjectUpdate, UnitCreate, UnitRecord, UnitUpdate } from "@promoven/connect-contracts";

type JsonRow = Record<string, unknown>;
function fail(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === "PT409" || error.code === "40001" || error.code === "23505" || error.code === "40P01") throw new Error("Conflito de versão ou identificador. Atualize a página e revise os dados.");
  if (error.code === "42501") throw new Error("Você não tem permissão para esta operação.");
  throw new Error(error.message);
}
function project(r: JsonRow): ProjectRecord { return {
  id: String(r.id), organizationId: String(r.organization_id), name: String(r.name), slug: String(r.slug), publicSlug: String(r.public_slug),
  description: r.description === null ? null : String(r.description), city: String(r.city), state: String(r.state), address: r.address === null ? null : String(r.address),
  status: r.status as ProjectStatus, visibility: r.visibility as CommercialVisibility, brokerPriceVisible: Boolean(r.broker_price_visible), version: Number(r.version),
}; }
function unit(r: JsonRow): UnitRecord { return {
  id: String(r.id), organizationId: String(r.organization_id), projectId: String(r.project_id), code: String(r.code),
  floor: Number(r.floor), type: String(r.type), bedrooms: Number(r.bedrooms), bathrooms: Number(r.bathrooms), parkingSpaces: Number(r.parking_spaces),
  areaM2: String(r.area_m2) as UnitRecord["areaM2"], priceBRL: r.price_brl === null ? null : String(r.price_brl) as UnitRecord["priceBRL"],
  status: r.status as UnitRecord["status"], published: Boolean(r.published), version: Number(r.version),
}; }
export const connectApi = {
  async projectPage(organizationId: string, cursor: string | null = null): Promise<Page<ProjectRecord>> { const offset=cursor?Number(cursor):0; if(!Number.isSafeInteger(offset)||offset<0)throw new Error("Cursor inválido."); const { data, error } = await connectClient().from("projects").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).order("id").range(offset,offset+100); fail(error); const rows=(data??[]).map(project);return {data:rows.slice(0,100),meta:{nextCursor:rows.length>100?String(offset+100):null}}; },
  async project(id: string) { const { data, error } = await connectClient().from("projects").select("*").eq("id", id).maybeSingle(); fail(error); if (!data) throw new Error("Empreendimento não encontrado."); return project(data); },
  async createProject(value: ProjectCreate) { const { data, error } = await connectClient().rpc("connect_create_project", { p_data: value }); fail(error); return project(data); },
  async updateProject(id: string, value: ProjectUpdate) { const { expectedVersion, ...changes } = value; const { data, error } = await connectClient().rpc("connect_update_project", { p_id: id, p_expected_version: expectedVersion, p_data: changes }); fail(error); return project(data); },
  async publishProject(id: string, version: number, status: ProjectStatus) { const { data, error } = await connectClient().rpc("connect_publish_project", { p_id: id, p_expected_version: version, p_status: status }); fail(error); return project(data); },
  async unitPage(projectId: string, cursor: string | null = null): Promise<Page<UnitRecord>> { const offset=cursor?Number(cursor):0;if(!Number.isSafeInteger(offset)||offset<0)throw new Error("Cursor inválido.");const {data,error}=await connectClient().from("units").select("*").eq("project_id",projectId).order("code").range(offset,offset+200);fail(error);const rows=(data??[]).map(unit);return {data:rows.slice(0,200),meta:{nextCursor:rows.length>200?String(offset+200):null}}; },
  async units(projectId: string) { const all:UnitRecord[]=[];let cursor:string|null=null;do{const page=await this.unitPage(projectId,cursor);all.push(...page.data);cursor=page.meta.nextCursor;}while(cursor);return all; },
  async createUnit(projectId: string, value: UnitCreate) { const { data, error } = await connectClient().rpc("connect_create_unit", { p_project_id: projectId, p_data: value }); fail(error); return unit(data); },
  async updateUnit(id: string, value: UnitUpdate) { const { expectedVersion, ...changes } = value; const { data, error } = await connectClient().rpc("connect_update_unit", { p_id: id, p_expected_version: expectedVersion, p_data: changes }); fail(error); return unit(data); },
  async deleteUnit(id: string, version: number) { const { error } = await connectClient().rpc("connect_delete_unit", { p_id: id, p_expected_version: version }); fail(error); },
  async previewImport(projectId: string, rows: InventoryCsvRow[]) { const { data, error } = await connectClient().rpc("connect_preview_inventory", { p_project_id: projectId, p_rows: rows }); fail(error); return data as { hash: string; totalRows: number; lines: { row: number; code: string; classification: "new" | "changed" | "unchanged" | "conflict" }[] }; },
  async confirmImport(projectId: string, rows: InventoryCsvRow[], hash: string, operationId: string) { const { data, error } = await connectClient().rpc("connect_confirm_inventory", { p_project_id: projectId, p_rows: rows, p_expected_hash: hash, p_operation_id: operationId }); fail(error); return data as { inserted_rows: number; updated_rows: number; unchanged_rows: number }; },
  async importResult(importId: string) { const { data, error } = await connectClient().from("inventory_imports").select("id,project_id,status,file_hash,total_rows,valid_rows,invalid_rows,inserted_rows,updated_rows,unchanged_rows,created_at,confirmed_at").eq("id", importId).maybeSingle(); fail(error); return data; },
  async audit(organizationId: string, projectId: string, unitIds: string[]) { const { data, error } = await connectClient().from("audit_events").select("id,action,created_at,detail").eq("organization_id", organizationId).in("subject_id", [projectId,...unitIds]).order("created_at", { ascending: false }).limit(50); fail(error); return data ?? []; },
};
