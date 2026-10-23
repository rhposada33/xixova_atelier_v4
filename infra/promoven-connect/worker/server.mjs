import http from 'node:http';import {spawn} from 'node:child_process';import {timingSafeEqual,createHash} from 'node:crypto';
const secret=process.env.CONNECT_WORKER_SECRET;if(!secret||secret.length<32)throw Error('worker_secret_required');let busy=false;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.url==='/health'&&req.method==='GET'){res.end('ok');return;}
 const auth=req.headers.authorization??'';const expected=`Bearer ${secret}`;
 if(auth.length!==expected.length||!timingSafeEqual(Buffer.from(auth),Buffer.from(expected))){res.writeHead(401).end();return;}
 if(req.method!=='POST'||req.url!=='/normalize'){res.writeHead(404).end();return;}
 if(busy){res.writeHead(429).end();return;}busy=true;
 let child;
 try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>5242880){res.writeHead(413).end();return;}chunks.push(chunk);}
 child=spawn(process.execPath,['--max-old-space-size=128',new URL('./child.mjs',import.meta.url).pathname,String(req.headers['content-type'])],{stdio:['pipe','pipe','ignore'],env:{PATH:process.env.PATH,VIPS_CONCURRENCY:'1'}});
 const result=await new Promise((resolve,reject)=>{const out=[];let bytes=0;const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error());},5000);child.stdout.on('data',b=>{bytes+=b.length;if(bytes>5242880){child.kill('SIGKILL');}else out.push(b);});child.on('error',()=>{clearTimeout(timer);reject(Error());});child.on('close',code=>{clearTimeout(timer);code===0?resolve(Buffer.concat(out)):reject(Error());});child.stdin.on('error',()=>{});child.stdin.end(Buffer.concat(chunks));});
 res.writeHead(200,{'Content-Type':'image/png','X-Content-SHA256':createHash('sha256').update(result).digest('hex')});res.end(result);
 }catch{if(!res.headersSent)res.writeHead(422);res.end();}finally{child?.kill('SIGKILL');busy=false;}
});server.requestTimeout=7000;server.headersTimeout=5000;server.listen(Number(process.env.PORT??8080),'0.0.0.0');
