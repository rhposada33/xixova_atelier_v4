import { operationalHandler } from "../_shared/operations.mjs";
import {createClient} from "npm:@supabase/supabase-js@2.109.0";
const origin=Deno.env.get("CONNECT_APP_ORIGIN")??"http://127.0.0.1:5178";
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store","Content-Type":"application/json","Referrer-Policy":"no-referrer"};
const reply=(status:number,value:Record<string,unknown>)=>new Response(JSON.stringify(value),{status,headers});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
Deno.serve(operationalHandler("broker-link",async request=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST")return reply(405,{error:"method_not_allowed"});
  if(Deno.env.get("CONNECT_DELIVERY_MODE")!=="local")return reply(503,{error:"local_only"});
  const auth=request.headers.get("Authorization");if(!auth?.startsWith("Bearer "))return reply(401,{error:"unauthorized"});
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const user=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const identity=await user.auth.getUser();if(identity.error||!identity.data.user)return reply(401,{error:"unauthorized"});
  let body:{projectId?:string;unitId?:string|null};try{body=await request.json();}catch{return reply(400,{error:"invalid_body"});}
  if(!body||!Object.keys(body).every(key=>["projectId","unitId"].includes(key))||!body.projectId)return reply(400,{error:"invalid_body"});
  const token=hex(crypto.getRandomValues(new Uint8Array(32)));
  const digest=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))));
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const expiry=new Date(Date.now()+30*24*60*60*1000).toISOString();
  const created=await admin.rpc("connect_create_broker_link",{p_broker_user_id:identity.data.user.id,p_project_id:body.projectId,p_unit_id:body.unitId??null,p_token_hash:digest,p_expires_at:expiry});
  if(created.error)return reply(created.error.code==="42501"?403:422,{error:"link_not_allowed"});
  return reply(201,{...created.data,url:`${origin}/s/${token}`});
}, {limit: 8192,mode:Deno.env.get("CONNECT_DELIVERY_MODE")??"local",proxySecret:Deno.env.get("CONNECT_PROXY_SECRET")}));
