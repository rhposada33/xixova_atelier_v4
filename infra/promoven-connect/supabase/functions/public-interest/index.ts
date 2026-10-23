import {createClient} from "npm:@supabase/supabase-js@2.109.0";
const origin=Deno.env.get("CONNECT_APP_ORIGIN")??"http://127.0.0.1:5178";
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info,idempotency-key","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store","Content-Type":"application/json","Referrer-Policy":"no-referrer"};
const reply=(status:number,value:Record<string,unknown>)=>new Response(JSON.stringify(value),{status,headers});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return reply(405,{error:"method_not_allowed"});
  if(Deno.env.get("CONNECT_DELIVERY_MODE")!=="local")return reply(503,{error:"local_only"});
  if(Number(request.headers.get("content-length")??0)>4096)return reply(413,{error:"payload_too_large"});
  const secret=Deno.env.get("CONNECT_LEAD_RATE_SECRET");if(!secret||secret.length<32)return reply(503,{error:"rate_limit_unavailable"});
  const id=request.headers.get("Idempotency-Key");if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply(400,{error:"idempotency_required"});
  let body:{shareToken?:string;publicSlug?:string;buyerName?:string;contactChannel?:string;contactValue?:string;message?:string;unitCode?:string;privacyNoticeVersion?:string;website?:string};
  try{const raw=await request.text();if(raw.length>4096)return reply(413,{error:"payload_too_large"});body=JSON.parse(raw);}catch{return reply(400,{error:"invalid_body"});}
  if(!body||typeof body!=="object"||Array.isArray(body)||!Object.keys(body).every(key=>["shareToken","publicSlug","buyerName","contactChannel","contactValue","message","unitCode","privacyNoticeVersion","website"].includes(key)))return reply(422,{error:"invalid_body"});
  if(body.website)return reply(202,{status:"accepted"}); // honeypot; no database write.
  if(Boolean(body.shareToken)===Boolean(body.publicSlug))return reply(422,{error:"invalid_source"});
  if(body.shareToken&&!/^[a-f0-9]{64}$/.test(body.shareToken))return reply(404,{error:"not_found"});
  if(body.publicSlug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.publicSlug))return reply(404,{error:"not_found"});
  const buyerName=body.buyerName?.trim(),contactChannel=body.contactChannel,contactValue=body.contactValue?.trim(),message=body.message?.trim()??"",unitCode=body.unitCode?.trim().toUpperCase()??"";
  if(!buyerName||buyerName.length<2||buyerName.length>160||!contactValue||contactValue.length>254||message.length>1000
     ||body.privacyNoticeVersion!=="2026-10-23"||!(["email","phone"].includes(contactChannel??""))
     ||(contactChannel==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue))
     ||(contactChannel==="phone"&&!/^\+?[0-9() -]{8,30}$/.test(contactValue))
     ||(unitCode&&!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(unitCode)))return reply(422,{error:"invalid_contact"});
  const encoder=new TextEncoder();const hmac=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const ip=request.headers.get("x-real-ip")??request.headers.get("x-forwarded-for")?.split(",")[0]??"local-unknown";
  const rateKey=hex(new Uint8Array(await crypto.subtle.sign("HMAC",hmac,encoder.encode(ip))));
  const tokenHash=body.shareToken?hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(body.shareToken)))):null;
  const payload={buyerName,contactChannel,contactValue,message,unitCode,privacyNoticeVersion:"2026-10-23"};
  const payloadHash=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(JSON.stringify({tokenHash,publicSlug:body.publicSlug??null,payload})))));
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const rate=await admin.rpc("connect_rate_interest",{p_rate_key:rateKey});if(rate.error)return reply(503,{error:"rate_limit_unavailable"});if(rate.data!==true)return reply(429,{error:"rate_limited"});
  const result=await admin.rpc("connect_submit_interest",{p_token_hash:tokenHash,p_public_slug:body.publicSlug??null,p_payload:payload,p_idempotency_id:id,p_payload_hash:payloadHash});
  if(result.error)return reply(result.error.code==="PT409"?409:result.error.code==="P0002"?404:result.error.code==="22023"?422:503,{error:result.error.code==="PT409"?"conflict":result.error.code==="P0002"?"not_found":"submission_failed"});
  return reply(202,result.data);
});
