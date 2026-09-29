import type {SupabaseClient} from '@supabase/supabase-js';
import type {AdminAuditPage,AdminAuditQuery} from '../../domain/audit/adminAudit';
import {redactAuditText} from '../../domain/audit/adminAudit';

export class SupabaseAdminAuditRepository{
  constructor(private client:SupabaseClient){}
  async listActors(organizationId?:string,search?:string):Promise<Array<{id:string;name:string}>>{
    const {data,error}=await this.client.rpc('admin_list_audit_actors',{
      p_organization_id:organizationId??null,p_search:search??null,p_limit:50,
    });
    if(error)throw new Error('Não foi possível carregar os responsáveis.');
    return (data??[]).map((row:any)=>({id:row.actor_id,name:redactAuditText(row.actor_name??'Usuário')}));
  }
  async list(query:AdminAuditQuery):Promise<AdminAuditPage>{
    if(query.page<1||query.pageSize<1||query.pageSize>100)throw new Error('Paginação inválida.');
    const {data,error}=await this.client.rpc('admin_list_audit_logs',{
      p_organization_id:query.organizationId??null,p_project_id:query.projectId??null,
      p_action:query.action??null,p_resource_type:query.resourceType??null,p_actor_id:query.actorId??null,
      p_date_from:query.dateFrom??null,p_date_to:query.dateTo??null,
      p_page:query.page,p_page_size:query.pageSize,
    });
    if(error)throw new Error('Não foi possível carregar a atividade administrativa.');
    const rows=data??[];
    return {page:query.page,pageSize:query.pageSize,total:Number(rows[0]?.total_count??0),items:rows.map((row:any)=>({
      id:row.id,organizationId:row.organization_id,organizationName:redactAuditText(row.organization_name??'Organização'),
      projectId:row.project_id??undefined,projectName:row.project_name?redactAuditText(row.project_name):undefined,
      action:row.action,resourceType:row.resource_type,resourceName:redactAuditText(row.resource_name??'Registro administrativo'),
      actorId:row.actor_id,actorName:redactAuditText(row.actor_name??'Usuário'),createdAt:row.created_at,
      oldValues:row.old_values??{},newValues:row.new_values??{},reason:row.reason?redactAuditText(row.reason):undefined,
    }))};
  }
}
