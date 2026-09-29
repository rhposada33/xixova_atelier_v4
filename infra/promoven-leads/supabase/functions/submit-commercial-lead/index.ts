import {createClient} from 'npm:@supabase/supabase-js@2.109.0';

type Lead={name:string;company:string;role:string;whatsapp:string;email:string;cityState:string;unitsRange:string;launchWindow:string;model3dStatus:string;message:string;consent:boolean};
const roles=['','Diretor(a)','Gerente comercial','Marketing','Vendas','Produto / Tecnologia','Arquiteto(a)','Outro'];
const units=['Até 30','31 a 80','81 a 150','151 a 300','Mais de 300','Ainda não definido'];
const launches=['Até 3 meses','De 3 a 6 meses','De 6 a 12 meses','Mais de 12 meses','Empreendimento já lançado','Ainda não definido'];
const models=['Sim, pronto para uso','Sim, mas precisa ser avaliado','Ainda não','Não sei informar'];
const encoder=new TextEncoder();
async function readLimitedJson(request:Request):Promise<unknown>{
  const reader=request.body?.getReader();if(!reader)return null;
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>12000){await reader.cancel();return null}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return JSON.parse(new TextDecoder().decode(bytes));
}

function json(status:number,body:Record<string,string>,origin:string|null){
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'http://127.0.0.1:5173').split(',').map(value=>value.trim());
  const headers:Record<string,string>={'Content-Type':'application/json','Vary':'Origin','Cache-Control':'no-store'};
  if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
  return new Response(JSON.stringify(body),{status,headers});
}
function validLead(value:unknown):Lead|null{
  if(!value||typeof value!=='object')return null;
  const raw=value as Record<string,unknown>;
  for(const key of ['name','company','role','whatsapp','email','cityState','unitsRange','launchWindow','model3dStatus','message'])if(typeof raw[key]!=='string')return null;
  const lead={...raw} as Lead;
  lead.name=lead.name.trim();lead.company=lead.company.trim();lead.cityState=lead.cityState.trim();lead.email=lead.email.trim().toLowerCase();lead.message=lead.message.trim();
  const digits=lead.whatsapp.replace(/\D/g,'');lead.whatsapp=digits?(digits.startsWith('55')?`+${digits}`:`+55${digits}`):'';
  if(!lead.name||lead.name.length>120||!lead.company||lead.company.length>120||!lead.cityState||lead.cityState.length>120||lead.message.length>1000||lead.email.length>254)return null;
  if(!roles.includes(lead.role)||!units.includes(lead.unitsRange)||!launches.includes(lead.launchWindow)||!models.includes(lead.model3dStatus))return null;
  if(lead.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email))return null;
  if(lead.whatsapp&&!/^\+[1-9][0-9]{9,14}$/.test(lead.whatsapp))return null;
  if(!lead.email&&!lead.whatsapp||lead.consent!==true)return null;
  return lead;
}
async function hash(secret:string,value:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
  return `\\x${Array.from(bytes).map(byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}
Deno.serve(async request=>{
  const origin=request.headers.get('Origin');
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'http://127.0.0.1:5173').split(',').map(value=>value.trim());
  if(origin&&!allowed.includes(origin))return json(403,{code:'forbidden'},origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin??'', 'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type,x-idempotency-key','Vary':'Origin'}});
  if(request.method!=='POST')return json(405,{code:'method_not_allowed'},origin);
  const secret=Deno.env.get('LEAD_HMAC_SECRET'),url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),version=Deno.env.get('PRIVACY_POLICY_VERSION');
  if(!secret||secret.length<32||!url||!key||!version)return json(503,{code:'unavailable'},origin);
  const idempotency=request.headers.get('X-Idempotency-Key');
  if(!idempotency||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotency)||!request.headers.get('Content-Type')?.startsWith('application/json'))return json(400,{code:'invalid_request'},origin);
  let body:unknown;
  try{body=await readLimitedJson(request)}catch{return json(400,{code:'invalid_request'},origin)}
  if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{code:'invalid_request'},origin);
  const payload=body as Record<string,unknown>;
  const lead=validLead(payload.data),pagePath=payload.pagePath;
  if(!lead||pagePath!=='/')return json(400,{code:'invalid_request'},origin);
  const utm=(key:string)=>typeof payload[key]==='string'?(payload[key] as string).trim().slice(0,200):'';
  const now=new Date().toISOString();
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const contact=lead.email||lead.whatsapp;
  const args={
    p_idempotency_hash:await hash(secret,`id:${idempotency}`),
    p_payload_hash:await hash(secret,`payload:${JSON.stringify(lead)}`),
    p_rate_limit_hash:await hash(secret,`contact:${contact}`),
    p_name:lead.name,p_company:lead.company,p_role:lead.role,p_whatsapp_e164:lead.whatsapp,p_email:lead.email,p_city_state:lead.cityState,
    p_units_range:lead.unitsRange,p_launch_window:lead.launchWindow,p_model_3d_status:lead.model3dStatus,p_message:lead.message,
    p_source:'website',p_page_path:pagePath,p_utm_source:utm('utm_source'),p_utm_medium:utm('utm_medium'),p_utm_campaign:utm('utm_campaign'),
    p_privacy_policy_version:version,p_privacy_notice_accepted_at:now,p_consent_at:now,
  };
  try{
    const {data,error}=await client.rpc('accept_commercial_lead',args);
    if(error){console.error('lead_rpc_failure');return json(503,{code:'unavailable'},origin)}
    if(data==='accepted')return json(202,{code:'accepted'},origin);
    if(data==='rate_limited')return json(429,{code:'rate_limited'},origin);
    if(data==='idempotency_conflict')return json(409,{code:'invalid_request'},origin);
    return json(503,{code:'unavailable'},origin);
  }catch{console.error('lead_rpc_failure');return json(503,{code:'unavailable'},origin)}
});
