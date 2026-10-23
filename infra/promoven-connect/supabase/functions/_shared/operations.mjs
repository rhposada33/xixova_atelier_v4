const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
export async function boundedBody(request,limit){
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('body_limit');}parts.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
// Proxy must strip incoming x-connect-* and sign the exact forwarded body.
// A timestamp limits replay; application idempotency remains mandatory.
export async function proxyOrigin(request,bytes,secret,now=Date.now()){
 if(!secret||secret.length<32)throw Error('proxy_unconfigured');
 const timestamp=request.headers.get('x-connect-time')??'',client=request.headers.get('x-connect-client')??'',signature=request.headers.get('x-connect-signature')??'';
 if(!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>60000||!/^[a-zA-Z0-9:._-]{1,128}$/.test(client)||!/^[a-f0-9]{64}$/.test(signature))throw Error('proxy_invalid');
 const digest=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));
 const message=[timestamp,client,request.method,new URL(request.url).pathname,digest].join('\n');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const sig=Uint8Array.from(signature.match(/../g),s=>parseInt(s,16));
 if(!await crypto.subtle.verify('HMAC',key,sig,new TextEncoder().encode(message)))throw Error('proxy_invalid');return client;
}
export function operationalHandler(name,handler,{limit=8192,logger=console.log,mode='local',proxySecret}={}){
 return async request=>{
  const start=performance.now(),id=crypto.randomUUID();let response;
  try{
   const bytes=await boundedBody(request,limit);
   const headers=new Headers(request.headers);headers.delete('x-connect-verified-client');
   if(mode!=='local'&&request.method!=='OPTIONS')headers.set('x-connect-verified-client',await proxyOrigin(request,bytes,proxySecret));
   const copy=new Request(request.url,{method:request.method,headers,...(!['GET','HEAD'].includes(request.method)?{body:bytes}:{} )});
   response=await handler(copy);
  }catch(error){const status=error?.message==='body_limit'?413:error?.message?.startsWith('proxy_')?503:500;response=new Response(JSON.stringify({error:status===413?'payload_too_large':'operation_unavailable'}),{status,headers:{'Content-Type':'application/json'}});}
  response.headers.set('X-Request-ID',id);response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('Cache-Control','no-store');
  // Fixed fields only: never log URL, headers, payload, exception message or recipient.
  logger(JSON.stringify({event:'edge.request',service:name,requestId:id,status:response.status,durationMs:Math.round(performance.now()-start)}));return response;
 };
}
