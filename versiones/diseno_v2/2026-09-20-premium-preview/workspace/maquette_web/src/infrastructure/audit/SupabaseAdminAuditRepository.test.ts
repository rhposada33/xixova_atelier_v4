import {describe,expect,it,vi} from 'vitest';
import {SupabaseAdminAuditRepository} from './SupabaseAdminAuditRepository';
const row={id:'event',organization_id:'org',organization_name:'Cliente',project_id:null,project_name:null,action:'invitation.created',resource_type:'invitation',resource_name:'Registro administrativo',actor_id:'actor',actor_name:'Responsável',created_at:'2026-09-15T00:00:00Z',old_values:{},new_values:{role:'viewer'},reason:null,total_count:2};
describe('SupabaseAdminAuditRepository',()=>{
  it('consulta paginação e filtros no servidor',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[row],error:null});
    const repo=new SupabaseAdminAuditRepository({rpc} as any);
    const result=await repo.list({organizationId:'org',action:'invitation.created',page:2,pageSize:25});
    expect(rpc).toHaveBeenCalledWith('admin_list_audit_logs',expect.objectContaining({p_organization_id:'org',p_action:'invitation.created',p_page:2,p_page_size:25}));
    expect(result).toMatchObject({total:2,page:2,items:[{action:'invitation.created'}]});
  });
  it('não expõe mensagens SQL e valida limites',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:null,error:{message:'internal SQL'}});
    const repo=new SupabaseAdminAuditRepository({rpc} as any);
    await expect(repo.list({page:1,pageSize:25})).rejects.toThrow('Não foi possível carregar');
    await expect(repo.list({page:0,pageSize:25})).rejects.toThrow('Paginação inválida');
  });
});
