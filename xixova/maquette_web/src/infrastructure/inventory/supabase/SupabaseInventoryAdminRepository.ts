import type {PostgrestError,SupabaseClient} from '@supabase/supabase-js';
import {
  InventoryError,type AdminHistoryQuery,type AdminPropertyUnit,type AdminUnitQuery,
  type ChangeUnitStatusCommand,type InventoryAdminRepository,type OrganizationRole,
  type OrganizationSummary,type PaginatedAdminUnits,type ProjectAdminSummary,type ProjectSummary,
  type SetUnitPublishedCommand,type UnitAuditEntry,type UpdateUnitPriceCommand,
} from '../../../domain/inventory';

type AdminUnitRow=Record<string,any>;
const errorMessages:Record<string,string>={
  not_found:'A unidade não foi encontrada.',forbidden:'Você não tem permissão para realizar esta ação.',
  inactive_user:'Seu acesso ao portal está inativo.',version_conflict:'Esta unidade foi alterada por outro usuário.',
  status_conflict:'O status da unidade foi alterado.',invalid_transition:'Esta mudança de status não é permitida.',
  invalid_input:'Revise os dados informados.',
};

function mapAdminUnit(row:AdminUnitRow):AdminPropertyUnit{
  const floor=Array.isArray(row.floors)?row.floors[0]:row.floors;
  const unitType=Array.isArray(row.unit_types)?row.unit_types[0]:row.unit_types;
  const project=Array.isArray(row.projects)?row.projects[0]:row.projects;
  return {
    id:row.id,organizationId:row.organization_id??project?.organization_id,projectId:row.project_id,
    buildingId:row.building_id,floorId:row.floor_id,unitTypeId:row.unit_type_id,code:row.code,
    floor:Number(row.floor??floor?.number),unitTypeName:row.unit_type_name??unitType?.name,status:row.status,
    bedrooms:Number(row.bedrooms??unitType?.bedrooms),suites:Number(row.suites??unitType?.suites),
    parkingSpaces:Number(row.parking_spaces),privateAreaM2:Number(row.private_area_m2??unitType?.private_area_m2),
    totalAreaM2:row.total_area_m2==null&&unitType?.total_area_m2==null?undefined:Number(row.total_area_m2??unitType?.total_area_m2),
    orientation:row.orientation,viewType:row.view_type??undefined,sunExposure:row.sun_exposure??undefined,
    priceBRL:row.price_brl==null?undefined:Number(row.price_brl),modelObjectId:row.model_object_id,
    interiorProjectId:row.interior_project_id??unitType?.interior_project_id??undefined,published:Boolean(row.published),
    reservedBy:row.reserved_by??undefined,reservedAt:row.reserved_at??undefined,reservedUntil:row.reserved_until??undefined,
    version:Number(row.version),updatedAt:row.updated_at,
  };
}

function adminError(error:unknown,fallback:string):InventoryError{
  if(error instanceof InventoryError)return error;
  const candidate=error as Partial<PostgrestError>&{cause?:unknown};
  let code:string|undefined;
  if(candidate.details){try{code=JSON.parse(candidate.details).code;}catch{/* resposta não estruturada */}}
  if(code&&errorMessages[code])return new InventoryError(code as any,errorMessages[code],{cause:error});
  const message=String(candidate.message??'');
  if(error instanceof TypeError||/fetch|network|connection|socket/i.test(message))return new InventoryError('network','Não foi possível confirmar a operação pela rede.',{cause:error});
  return new InventoryError('network',fallback,{cause:error});
}

export class SupabaseInventoryAdminRepository implements InventoryAdminRepository{
  constructor(private readonly client:SupabaseClient){}

  async getCurrentProfile(){
    try{
      const [{data:profile,error:profileError},{data:platform,error:platformError}]=await Promise.all([
        this.client.from('profiles').select('active').single(),
        this.client.from('platform_admins').select('user_id').maybeSingle(),
      ]);
      if(profileError)throw profileError;if(platformError)throw platformError;
      return {active:Boolean(profile?.active),isPlatformAdmin:Boolean(platform)};
    }catch(error){throw adminError(error,'Não foi possível validar seu acesso.');}
  }

  async listOrganizations():Promise<OrganizationSummary[]>{
    try{
      const profile=await this.getCurrentProfile();
      if(!profile.active)throw new InventoryError('inactive_user',errorMessages.inactive_user);
      const [{data:organizations,error:orgError},{data:memberships,error:memberError}]=await Promise.all([
        this.client.from('organizations').select('id,name,slug').order('name'),
        this.client.from('organization_members').select('organization_id,role').eq('active',true),
      ]);
      if(orgError)throw orgError;if(memberError)throw memberError;
      const roles=new Map((memberships??[]).map(item=>[item.organization_id,item.role as OrganizationRole]));
      return (organizations??[]).map(org=>({id:org.id,name:org.name,slug:org.slug,role:profile.isPlatformAdmin?'platform_admin':roles.get(org.id)!}));
    }catch(error){throw adminError(error,'Não foi possível carregar as organizações.');}
  }

