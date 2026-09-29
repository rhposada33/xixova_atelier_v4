import {createClient} from 'npm:@supabase/supabase-js@2.109.0';

type Notification={lead_id:string;name:string;company:string;role:string|null;whatsapp_e164:string|null;email:string|null;city_state:string;units_range:string;launch_window:string;model_3d_status:string;message:string|null};
Deno.serve(async request=>{
  if(request.method!=='POST')return new Response(null,{status:405});
  const jobSecret=Deno.env.get('NOTIFICATION_JOB_SECRET');
  if(!jobSecret||request.headers.get('Authorization')!==`Bearer ${jobSecret}`)return new Response(null,{status:401});
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('RESEND_FROM'),to=Deno.env.get('COMMERCIAL_TO');
  if(!url||!key||!resendKey||!from||!to)return Response.json({code:'unavailable'},{status:503});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.rpc('claim_commercial_notifications',{p_limit:10});
  if(error){console.error('notification_claim_failure');return Response.json({code:'unavailable'},{status:503})}
  let sent=0,failed=0;
  for(const lead of data as Notification[]){
    const text=[`Novo contato Promoven`, `Nome: ${lead.name}`,`Empresa: ${lead.company}`,`Cargo: ${lead.role??'-'}`,`Email: ${lead.email??'-'}`,`WhatsApp: ${lead.whatsapp_e164??'-'}`,`Cidade: ${lead.city_state}`,`Unidades: ${lead.units_range}`,`Lançamento: ${lead.launch_window}`,`Modelo 3D: ${lead.model_3d_status}`,`Mensagem: ${lead.message??'-'}`].join('\n');
    let delivered=false;
    try{const response=await fetch(Deno.env.get('RESEND_API_URL')??'https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`promoven-lead-${lead.lead_id}`},body:JSON.stringify({from,to:[to],subject:'Novo contato Promoven',text})});delivered=response.ok}catch{/* retry by scheduled worker */}
    const {error:markError}=await client.rpc('mark_commercial_notification',{p_lead_id:lead.lead_id,p_status:delivered?'sent':'failed'});
    if(markError)console.error('notification_mark_failure');
    if(delivered)sent++;else failed++;
  }
  return Response.json({sent,failed});
});
