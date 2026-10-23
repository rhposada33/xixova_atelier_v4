// Run via stdin inside a trusted proxy container, never publish this probe.
import assert from 'node:assert/strict';
import {createHmac,createHash,randomUUID} from 'node:crypto';
const base=process.env.CONNECT_PROXY_UPSTREAM, secret=process.env.CONNECT_PROXY_SECRET;
const body=JSON.stringify({website:'synthetic-proxy-check'});
function signed({path='/public-interest',method='POST',time=String(Date.now()),payload=body}={}) {
 const client='synthetic-probe';
 return {'origin':'http://127.0.0.1:5178','content-type':'application/json','idempotency-key':randomUUID(),
 'x-connect-client':client,'x-connect-time':time,'x-connect-signature':createHmac('sha256',secret).update([time,client,method,path,createHash('sha256').update(payload).digest('hex')].join('\n')).digest('hex')};
}
const cases=[
 ['signed_real_edge', '/public-interest','POST',body,signed(),202],
 ['unsigned_direct', '/public-interest','POST',body,{},403],
 ['forged_verified_header','/public-interest','POST',body,{'x-connect-verified-client':'spoof'},403],
 ['invalid_signature','/public-interest','POST',body,{...signed(),'x-connect-signature':'0'.repeat(64)},403],
 ['altered_body','/public-interest','POST','{}',signed(),403],
 ['expired_timestamp','/public-interest','POST',body,signed({time:String(Date.now()-120000)}),403],
 ['future_timestamp','/public-interest','POST',body,signed({time:String(Date.now()+120000)}),403],
 ['altered_method','/public-interest','PUT',body,signed(),403],
 ['altered_path','/broker-link','POST',body,signed(),403],
];
const results={};for(const [name,path,method,payload,headers,status]of cases){const r=await fetch(base+path,{method,body:payload,headers:{connection:'close',...headers}});assert.equal(r.status,status,name);results[name]=r.status;await r.arrayBuffer();}
console.log(JSON.stringify(results));