  async listProjects(organizationId:string):Promise<ProjectSummary[]>{
    try{const {data,error}=await this.client.from('projects').select('id,organization_id,name,slug,status').eq('organization_id',organizationId).neq('status','archived').order('name');if(error)throw error;return (data??[]).map(row=>({id:row.id,organizationId:row.organization_id,name:row.name,slug:row.slug,status:row.status}));}
    catch(error){throw adminError(error,'Não foi possível carregar os projetos.');}
  }

  async getProjectSummary(projectId:string):Promise<ProjectAdminSummary>{
    try{const {data,error}=await this.client.rpc('admin_get_project_summary',{p_project_id:projectId});if(error)throw error;const row=(data as any[])?.[0];if(!row)throw new InventoryError('not_found','O projeto não foi encontrado.');return {projectId:row.project_id,total:Number(row.total),available:Number(row.available),reserved:Number(row.reserved),sold:Number(row.sold),hidden:Number(row.hidden),recentlyUpdated:Number(row.recently_updated)};}
    catch(error){throw adminError(error,'Não foi possível carregar o resumo.');}
  }

  async listUnits(query:AdminUnitQuery):Promise<PaginatedAdminUnits>{
    if(!Number.isInteger(query.page)||query.page<1||!Number.isInteger(query.pageSize)||query.pageSize<1||query.pageSize>100)throw new InventoryError('invalid_input','A paginação informada é inválida.');
    try{
      const {data,error}=await this.client.rpc('admin_list_units',{
        p_organization_id:query.organizationId??null,p_project_id:query.projectId??null,p_building_id:query.buildingId??null,
        p_page:query.page,p_page_size:query.pageSize,p_search:query.search?.trim()||null,p_floor:query.floor??null,
        p_status:query.status??null,p_bedrooms:query.bedrooms??null,p_orientation:query.orientation??null,
        p_published:query.published??null,p_sort_by:query.sortBy??'floor',p_sort_direction:query.sortDirection??'asc',
      });
      if(error)throw error;const rows=(data??[]) as AdminUnitRow[];
      return {items:rows.map(mapAdminUnit),total:Number(rows[0]?.total_count??0),page:query.page,pageSize:query.pageSize};
    }catch(error){throw adminError(error,'Não foi possível carregar o inventário.');}
  }

  async getUnit(unitId:string):Promise<AdminPropertyUnit|null>{
    try{const {data,error}=await this.client.from('units').select('*,floors!inner(number),unit_types!inner(name,bedrooms,suites,private_area_m2,total_area_m2,interior_project_id),projects!inner(organization_id)').eq('id',unitId).maybeSingle();if(error)throw error;return data?mapAdminUnit(data):null;}
    catch(error){throw adminError(error,'Não foi possível carregar a unidade.');}
  }

  async getUnitHistory(query:AdminHistoryQuery):Promise<UnitAuditEntry[]>{
    try{const {data,error}=await this.client.rpc('admin_get_unit_history',{p_unit_id:query.unitId??null,p_project_id:query.projectId??null,p_action:query.action??null,p_created_from:query.createdFrom??null,p_created_to:query.createdTo??null});if(error)throw error;return ((data??[]) as any[]).map(row=>({id:row.id,organizationId:row.organization_id,projectId:row.project_id,unitId:row.unit_id,unitCode:row.unit_code,action:row.action,oldValues:row.old_values,newValues:row.new_values,reason:row.reason??undefined,performedBy:row.performed_by,createdAt:row.created_at}));}
    catch(error){throw adminError(error,'Não foi possível carregar o histórico.');}
  }

  async updateUnitPrice(command:UpdateUnitPriceCommand){return this.mutate('admin_update_unit_price',{p_unit_id:command.unitId,p_expected_version:command.expectedVersion,p_new_price:command.newPrice});}
  async changeUnitStatus(command:ChangeUnitStatusCommand){return this.mutate('admin_change_unit_status',{p_unit_id:command.unitId,p_expected_version:command.expectedVersion,p_expected_status:command.expectedStatus,p_new_status:command.newStatus,p_reason:command.reason});}
  async setUnitPublished(command:SetUnitPublishedCommand){return this.mutate('admin_set_unit_published',{p_unit_id:command.unitId,p_expected_version:command.expectedVersion,p_published:command.published});}
  private async mutate(name:string,args:Record<string,unknown>):Promise<AdminPropertyUnit>{
    try{const {data,error}=await this.client.rpc(name,args);if(error)throw error;return mapAdminUnit(data as AdminUnitRow);}
    catch(error){throw adminError(error,'Não foi possível confirmar a alteração.');}
  }
}

export {adminError,mapAdminUnit};
