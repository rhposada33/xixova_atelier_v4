import {mailWorker,rpcClient,authLinkFactory} from './worker.mjs';
import {smtpTransport} from './transport.mjs';
const e=process.env;
let worker;
try{
 // No remote delivery is enabled by this executable/checkpoint.
 if(e.CONNECT_MAIL_MODE!=='local')throw Error('local_only');
 worker=mailWorker({rpc:rpcClient(e.CONNECT_MAIL_REST_URL,e.CONNECT_MAIL_WORKER_TOKEN),
  transport:smtpTransport({mode:'local',host:e.CONNECT_MAIL_SMTP_HOST,port:Number(e.CONNECT_MAIL_SMTP_PORT),mailpitUrl:e.CONNECT_MAIL_MAILPIT_URL}),
  privateKeys:JSON.parse(e.CONNECT_MAIL_PRIVATE_KEYS??'{}'),publicKey:e.CONNECT_MAIL_PUBLIC_KEY,keyId:e.CONNECT_MAIL_KEY_ID,
  origin:e.CONNECT_APP_ORIGIN,publicAuthUrl:e.CONNECT_PUBLIC_SUPABASE_URL,maxAttempts:Number(e.CONNECT_MAIL_MAX_ATTEMPTS??5),
  generateAuthLink:authLinkFactory({url:e.CONNECT_AUTH_URL,serviceKey:e.CONNECT_AUTH_SERVICE_KEY,origin:e.CONNECT_APP_ORIGIN,publicUrl:e.CONNECT_PUBLIC_SUPABASE_URL})});
}catch{console.log(JSON.stringify({event:'mail.configuration_failed'}));process.exit(1);}
let stopping=false;for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;});
let rounds=0;
while(!stopping){try{const worked=await worker.tick();if(++rounds%30===0)console.log(JSON.stringify({event:'mail.metrics',...await worker.metrics()}));if(!worked)await new Promise(r=>setTimeout(r,500));}catch{console.log(JSON.stringify({event:'mail.operation_unavailable'}));await new Promise(r=>setTimeout(r,1000));}}
worker.close();console.log(JSON.stringify({event:'mail.stopped'}));
