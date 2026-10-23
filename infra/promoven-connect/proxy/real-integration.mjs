// Only local Connect containers + synthetic requests. Do not run alongside E2E writers.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
const here=new URL('.',import.meta.url), edge='supabase_edge_runtime_promoven_connect_local';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']});
const inspect=n=>JSON.parse(docker('container','inspect',n))[0];
const env=Object.fromEntries(inspect('connect-proxy-local-1').Config.Env.map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const network=JSON.parse(docker('network','inspect','connect_proxy_front_local'))[0];
const gateway=network.IPAM.Config[0].Gateway;
const key=createHmac('sha256',env.CONNECT_PROXY_SECRET).update(`rate\n${gateway}\n/functions/v1/public-interest`).digest('hex');
const sql=q=>execFileSync('docker',['exec','-i','supabase_db_promoven_connect_local','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const reset=()=>sql(`delete from private.connect_proxy_buckets where key='${key}';`);
const results={startedAt:new Date().toISOString()};
const origin='http://127.0.0.1:5178',body=JSON.stringify({website:'pc07b3a-synthetic',buyerName:'Synthetic Privacy Canary',contactValue:'pc07b3a-canary@example.invalid'});
const send=async(port=56410,extra={},payload=body,path='public-interest')=>{const r=await fetch(`http://127.0.0.1:${port}/functions/v1/${path}`,{method:'POST',headers:{connection:'close',origin,'content-type':'application/json','idempotency-key':randomUUID(),...extra},body:payload,signal:AbortSignal.timeout(10000)});await r.arrayBuffer();return r.status;};
const since=new Date().toISOString();
try {
 const state=inspect(edge);assert.deepEqual(Object.keys(state.NetworkSettings.Networks),['connect_edge_private_local']);assert.equal(Object.keys(state.HostConfig.PortBindings??{}).length,0);
 assert.equal(JSON.parse(docker('network','inspect','connect_edge_private_local'))[0].Internal,true);
 results.network={edgeInternalOnly:true,edgePublishedPorts:0};
 reset();
 assert.equal(await send(),202);results.publicRealEdge=202;
 assert.equal(await send(56410,{'x-connect-client':'forged','x-connect-verified-client':'forged','x-connect-time':'0','x-connect-signature':'0'.repeat(64),'x-forwarded-for':'203.0.113.99','x-real-ip':'203.0.113.99','sb-api-key':'forged','x-request-id':'private-canary-token'}),202);results.forgedHeadersStripped=202;
 assert.equal(sql(`select requests from private.connect_proxy_buckets where key='${key}'`),'2');
 const direct=await fetch('http://127.0.0.1:56321/functions/v1/public-interest',{method:'POST',headers:{origin},body});assert.ok([403,404].includes(direct.status));results.directKong=direct.status;await direct.arrayBuffer();
 const ip=state.NetworkSettings.Networks.connect_edge_private_local.IPAddress;
 const blocked=docker('run','--rm','--network','connect_proxy_front_local','--entrypoint','node','connect-proxy:local','-e',`fetch('http://${ip}:8081/public-interest',{method:'POST',body:'{}',signal:AbortSignal.timeout(1200)}).then(()=>process.exit(1)).catch(()=>{console.log('network_blocked');process.exit(0);})`);assert.match(blocked,/network_blocked/);results.frontNetworkBypass='network_blocked';
 results.backendHmac=JSON.parse(execFileSync('docker',['exec','-i','connect-proxy-local-1','node','--input-type=module'],{input:readFileSync(new URL('private-probe.mjs',here)),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
 // Persistent, exclusively synthetic fixture; retain audit history, never disable deletion guards.
 const org='cb3a0000-0000-4000-8000-000000000001', project='cb3a0000-0000-4000-8000-000000000002';
 sql(`insert into public.organizations(id,name,slug) values('${org}','PC07B3A HTTP synthetic','pc07b3a-http-synthetic') on conflict(id) do nothing;
 insert into public.projects(id,organization_id,name,slug,public_slug,city,state,status) values('${project}','${org}','PC07B3A HTTP synthetic','pc07b3a-http-synthetic','pc07b3a-http-synthetic','São Paulo','SP','published') on conflict(id) do nothing;`);
 assert.equal(sql(`select name from public.projects where id='${project}'`),'PC07B3A HTTP synthetic');
 const operation=randomUUID(), contact=`pc07b3a-${operation}@example.invalid`;
 const captureBody=JSON.stringify({publicSlug:'pc07b3a-http-synthetic',buyerName:'PC07B3A Synthetic',contactChannel:'email',contactValue:contact,privacyNoticeVersion:'2026-10-23'});
 let receipt;
 for(const port of [56410,56411]){
  const r=await fetch(`http://127.0.0.1:${port}/functions/v1/public-interest`,{method:'POST',headers:{connection:'close',origin,'content-type':'application/json','idempotency-key':operation},body:captureBody});
  assert.equal(r.status,202,'actual lead capture through Edge + PostgREST');const json=await r.json();assert.equal(typeof json.receiptId,'string');
  if(receipt)assert.equal(json.receiptId,receipt);receipt=json.receiptId;
 }
 assert.equal(sql(`select count(*) from public.leads where project_id='${project}' and contact_value='${contact}'`),'1');
 results.persistedSyntheticLead={http:202,duplicateHttp:202,rows:1,idempotentAcrossInstances:true};
 assert.equal(await send(56410,{origin:'http://invalid.example'}),403);results.invalidCors=403;
 const preflight=await fetch('http://127.0.0.1:56410/functions/v1/asset-media',{method:'OPTIONS',headers:{origin,'Access-Control-Request-Headers':'authorization,apikey,x-client-info,content-type'}});assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/x-client-info/);results.preflight=204;
 reset();
 const concurrent=await Promise.all(Array.from({length:40},(_,i)=>send(i%2?56410:56411)));
 assert.equal(concurrent.filter(x=>x===202).length,30);assert.equal(concurrent.filter(x=>x===429).length,10);results.concurrentTwoInstances={accepted:30,limited:10};
 docker('restart','--time','1','connect-proxy-local-1');
 // Poll socket readiness only; rejected requests cannot reset the persisted bucket.
 let after;for(let i=0;i<30;i++){try{after=await send();break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.equal(after,429);assert.equal(await send(56411),429);results.restart={first:429,second:429};
 reset();
 docker('pause',edge);
 try{assert.equal(await send(),502);results.backendFailure=502;}finally{docker('unpause',edge);}
 assert.equal(await send(),202);results.backendRecovered=202;
 // Make only proxy #2 lose its limiter route, leaving all Supabase services untouched.
 docker('network','disconnect','connect_edge_private_local','connect-proxy-local-2');
 try{assert.equal(await send(56411),503);results.limiterUnavailable=503;}finally{docker('network','connect','connect_edge_private_local','connect-proxy-local-2');}
 assert.equal(await send(56411),202);results.limiterRecovered=202;
 const logs=['connect-proxy-local-1','connect-proxy-local-2',edge].map(n=>{const r=spawnSync('docker',['logs','--since',since,n],{encoding:'utf8'});assert.equal(r.status,0);return r.stdout+r.stderr;}).join('\n');
 for(const canary of ['Synthetic Privacy Canary','pc07b3a-canary@example.invalid','private-canary-token',contact,receipt,env.CONNECT_PROXY_SECRET,env.CONNECT_RATE_TOKEN])assert.ok(!logs.includes(canary),'sensitive log leak');
 assert.ok(logs.includes('edge.request'),'Edge audit events missing');results.logsNoSecretsOrCanaries=true;
 results.finishedAt=new Date().toISOString();mkdirSync(new URL('.local/',here),{recursive:true});writeFileSync(new URL('.local/http-evidence.json',here),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
} finally {reset();}
