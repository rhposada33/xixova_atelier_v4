// Explicit local operator entry point. No HTTP listener, scheduler or production mode.
import {database,environment,folder} from './local.mjs';
import {runCase,ledger,storageAdapter} from './worker.mjs';
const [request,actor]=process.argv.slice(2);
if(![request,actor].every(v=>/^[a-f0-9-]{36}$/.test(v??'')))throw Error('request_and_requester_UUID_required');
const db=await database();
try{
 ledger(folder,'list'); // absent/corrupt journal fails closed before any mutation
 await db.query('set role connect_privacy_worker');
 const result=await runCase({db,request,actor,folder,storage:storageAdapter({url:'http://127.0.0.1:56321',key:environment().SUPABASE_SERVICE_ROLE_KEY}),logger:console.log});
 console.log(JSON.stringify({event:'privacy.result',result}));
}catch{console.error(JSON.stringify({event:'privacy.blocked_or_retry_required'}));process.exitCode=1;}finally{await db.end();}
