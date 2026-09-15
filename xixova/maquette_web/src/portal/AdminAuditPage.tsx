import {useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {adminActionLabel,adminActionLabels,parseBrazilianDate,redactAuditText,resourceLabels,visibleAuditValues,type AdminAuditEntry,type AdminAuditPage} from '../domain/audit/adminAudit';
import {SupabaseAdminAuditRepository} from '../infrastructure/audit/SupabaseAdminAuditRepository';
import {getSupabaseClient} from '../infrastructure/supabase/client';
import {usePortal} from './PortalApp';

const dateTime=(value:string)=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value));
export function AdminAuditPage(){
  const {organizations,organization,projects}=usePortal();
  const repo=useMemo(()=>new SupabaseAdminAuditRepository(getSupabaseClient()),[]);
  const [params,setParams]=useSearchParams();
  const [result,setResult]=useState<AdminAuditPage>({items:[],total:0,page:1,pageSize:25});
  const [actors,setActors]=useState<Array<{id:string;name:string}>>([]),[actorSearch,setActorSearch]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[retryKey,setRetryKey]=useState(0);
  const [detail,setDetail]=useState<AdminAuditEntry|null>(null);
  useEffect(()=>{if(!detail)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setDetail(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[detail]);
  const page=Math.max(1,Number(params.get('page'))||1);
  const requestedOrg=params.get('organization');
  const currentOrg=requestedOrg==='all'?'':requestedOrg??organization?.id??'';
  const update=(key:string,value:string)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);if(key!=='page')next.delete('page');setParams(next);};
  useEffect(()=>{let alive=true;repo.listActors(currentOrg||undefined,actorSearch||undefined).then(data=>{if(alive)setActors(data)}).catch(()=>{if(alive)setActors([])});return()=>{alive=false}},[repo,currentOrg,actorSearch]);
  useEffect(()=>{
    let alive=true;setLoading(true);setError('');
    try{
      const dateFrom=parseBrazilianDate(params.get('from')??'');
      const dateTo=parseBrazilianDate(params.get('to')??'',true);
      repo.list({organizationId:currentOrg||undefined,projectId:params.get('project')||undefined,
        action:params.get('action')||undefined,resourceType:params.get('resource')||undefined,
        actorId:params.get('actor')||undefined,dateFrom,dateTo,page,pageSize:25})
        .then(data=>{if(alive)setResult(data)}).catch(()=>{if(alive)setError('Não foi possível carregar a atividade administrativa.')})
        .finally(()=>{if(alive)setLoading(false)});
    }catch(reason){setError(reason instanceof Error?reason.message:'Data inválida.');setLoading(false)}
    return()=>{alive=false};
  },[repo,currentOrg,params,page,retryKey]);
  return <section className="portal-page admin-audit-page">
    <header className="page-heading"><div><h1>Histórico</h1><p>Registro imutável de ações administrativas.</p></div></header>
    <nav className="audit-tabs" aria-label="Tipos de histórico"><Link to="/portal/history">Inventário</Link><Link to="/portal/history/admin" aria-current="page">Atividade administrativa</Link></nav>
    <div className="portal-panel audit-filters">
      <label>Organização<select aria-label="Organização" value={currentOrg||'all'} onChange={e=>update('organization',e.target.value)}><option value="all">Todas as organizações</option>{organizations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Projeto<select aria-label="Projeto" value={params.get('project')??''} onChange={e=>update('project',e.target.value)}><option value="">Todos os projetos</option>{projects.filter(item=>!currentOrg||item.organizationId===currentOrg).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Ação<select aria-label="Ação" value={params.get('action')??''} onChange={e=>update('action',e.target.value)}><option value="">Todas as ações</option>{Object.entries(adminActionLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
      <label>Tipo de recurso<select aria-label="Tipo de recurso" value={params.get('resource')??''} onChange={e=>update('resource',e.target.value)}><option value="">Todos os recursos</option>{Object.entries(resourceLabels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
      <label>Buscar responsável<input aria-label="Buscar responsável" value={actorSearch} onChange={e=>setActorSearch(e.target.value)} placeholder="Nome do responsável"/></label>
      <label>Responsável<select aria-label="Responsável" value={params.get('actor')??''} onChange={e=>update('actor',e.target.value)}><option value="">Todos os responsáveis</option>{actors.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Data inicial<input aria-label="Data inicial" inputMode="numeric" placeholder="dd/mm/aaaa" value={params.get('from')??''} onChange={e=>update('from',e.target.value)}/></label>
      <label>Data final<input aria-label="Data final" inputMode="numeric" placeholder="dd/mm/aaaa" value={params.get('to')??''} onChange={e=>update('to',e.target.value)}/></label>
    </div>
    {loading?<div className="portal-panel loading-rows" aria-live="polite"><i/><i/><i/><span className="sr-only">Carregando atividade administrativa</span></div>
      :error?<div className="portal-panel inline-error" role="alert"><p>{error}</p><button className="secondary-button" onClick={()=>setRetryKey(v=>v+1)}>Tentar novamente</button></div>
      :!result.items.length?<div className="portal-panel empty-state"><h2>Nenhuma atividade encontrada</h2><p>Não há registros para os filtros selecionados.</p></div>
      :<><div className="history-list">{result.items.map(item=><article className="portal-panel history-card" key={item.id}>
        <div><span className="status">{adminActionLabel(item.action)}</span><h2>{redactAuditText(item.resourceName)}</h2><p>{dateTime(item.createdAt)} · {redactAuditText(item.actorName)}</p></div>
        <div><p><strong>Organização:</strong> {redactAuditText(item.organizationName)}</p>{item.projectName&&<p><strong>Projeto:</strong> {redactAuditText(item.projectName)}</p>}<p><strong>Recurso:</strong> {resourceLabels[item.resourceType]??'Registro administrativo'}</p><p><strong>Resumo:</strong> {visibleAuditValues(item.newValues).slice(0,3).map(v=>`${v.label}: ${v.value}`).join(' · ')||'Ação registrada'}</p><button className="text-button" onClick={()=>setDetail(item)}>Ver detalhes</button></div>
      </article>)}</div><div className="pagination"><button disabled={page<=1} onClick={()=>update('page',String(page-1))}>Anterior</button><span>Página {page} de {Math.max(1,Math.ceil(result.total/25))}</span><button disabled={page*25>=result.total} onClick={()=>update('page',String(page+1))}>Próxima</button></div></>}
    {detail&&<div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}><section className="unit-drawer audit-detail" role="dialog" aria-modal="true" aria-label="Detalhes da atividade administrativa"><header><div><span>Atividade administrativa</span><h2>{adminActionLabel(detail.action)}</h2></div><button autoFocus aria-label="Fechar detalhes" onClick={()=>setDetail(null)}>×</button></header><p><strong>Momento:</strong> {dateTime(detail.createdAt)}</p><p><strong>Organização:</strong> {redactAuditText(detail.organizationName)}</p><p><strong>Responsável:</strong> {redactAuditText(detail.actorName)}</p><p><strong>Recurso:</strong> {resourceLabels[detail.resourceType]??'Registro administrativo'} · {redactAuditText(detail.resourceName)}</p><div className="audit-deltas"><div><h3>Antes</h3>{visibleAuditValues(detail.oldValues).map((v,i)=><p key={i}><strong>{v.label}:</strong> {v.value}</p>)}</div><div><h3>Depois</h3>{visibleAuditValues(detail.newValues).map((v,i)=><p key={i}><strong>{v.label}:</strong> {v.value}</p>)}</div></div>{detail.reason&&<p><strong>Motivo:</strong> {redactAuditText(detail.reason)}</p>}</section></div>}
  </section>;
}
