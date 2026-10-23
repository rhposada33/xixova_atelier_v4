import {test} from 'node:test';import assert from 'node:assert/strict';import {createHmac,createHash} from 'node:crypto';
import {boundedBody,proxyOrigin,operationalHandler} from '../supabase/functions/_shared/operations.mjs';
import {validImage} from '../supabase/functions/_shared/media.mjs';
test('bounded body rejects chunked overflow',async()=>{await assert.rejects(()=>boundedBody(new Request('http://local',{method:'POST',body:'12345'}),4));});
test('proxy signature binds client, path, timestamp and body',async()=>{
 const secret='s'.repeat(32),time=String(Date.now()),body=new TextEncoder().encode('{}');const signature=createHmac('sha256',secret).update([time,'127.0.0.1','POST','/interest',createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
 const req=new Request('http://local/interest',{method:'POST',headers:{'x-connect-client':'127.0.0.1','x-connect-time':time,'x-connect-signature':signature}});
 assert.equal(await proxyOrigin(req,body,secret),'127.0.0.1');await assert.rejects(()=>proxyOrigin(req,new Uint8Array([1]),secret));await assert.rejects(()=>proxyOrigin(req,body,secret,Date.now()+120000));await assert.rejects(()=>proxyOrigin(new Request('http://local',{headers:{'x-real-ip':'1.2.3.4'}}),body,secret));
});
test('missing proxy secret fails closed even locally, without invoking handler',async()=>{
 const logs=[];let invoked=false;
 const handler=operationalHandler('test',()=>{invoked=true;return new Response();},{logger:s=>logs.push(s)});
 const res=await handler(new Request('http://local/s/secret',{headers:{'x-connect-verified-client':'spoof'}}));
 assert.equal(res.status,503);assert.equal(invoked,false);assert.ok(res.headers.get('x-request-id'));assert.ok(!logs[0].includes('secret'));
});
test('verified client replaces spoof and handler errors never disclose payload',async()=>{
 const logs=[],secret='s'.repeat(32),time=String(Date.now()),body='{}',path='/test';
 const signature=createHmac('sha256',secret).update([time,'127.0.0.1','POST',path,createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
 const handler=operationalHandler('test',r=>{assert.equal(r.headers.get('x-connect-verified-client'),'127.0.0.1');throw Error('secret email@test.local');},{proxySecret:secret,logger:s=>logs.push(s)});
 const res=await handler(new Request('http://local'+path,{method:'POST',body,headers:{'x-connect-verified-client':'spoof','x-connect-client':'127.0.0.1','x-connect-time':time,'x-connect-signature':signature}}));
 assert.equal(res.status,500);assert.ok(!(await res.text()).includes('secret'));assert.ok(!logs[0].includes('email'));
});
test('media fails closed for forged payloads',()=>{for(const mime of ['image/png','image/jpeg','image/webp','application/pdf'])assert.equal(validImage(new Uint8Array(1024),mime),false);});
