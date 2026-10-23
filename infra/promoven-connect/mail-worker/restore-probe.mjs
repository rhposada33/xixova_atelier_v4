import assert from 'node:assert/strict';import {mailWorker,rpcClient,authLinkFactory} from './worker.mjs';import {smtpTransport} from './transport.mjs';
const chunks=[];for await(const c of process.stdin)chunks.push(c);const config=JSON.parse(Buffer.concat(chunks));
const rpc=rpcClient(config.rest,config.workerJwt);for(let i=0;i<40;i++){try{await rpc('connect_mail_metrics');break;}catch{await new Promise(r=>setTimeout(r,250));}}
const transport=smtpTransport({mode:'local',host:config.mailpit,port:1025,mailpitUrl:`http://${config.mailpit}:8025`});
const generate=authLinkFactory({url:config.auth,serviceKey:config.serviceJwt,origin:'http://127.0.0.1:5178',publicUrl:config.auth,authPath:'',verifyPath:'/verify'});
const worker=mailWorker({rpc,transport,privateKeys:config.keys.privateKeys,publicKey:config.keys.publicKey,keyId:config.keys.kid,origin:'http://127.0.0.1:5178',publicAuthUrl:config.auth,verifyPath:'/verify',generateAuthLink:async email=>{try{return await generate(email);}catch(e){console.error(JSON.stringify({authFailure:e.code??'auth_transport_failure'}));throw e;}},logger:()=>{}});
assert.equal(await worker.tick(),true);assert.equal((await transport.reconcile(config.id)).found,true);worker.close();console.log(JSON.stringify({restoredOutboxDecrypted:true,restoredClaim:true,restoredMailpitAccepted:true}));
