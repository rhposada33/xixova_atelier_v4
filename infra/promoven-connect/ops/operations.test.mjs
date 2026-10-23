import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac,createHash} from 'node:crypto';
import {boundedBody,proxyOrigin,operationalHandler} from '../supabase/functions/_shared/operations.mjs';
import {validImage} from '../supabase/functions/_shared/media.mjs';
test('bounded body rejects chunked overflow',async()=>{await assert.rejects(()=>boundedBody(new Request('http://local',{method:'POST',body:'12345'}),4));});
test('proxy signature binds client, path, timestamp and body',async()=>{
 const secret='s'.repeat(32),time=String(Date.now()),body=new TextEncoder().encode('{}');const signature=createHmac('sha256',secret).update([time,'127.0.0.1','POST','/interest',createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
 const req=new Request('http://local/interest',{method:'POST',headers:{'x-connect-client':'127.0.0.1','x-connect-time':time,'x-connect-signature':signature}});
 assert.equal(await proxyOrigin(req,body,secret),'127.0.0.1');await assert.rejects(()=>proxyOrigin(req,new Uint8Array([1]),secret));await assert.rejects(()=>proxyOrigin(req,body,secret,Date.now()+120000));await assert.rejects(()=>proxyOrigin(new Request('http://local',{headers:{'x-real-ip':'1.2.3.4'}}),body,secret));
});
test('safe logs, request ID, no trusted client injection, generic failures',async()=>{const logs=[];const handler=operationalHandler('test',r=>{assert.equal(r.headers.get('x-connect-verified-client'),null);throw Error('secret email@test.local');},{logger:s=>logs.push(s)});const res=await handler(new Request('http://local/s/secret',{headers:{'x-connect-verified-client':'spoof'}}));assert.equal(res.status,500);assert.ok(res.headers.get('x-request-id'));assert.ok(!logs[0].includes('secret'));assert.ok(!logs[0].includes('email'));});
test('media fails closed for forged payloads',()=>{for(const mime of ['image/png','image/jpeg','image/webp','application/pdf'])assert.equal(validImage(new Uint8Array(1024),mime),false);});
