import type { SupabaseClient } from "@supabase/supabase-js";
import { InventoryError, type InventoryErrorCode } from "../../domain/inventory";
import type { ImportDryRun, ImportResult, InventoryImportMode, InventoryImportRepository, NormalizedImportRow } from "../../domain/imports";

const map=(r:any):ImportResult=>({id:r.id,status:r.status,mode:r.mode,projectId:r.project_id,createdAt:r.created_at,expiresAt:r.expires_at,completedAt:r.completed_at??undefined,rowCount:r.row_count,newCount:r.new_count,updateCount:r.update_count,unchangedCount:r.unchanged_count,warningCount:r.warning_count,errorCount:r.error_count});
const fail=(e:any):never=>{let code="invalid_input";try{code=JSON.parse(e?.details??"{}").code??code}catch{}throw new InventoryError(code as InventoryErrorCode,code==="version_conflict"?"Os dados mudaram após a validação. Execute um novo dry-run.":code==="import_expired"?"A validação expirou. Execute um novo dry-run.":"Não foi possível processar a importação.")};

export class SupabaseInventoryImportRepository implements InventoryImportRepository {
  constructor(private client:SupabaseClient){}
  private async rpc(name:string,params:any){const{data,error}=await this.client.rpc(name,params);if(error)fail(error);return data}
  async preview(projectId:string,mode:InventoryImportMode,rows:NormalizedImportRow[],bytes:number,operationId:string){const r=await this.rpc("admin_preview_inventory_import",{p_project_id:projectId,p_mode:mode,p_rows:rows,p_operation_id:operationId,p_payload_bytes:bytes});const{data:issues}=await this.client.from("inventory_import_errors").select("*").eq("import_id",r.id).order("row_number");return{...map(r),projectId:r.project_id,mode:r.mode,operationId:r.operation_id,payloadHash:r.payload_hash,expiresAt:r.expires_at,rows,issues:(issues??[]).map((x:any)=>({row:x.row_number,column:x.column_name??undefined,code:x.code,message:x.message,severity:x.severity,maskedValue:x.masked_value??undefined}))}as ImportDryRun}
  async get(id:string){const result=await this.rpc("admin_get_inventory_import",{p_import_id:id});const mapped=map(Array.isArray(result)?result[0]:result);const{data}=await this.client.from("inventory_import_errors").select("*").eq("import_id",id).order("row_number");return{...mapped,issues:(data??[]).map((x:any)=>({row:x.row_number,column:x.column_name??undefined,code:x.code,message:x.message,severity:x.severity,maskedValue:x.masked_value??undefined}))}}
  async confirm(dryRun:ImportDryRun){return map(await this.rpc("admin_confirm_inventory_import",{p_import_id:dryRun.id,p_operation_id:dryRun.operationId,p_rows:dryRun.rows,p_expected_hash:dryRun.payloadHash}))}
  async list(projectId:string){return((await this.rpc("admin_list_inventory_imports",{p_project_id:projectId}))??[]).map(map)}
}
