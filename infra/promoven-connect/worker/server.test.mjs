import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import http from 'node:http';import sharp from 'sharp';
test('worker HTTP authentication, decode failure, output hash and concurrency',async()=>{
 const tmp=http.createServer();await new Promise(r=>tmp.listen(0,'127.0.0.1',r));const port=tmp.address().port;await new Promise(r=>tmp.close(r));const secret='test-only-'.repeat(8);const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port),CONNECT_WORKER_SECRET:secret},stdio:'ignore'});const base=`http://127.0.0.1:${port}`;
 try{for(let i=0;i<30;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const input=await sharp({create:{width:500,height:500,channels:3,background:'red'}}).jpeg().toBuffer();const send=(data=input,auth=secret)=>fetch(base+'/normalize',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'image/jpeg'},body:data});assert.equal((await send(input,'wrong')).status,401);assert.equal((await send(Buffer.alloc(1000))).status,422);
 const results=await Promise.all([send(),send()]);assert.ok(results.some(r=>r.status===429));const ok=results.find(r=>r.status===200);assert.ok(ok);const out=Buffer.from(await ok.arrayBuffer());assert.equal((await sharp(out).metadata()).format,'png');assert.equal(ok.headers.get('x-content-sha256'),(await import('node:crypto')).createHash('sha256').update(out).digest('hex'));
 }finally{child.kill();await new Promise(r=>child.once('exit',r));}
});
