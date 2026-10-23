import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fixture} from './fixture.mjs';
import {database,environment,folder,asActor} from './local.mjs';
import {ledger,runCase,storageAdapter} from './worker.mjs';
const mode=process.argv[2],file=process.argv[3];
const db=await database();const env=environment();const key=env.SUPABASE_SERVICE_ROLE_KEY;
const storage=storageAdapter({url:'http://127.0.0.1:56321',key});
const rpc=(lead,action)=>db.query('select public.connect_privacy_plan($1,$2,$3) as result',[lead,action,'SYNTHETIC-PC3C']);
try{
 const existingKey=(await db.query("select encode(key,'hex') as key from private.privacy_key")).rows[0]?.key;
 if(existingKey)await access(folder+'/ledger.key');
 const {key:ledgerKey}=ledger(folder,'key');if(existingKey&&existingKey!==ledgerKey)throw Error('ledger_key_mismatch');
 await db.query("insert into private.privacy_key values(true,decode($1,'hex')) on conflict(singleton) do update set key=excluded.key",[ledgerKey]);
 if(mode==='--prepare'){
  const f=await fixture(db,{upload:async(path,body)=>{const r=await fetch('http://127.0.0.1:56321/storage/v1/object/connect-privacy-private/'+path,{method:'POST',headers:{authorization:`Bearer ${key}`,'Content-Type':'text/plain'},body});assert.equal(r.ok,true);}});
  const request=(await asActor(db,f.actor,()=>rpc(f.lead,'request'))).rows[0].result.requestId;
  assert.equal((await asActor(db,f.actor,()=>rpc(f.lead,'request'))).rows[0].result.requestId,request);
  await assert.rejects(asActor(db,f.other,()=>rpc(f.lead,'verify')));
  await assert.rejects(asActor(db,f.broker,()=>rpc(f.lead,'request')));
  await asActor(db,f.actor,()=>rpc(f.lead,'verify'));
  await assert.rejects(asActor(db,f.actor,()=>rpc(f.lead,'approve')));
  await asActor(db,f.reviewer,()=>rpc(f.lead,'approve'));
  // Contains only synthetic PII; private artifact, never stdout/logs.
  await writeFile(file,JSON.stringify({...f,request}),{mode:0o600});console.log('PASS synthetic privacy fixture + independent review + tenant + duplicate');
 }else if(mode==='--exercise'){
  const f=JSON.parse(await readFile(file,'utf8'));const evidence={};
  const preview=(await asActor(db,f.actor,()=>db.query('select public.connect_privacy_preview($1) as value',[f.lead]))).rows[0].value;
  assert.ok(!JSON.stringify(preview).includes(f.canary));assert.equal(preview.resourceRecords,4);evidence.preview='PASS';
  await db.query('set role connect_privacy_worker');
  // No public role can execute; worker also cannot approve its own action by picking reviewer.
  await assert.rejects(runCase({db,request:f.request,actor:f.reviewer,folder,storage}));
  let removed=0;
  const faulty={remove:async r=>{await storage.remove(r);if(++removed===1)throw Error('synthetic_partial_failure');}};
  await assert.rejects(runCase({db,request:f.request,actor:f.actor,folder,storage:faulty}));evidence.partialFailure='PASS';
  await db.query('reset role');
  assert.equal((await db.query('select count(*)::int n from public.leads where id=$1',[f.lead])).rows[0].n,1);
  const concurrent=await database();
  try{await assert.rejects(asActor(concurrent,f.actor,()=>concurrent.query("select public.connect_crm_change($1,1,'activity',jsonb_build_object('type','note_added','note','late synthetic note'))",[f.lead])),e=>e.code==='55000');}finally{await concurrent.end();}
  evidence.concurrentMutationFrozen='PASS';
  await db.query('set role connect_privacy_worker');
  const logs=[];const contender=await database();
  try{await contender.query('set role connect_privacy_worker');const results=await Promise.all([db,contender].map(connection=>runCase({db:connection,request:f.request,actor:f.actor,folder,storage,logger:v=>logs.push(v)})));assert.equal(results.filter(r=>r.idempotent).length,1);evidence.concurrentExecutors='PASS';}finally{await contender.end();}
  evidence.retry='PASS';
  assert.equal((await runCase({db,request:f.request,actor:f.actor,folder,storage})).idempotent,true);evidence.idempotency='PASS';
  await db.query('reset role');
  const absent=await db.query("select (select count(*) from public.leads where id=$1)+(select count(*) from public.lead_activities where lead_id=$1)+(select count(*) from public.lead_attributions where lead_id=$1)+(select count(*) from private.privacy_resources where lead_id=$1) as n",[f.lead]);assert.equal(Number(absent.rows[0].n),0);
  const audit=(await db.query('select detail from public.audit_events where organization_id=$1',[f.org])).rows;assert.ok(!JSON.stringify(audit).includes(f.canary));
  const mail=(await db.query('select payload,state,erased_at from private.mail_outbox where id=$1',[f.mail])).rows[0];assert.deepEqual(mail.payload,{});assert.equal(mail.state,'cancelled');assert.ok(mail.erased_at);evidence.databaseAndEncryptedMail='PASS';
  assert.equal(Number((await db.query('select removed_count from private.privacy_attribution_totals where organization_id=$1 and broker_user_id=$2',[f.org,f.broker])).rows[0].removed_count),1);
  assert.equal(Number((await db.query('select count(*) n from public.broker_links where id=$1',[f.link])).rows[0].n),1);evidence.attributionWithoutBuyerLink='PASS';
  for(const path of f.paths)await storage.remove({bucket:'connect-privacy-private',path});evidence.storageExportsTemporary='PASS';
  await assert.rejects(db.query("insert into public.leads(organization_id,project_id,buyer_name,contact_channel,contact_value,source,privacy_notice_version) values($1,$2,'Synthetic new','email',$3,'public','2026-10-23')",[f.org,f.project,f.email]),e=>e.code==='42501');evidence.reintroductionDenied='PASS';
  assert.ok(!logs.join('').includes(f.email)&&!logs.join('').includes(f.canary));evidence.safeLogs='PASS';
  await mkdir(new URL('./.local',import.meta.url),{recursive:true});await writeFile(new URL('./.local/evidence.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 }else throw Error('mode_required');
}catch(e){console.error(JSON.stringify({event:'privacy.test_failed',code:e.code??'assertion_or_transport'}));process.exitCode=1;}finally{await db.end();}
