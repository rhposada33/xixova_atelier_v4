import {createHash,randomUUID} from 'node:crypto';
import {openMail,sealMail} from '../supabase/functions/_shared/mail-crypto.mjs';
export const backoff=(attempt,random=Math.random)=>Math.min(3600,Math.ceil(5*2**Math.min(attempt-1,9)*(0.75+random()*0.5)));
export function rpcClient(url,token){
 if(!url||!token)throw Error('worker_credentials_missing');
 return async(name,args={})=>{const r=await fetch(`${url}/rpc/${name}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(4000)});
 if(!r.ok)throw Error('mail_database_unavailable');return r.json();};
}
export function authLinkFactory({url,serviceKey,origin,publicUrl,authPath="/auth/v1",verifyPath="/auth/v1/verify"}){
 if(!url||!serviceKey||!origin||!publicUrl)throw Error('auth_configuration_missing');
 return async email=>{
  let lastStatus;
  for(const type of ['invite','magiclink']){
   const r=await fetch(`${url}${authPath}/admin/generate_link`,{method:'POST',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify({type,email,redirect_to:origin+'/invite'}),signal:AbortSignal.timeout(4000)});
   lastStatus=r.status;
   if(r.ok){const data=await r.json();const link=data.action_link??data.properties?.action_link;
    if(link){const target=new URL(link);if(target.origin!==publicUrl||target.pathname!==verifyPath)throw Object.assign(Error('invalid_auth_origin'),{code:'auth_origin_mismatch'});return link;}}
  }
  throw Object.assign(Error('auth_unavailable'),{code:'auth_http_'+lastStatus});
 };
}
export function invitationText(payload,origin){
 return `Você recebeu um convite para acessar um empreendimento no Promoven Connect.\n1. Ative ou acesse sua conta pelo link seguro:\n${payload.authLink}\n\n2. Depois abra o convite e complete seu perfil profissional:\n${origin}/invite#invite=${payload.token}\n\nO convite expira em 48 horas após sua criação. Se estiver vencido, solicite um novo à incorporadora.\n`;
}
export function mailWorker({rpc,transport,privateKeys,publicKey,keyId,origin,publicAuthUrl,generateAuthLink,verifyPath="/auth/v1/verify",workerId=randomUUID(),maxAttempts=5,logger=console.log}){
 if(!privateKeys?.[keyId]||!publicKey||!origin||!publicAuthUrl)throw Error('worker_keys_missing');
 const log=(event,id,code)=>logger(JSON.stringify({event,...(id?{messageId:id}:{}),...(code?{code}:{})}));
 const finish=(job,outcome,code=null,provider=null)=>rpc('connect_mail_finish',{p_id:job.id,p_lease:job.lease_id,p_outcome:outcome,p_code:code,p_provider:provider,p_delay:backoff(job.attempts)});
 async function reconcile(job){
  try{const receipt=await transport.reconcile(job.id);await finish(job,receipt.found?'sent':'failed',receipt.found?null:'confirmation_unknown',receipt.found?receipt.providerId:null);log('mail.reconciled',job.id,receipt.found?'accepted':'confirmation_unknown');}
  catch{log('mail.reconcile_unavailable',job.id); /* retain processing+dispatch marker; next lease owner reconciles, never blindly resends */}
 }
 return {
 async tick(){
  const job=await rpc('connect_mail_claim',{p_worker:workerId,p_lease_seconds:30,p_max_attempts:maxAttempts});if(!job)return false;
  log('mail.claimed',job.id);
  if(job.dispatch_at){await reconcile(job);return true;}
  let payload;
  try{payload=await openMail(job.payload,job.id,privateKeys);if(createHash('sha256').update(payload.token).digest('hex')!==job.token_hash)throw Error();}
  catch{await finish(job,'failed','crypto_invalid');log('mail.failed',job.id,'crypto_invalid');return true;}
  if(!payload.authLink||!payload.authLinkAt||Date.now()-payload.authLinkAt>50*60*1000){
   try{payload.authLink=await generateAuthLink(job.recipient);payload.authLinkAt=Date.now();const encrypted=await sealMail(payload,job.id,keyId,publicKey);
    if(!await rpc('connect_mail_prepare',{p_id:job.id,p_lease:job.lease_id,p_payload:encrypted}))return true;
   }catch{await finish(job,'retry','auth_unavailable');log('mail.retry',job.id,'auth_unavailable');return true;}
  }
  try{const u=new URL(payload.authLink);if(u.origin!==publicAuthUrl||u.pathname!==verifyPath)throw Error();}
  catch{await finish(job,'failed','crypto_invalid');return true;}
  if(!await rpc('connect_mail_dispatch',{p_id:job.id,p_lease:job.lease_id}))return true;
  let result;
  try{result=await transport.send({id:job.id,recipient:job.recipient,text:invitationText(payload,origin)});}
  catch(e){
   if(e.kind==='temporary'){await finish(job,'retry','smtp_temporary');log('mail.retry',job.id,'smtp_temporary');}
   else if(e.kind==='permanent'){await finish(job,'failed','smtp_permanent');log('mail.failed',job.id,'smtp_permanent');}
   else await reconcile(job);
   return true;
  }
  // DB confirmation can fail AFTER SMTP accepted. Keep marker/lease; recovery reconciles it.
  await finish(job,'sent',null,result.providerId);log('mail.smtp_accepted',job.id);return true;
 },
 metrics:()=>rpc('connect_mail_metrics'),close:()=>transport.close(),
 };
}
