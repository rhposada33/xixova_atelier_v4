import http from 'node:http';
import {createHmac, createHash, randomUUID} from 'node:crypto';
import {sharedRate} from './shared-rate.mjs';

// socketPath + in-memory bucket is retained ONLY for the legacy contract test.
// Real HTTP upstream requires the persistent limiter; there is no local fallback.
export function createProxy({socketPath, upstreamUrl, consume, secret, origin,
  limit=5300000, maxRequests=30, windowMs=3600000, logger=console.log}) {
  if ((!socketPath?.startsWith('/') && !upstreamUrl) || !secret || secret.length<32 || !origin || (upstreamUrl&&!consume)) {
    throw Error('configuration_required');
  }
  const buckets=new Map();
  return http.createServer(async (req,res)=>{
    const id=randomUUID(), start=Date.now();
    const common={'X-Request-ID':id,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff', ...(req.headers.origin===origin?{'Access-Control-Allow-Origin':origin}:{})};
    const finish=status=>{res.writeHead(status,common);res.end();};
    res.on('finish',()=>logger(JSON.stringify({event:'proxy.request',requestId:id,status:res.statusCode,durationMs:Date.now()-start})));
    if(req.headers.origin!==origin){finish(403);return;}
    let publicPath;
    try{publicPath=new URL(req.url,'http://backend');}catch{finish(400);return;}
    if(upstreamUrl&&(!/^\/functions\/v1\/(public-interest|asset-media|broker-invite|broker-link)$/.test(publicPath.pathname)||publicPath.search)){
      finish(404);return;
    }
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,idempotency-key,x-client-info');
      res.setHeader('Access-Control-Allow-Methods','POST');finish(204);return;
    }
    if(req.method!=='POST'){finish(405);return;}
    // A directly published proxy reads the TCP peer, never user-supplied forwarding headers.
    const client=req.socket.remoteAddress??'unknown';
    if(consume){
      const key=createHmac('sha256',secret).update(`rate\n${client}\n${publicPath.pathname}`).digest('hex');
      try{if(!await consume(key)){finish(429);return;}}catch{finish(503);return;}
    }else{
      const now=Date.now();for(const [key,v] of buckets)if(v.until<now)buckets.delete(key);
      if(!buckets.has(client)&&buckets.size>=10000){finish(503);return;}
      const bucket=buckets.get(client)??{until:now+windowMs,count:0};buckets.set(client,bucket);
      if(++bucket.count>maxRequests){finish(429);return;}
    }
    try{
      const chunks=[];let size=0;
      const bodyDeadline=setTimeout(()=>req.destroy(),5000);
      try{
        for await(const chunk of req){size+=chunk.length;if(size>limit){finish(413);return;}chunks.push(chunk);}
      }finally{clearTimeout(bodyDeadline);}
      const body=Buffer.concat(chunks);
      // Supabase runtime routes /function-name, Kong prefix is not forwarded.
      const path=upstreamUrl?publicPath.pathname.slice('/functions/v1'.length):publicPath.pathname;
      const time=String(Date.now());
      const signature=createHmac('sha256',secret).update([time,client,'POST',path,createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
      // Allowlist removes ALL external x-connect-*, forwarding, request-id and sb-api-key headers.
      const headers={'content-length':String(body.length),'x-connect-client':client,'x-connect-time':time,'x-connect-signature':signature,'x-request-id':id};
      for(const k of ['authorization','apikey','content-type','idempotency-key','origin'])if(req.headers[k])headers[k]=req.headers[k];
      const address=upstreamUrl?{hostname:new URL(upstreamUrl).hostname,port:new URL(upstreamUrl).port}:{socketPath};
      await new Promise(resolve=>{
        const upstream=http.request({...address,path,method:'POST',headers},r=>{
          const out=[];let n=0;
          r.on('data',b=>{n+=b.length;if(n>6000000)r.destroy();else out.push(b);});
          r.on('end',()=>{res.writeHead(r.statusCode,{...common,'content-type':r.headers['content-type']??'application/json'});res.end(Buffer.concat(out));resolve();});
          r.on('error',()=>{if(!res.headersSent)finish(502);resolve();});
        });
        // Absolute upstream deadline also covers DNS/connect stalls and trickled responses.
        const deadline=setTimeout(()=>upstream.destroy(),6500);
        upstream.on('close',()=>clearTimeout(deadline));
        upstream.on('error',()=>{if(!res.headersSent)finish(502);resolve();});
        upstream.end(body);
      });
    }catch{if(!res.headersSent)finish(502);}
  });
}
if(process.env.CONNECT_PROXY_SOCKET){
  const server=createProxy({socketPath:process.env.CONNECT_PROXY_SOCKET,secret:process.env.CONNECT_PROXY_SECRET,origin:process.env.CONNECT_APP_ORIGIN});
  server.headersTimeout=5000;server.requestTimeout=10000;server.listen(Number(process.env.PORT??56410),'127.0.0.1');
}
if(process.env.CONNECT_PROXY_UPSTREAM){
  const server=createProxy({upstreamUrl:process.env.CONNECT_PROXY_UPSTREAM,secret:process.env.CONNECT_PROXY_SECRET,origin:process.env.CONNECT_APP_ORIGIN,
    consume:sharedRate({url:process.env.CONNECT_RATE_URL,token:process.env.CONNECT_RATE_TOKEN})});
  server.headersTimeout=5000;server.requestTimeout=10000;server.listen(8080,'0.0.0.0');
}
