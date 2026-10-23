import pg from 'pg';import assert from 'node:assert/strict';import {runCase,storageAdapter} from './worker.mjs';
const chunks=[];for await(const c of process.stdin)chunks.push(c);const cfg=JSON.parse(Buffer.concat(chunks));
const db=new pg.Client(cfg.db);await db.connect();
try{
 await db.query("insert into private.privacy_key values(true,decode($1,'hex')) on conflict(singleton) do update set key=excluded.key",[cfg.ledgerKey]);
 const f=cfg.fixture;
 if(f)assert.equal(Number((await db.query('select count(*) n from public.leads where id=$1',[f.lead])).rows[0].n),1);
 await db.query('set role connect_privacy_worker');
 const journal=(_folder,action,entry)=>{if(action==='append')assert.deepEqual(entry,cfg.entries.find(v=>v.id===entry.id));return cfg.entries;};
 for(const item of cfg.entries)await runCase({db,request:item.id,actor:item.actor,folder:'external-verified-journal',journal,storage:storageAdapter({url:cfg.storage,key:cfg.serviceKey,directRestore:true})});
 await db.query('reset role');
 if(f){
 assert.equal(Number((await db.query('select count(*) n from public.leads where id=$1',[f.lead])).rows[0].n),0);
 assert.equal(Number((await db.query('select count(*) n from public.lead_activities where lead_id=$1',[f.lead])).rows[0].n),0);
 assert.equal((await db.query('select payload from private.mail_outbox where id=$1',[f.mail])).rows[0].payload&&Object.keys((await db.query('select payload from private.mail_outbox where id=$1',[f.mail])).rows[0].payload).length,0);
 await assert.rejects(db.query("insert into public.leads(organization_id,project_id,buyer_name,contact_channel,contact_value,source,privacy_notice_version) values($1,$2,'Restored synthetic','email',$3,'public','2026-10-23')",[f.org,f.project,f.email]));
 }
 console.log(JSON.stringify({suppressionLedgerVerified:true,restoredSuppressedDataDetected:!!f,externalLedgerReapplied:true,restoredStorageRemoved:true,restoredMailErased:true,reintroductionBlocked:true}));
}catch(e){console.error(JSON.stringify({code:e.code??'privacy_restore_failure'}));process.exitCode=1;}finally{await db.end();}
