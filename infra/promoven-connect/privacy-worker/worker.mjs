import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function ledger(folder,action,entry){
 const result=spawnSync('python3',[fileURLToPath(new URL('./ledger.py',import.meta.url))],{input:JSON.stringify({folder,action,entry}),encoding:'utf8'});
 if(result.status!==0)throw Error('suppression_ledger_unavailable');return JSON.parse(result.stdout);
}
export function storageAdapter({url,key,directRestore=false}){
 if(new URL(url).hostname!=='127.0.0.1'&&!(directRestore&&/^connect-recovery-[0-9]+-storage$/.test(new URL(url).hostname)))throw Error('local_storage_required');
 const prefix=directRestore?'':'/storage/v1';
 return {async remove(r){
  if(r.bucket!=='connect-privacy-private'||! /^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(r.path))throw Error('resource_not_owned');
  const result=await fetch(`${url}${prefix}/object/${r.bucket}`,{method:'DELETE',headers:{authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[r.path]}),signal:AbortSignal.timeout(4000)});
  if(!result.ok)throw Error('storage_delete_unconfirmed');
  const check=await fetch(`${url}${prefix}/object/authenticated/${r.bucket}/${r.path}`,{headers:{authorization:`Bearer ${key}`},signal:AbortSignal.timeout(4000)});
  // Storage returns 400 with a 404 statusCode for missing objects. A transport/permission error is not proof.
  if(check.status===404)return;
  if(check.status===400){const data=await check.json();if(String(data.statusCode)==='404'&&data.error==='not_found')return;}
  throw Error('storage_absence_unconfirmed');
 }};
}
export async function runCase({db,request,actor,folder,storage,logger=()=>{},afterLedger=()=>{},beforeFinish=()=>{},journal=ledger}){
 const entries=journal(folder,'list');const prior=entries.find(x=>x.id===request);
 // Opaque ID lookup, permitted worker function supplies no buyer content.
 const identity=(await db.query('select public.connect_privacy_work_item($1) as item',[request])).rows[0].item;
 if(!identity)throw Error('restore_case_missing_manual_review');
 if(identity.completed){if(!prior)throw Error('suppression_ledger_missing');journal(folder,'confirm',prior);for(const resource of prior.resources)await storage.remove(resource);return {idempotent:true};}
 const lead=identity.leadId;
 await db.query('select pg_advisory_lock(hashtextextended($1,31))',[lead]);
 try{
  const prepared=(await db.query('select public.connect_privacy_prepare($1,$2) as item',[request,actor])).rows[0].item;
  if(prepared.completed)return {idempotent:true};
  const {completed,...entry}=prepared;void completed;
  if(prior&&JSON.stringify(prior)!==JSON.stringify(JSON.parse(JSON.stringify(entry)))){
   // Object key order is irrelevant; journal append performs canonical structural validation below.
   if(prior.leadId!==entry.leadId||prior.contactHash!==entry.contactHash||prior.organizationId!==entry.organizationId)throw Error('restore_subject_mismatch');
  }
  journal(folder,'append',entry);await afterLedger();
  const removed=[];
  for(const resource of entry.resources){await storage.remove(resource);removed.push(resource.id);}
  await beforeFinish();
  const result=(await db.query('select public.connect_privacy_finish($1,$2,$1,$3::uuid[]) as result',[request,actor,removed])).rows[0].result;
  journal(folder,'confirm',entry);
  logger(JSON.stringify({event:'privacy.completed',operation:request}));return result;
 }finally{await db.query('select pg_advisory_unlock(hashtextextended($1,31))',[lead]);}
}
