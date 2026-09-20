export const adminActionLabels: Record<string,string> = {
  'membership.bootstrap':'Acesso inicial concedido',
  'organization.created':'Organização criada',
  'organization.updated':'Organização atualizada',
  'organization.active':'Organização ativada',
  'organization.suspended':'Organização suspensa',
  'organization.archived':'Organização arquivada',
  'organization.status_changed':'Estado da organização alterado',
  'invitation.created':'Convite criado',
  'invitation.sent':'Convite enviado',
  'invitation.delivery_failed':'Falha na entrega do convite',
  'invitation.accepted':'Convite aceito',
  'invitation.resent':'Convite reenviado',
  'invitation.revoked':'Convite revogado',
  'membership.created':'Acesso criado',
  'membership.activated':'Acesso ativado',
  'membership.role_changed':'Perfil alterado',
  'membership.suspended':'Acesso suspenso',
  'membership.removed':'Acesso retirado',
  'project.created':'Projeto criado',
  'project.updated':'Projeto atualizado',
  'project.status_changed':'Estado do projeto alterado',
  'project.archived':'Projeto arquivado',
  'project.capabilities_updated':'Exposição do projeto alterada',
  'building.created':'Torre criada',
  'building.updated':'Torre atualizada',
  'floor.created':'Pavimento criado',
  'floor.updated':'Pavimento atualizado',
  'floor.batch_created':'Pavimentos criados',
  'unit_type.created':'Tipologia criada',
  'unit_type.updated':'Tipologia atualizada',
  'inventory_import.validated':'Importação validada',
  'inventory_import.completed':'Importação concluída',
};
export const resourceLabels: Record<string,string>={organization:'Organização',membership:'Membro',invitation:'Convite',project:'Projeto',building:'Torre',floor:'Pavimento',unit_type:'Tipologia',unit:'Unidade'};
export const visibleAuditFieldLabels:Record<string,string>={
  name:'Nome',slug:'Identificador comercial',status:'Estado',role:'Perfil',active:'Ativo',
  code:'Código',label:'Nome',version:'Versão',country:'País',state:'Estado',city:'Cidade',
  timezone:'Fuso horário',default_currency:'Moeda',currency:'Moeda',
  public_inventory_enabled:'Inventário público',visual_experience_enabled:'Experiência 3D',
  number:'Número',private_area_m2:'Área privativa',total_area_m2:'Área total',
  bedrooms:'Dormitórios',suites:'Suítes',bathrooms:'Banheiros',parking_spaces:'Vagas',
  count:'Quantidade',start:'Início',end:'Fim',rows:'Linhas',new:'Novas',
  updated:'Atualizadas',unchanged:'Sem alterações',affected_units:'Unidades afetadas',
  error_code:'Código de entrega',
};
const emailPattern=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;
const presentableValues:Record<string,string>={organization_admin:'Administrador',seller:'Vendedor',viewer:'Consulta',
  draft:'Em preparação',active:'Ativa',suspended:'Suspensa',archived:'Arquivada',
  pending_delivery:'Aguardando entrega',sent:'Enviado',accepted:'Aceito',delivery_failed:'Falha na entrega',revoked:'Revogado',expired:'Expirado',
  ready:'Pronto',published:'Publicado',available:'Disponível',reserved:'Reservada',sold:'Vendida'};
export const redactAuditText=(value:string)=>value.replace(emailPattern,'[redigido]');
export function visibleAuditValues(input:unknown):Array<{label:string;value:string}>{
  if(!input||typeof input!=='object'||Array.isArray(input))return [];
  return Object.entries(input as Record<string,unknown>).flatMap(([key,value])=>{
    if(!Object.hasOwn(visibleAuditFieldLabels,key)||value===null||!['string','number','boolean'].includes(typeof value))return [];
    const translated=(key==='status'||key==='role')?(presentableValues[String(value)]??String(value)):String(value);
    const shown=typeof value==='boolean'?(value?'Sim':'Não'):redactAuditText(translated);
    return [{label:visibleAuditFieldLabels[key],value:shown}];
  });
}
export function adminActionLabel(code:string){return adminActionLabels[code]??'Atividade administrativa';}
export function parseBrazilianDate(value:string,endOfDay=false):string|undefined{
  if(!value.trim())return undefined;
  const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if(!match)throw new Error('Informe a data no formato dd/mm/aaaa.');
  const [,day,month,year]=match;
  const check=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  if(check.getUTCFullYear()!==Number(year)||check.getUTCMonth()!==Number(month)-1||check.getUTCDate()!==Number(day))throw new Error('Data inválida.');
  const date=new Date(`${year}-${month}-${day}T${endOfDay?'23:59:59.999':'00:00:00.000'}-03:00`);
  return date.toISOString();
}
export interface AdminAuditEntry{id:string;organizationId:string;organizationName:string;projectId?:string;projectName?:string;action:string;resourceType:string;resourceName:string;actorId:string;actorName:string;createdAt:string;oldValues:Record<string,unknown>;newValues:Record<string,unknown>;reason?:string;}
export interface AdminAuditQuery{organizationId?:string;projectId?:string;action?:string;resourceType?:string;actorId?:string;dateFrom?:string;dateTo?:string;page:number;pageSize:number;}
export interface AdminAuditPage{items:AdminAuditEntry[];total:number;page:number;pageSize:number;}
