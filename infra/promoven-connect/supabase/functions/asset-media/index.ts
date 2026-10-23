import { persistNormalized } from "../_shared/media-persistence.mjs";
import { operationalHandler } from "../_shared/operations.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

const origin = Deno.env.get("CONNECT_APP_ORIGIN") ?? "http://127.0.0.1:5178";
const bucket = "connect-media-private";
const maxBytes = 5_242_880;
const cors = {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store","Content-Type":"application/json","Referrer-Policy":"no-referrer"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");



Deno.serve(operationalHandler("asset-media",async request=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="POST")return reply(405,{error:"method_not_allowed"});
  if(Deno.env.get("CONNECT_DELIVERY_MODE")!=="local")return reply(503,{error:"local_only"});
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=request.headers.get("Authorization");
  const user=createClient(url,anon,{global:{headers:auth?{Authorization:auth}:{}},auth:{persistSession:false}});
  const admin=createClient(url,service,{auth:{persistSession:false}});
  let body:FormData;try{body=await request.formData();}catch{return reply(400,{error:"invalid_form"});}
  const action=String(body.get("action")??"");
  if(action==="url"){
    const assetId=String(body.get("assetId")??"");if(!/^[0-9a-f-]{36}$/.test(assetId))return reply(400,{error:"invalid_asset"});
    let allowed=false;
    if(auth?.startsWith("Bearer ")){const identity=await user.auth.getUser();if(!identity.error&&identity.data.user){const check=await user.rpc("connect_private_media_allowed",{p_asset_id:assetId});allowed=check.data===true;}}
    if(!allowed){const guest=createClient(url,anon,{auth:{persistSession:false}});const check=await guest.rpc("connect_public_media_allowed",{p_asset_id:assetId});allowed=check.data===true;}
    if(!allowed)return reply(404,{error:"not_found"});
    const {data:asset,error}=await admin.from("project_assets").select("storage_path,mime_type").eq("id",assetId).maybeSingle();if(error||!asset)return reply(404,{error:"not_found"});
    const signed=await admin.storage.from(bucket).createSignedUrl(asset.storage_path,60);
    if(signed.error||!signed.data?.signedUrl)return reply(503,{error:"media_unavailable"});
    const internal=new URL(signed.data.signedUrl);
    if(!internal.pathname.startsWith("/storage/v1/object/sign/"))return reply(503,{error:"media_unavailable"});
    const publicUrl=new URL(internal.pathname+internal.search,Deno.env.get("CONNECT_PUBLIC_SUPABASE_URL")??"http://127.0.0.1:56321");
    return reply(200,{url:publicUrl.toString(),expiresIn:60,mimeType:asset.mime_type});
  }
  if(!auth?.startsWith("Bearer "))return reply(401,{error:"unauthorized"});
  const identity=await user.auth.getUser();if(identity.error||!identity.data.user)return reply(401,{error:"unauthorized"});
  if(action==="upload"){
    const file=body.get("file");if(!(file instanceof File)||file.size<1||file.size>maxBytes)return reply(422,{error:"invalid_size"});
    const workerUrl=Deno.env.get("CONNECT_MEDIA_WORKER_URL"),workerSecret=Deno.env.get("CONNECT_WORKER_SECRET");
    if(!workerUrl||!workerSecret)return reply(503,{error:"normalizer_unavailable"});
    let bytes:Uint8Array;
    try{const normalized=await fetch(`${workerUrl}/normalize`,{method:"POST",headers:{Authorization:`Bearer ${workerSecret}`,"Content-Type":file.type},body:await file.arrayBuffer(),signal:AbortSignal.timeout(6500)});
      if(!normalized.ok)return reply(normalized.status===422?422:503,{error:"normalization_failed"});
      bytes=new Uint8Array(await normalized.arrayBuffer());if(bytes.length>maxBytes||bytes.length<1||normalized.headers.get("Content-Type")!=="image/png")throw Error();
    }catch{return reply(503,{error:"normalizer_unavailable"});}
    const checksum=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)));
    const projectId=String(body.get("projectId")??""),unitId=String(body.get("unitId")??"")||null,role=String(body.get("role")??"");
    const reserved=await user.rpc("connect_reserve_media",{p_project_id:projectId,p_unit_id:unitId,p_role:role,p_mime:"image/png",p_size:bytes.length,p_checksum:checksum});
    if(reserved.error||!reserved.data)return reply(reserved.error?.code==="42501"?403:422,{error:"upload_not_allowed"});
    const asset=reserved.data;
    const persisted=await persistNormalized({user,admin,bucket,asset,bytes});
    if(persisted.error)return reply(503,{error:persisted.error});
    return reply(201,{assetId:asset.id,version:persisted.version,checksum,sizeBytes:bytes.length,role});
  }
  if(action==="delete"||action==="replace"){
    const assetId=String(body.get("assetId")??""),version=Number(body.get("version"));
    if(!Number.isSafeInteger(version)||version<1)return reply(400,{error:"invalid_version"});
    const result=action==="delete"
      ?await user.rpc("connect_delete_media",{p_asset_id:assetId,p_expected_version:version})
      :await user.rpc("connect_replace_media",{p_old_id:assetId,p_new_id:String(body.get("newAssetId")??""),p_expected_version:version});
    if(result.error)return reply(result.error.code==="42501"?403:409,{error:"media_change_denied"});
    const old=await admin.from("project_assets").select("storage_path").eq("id",assetId).maybeSingle();
    if(old.data?.storage_path)await admin.storage.from(bucket).remove([old.data.storage_path]);
    return reply(200,{assetId:result.data.id,version:result.data.version,status:action==="delete"?"deleted":"replaced"});
  }
  return reply(400,{error:"invalid_action"});
}, {limit: 5300000,mode:Deno.env.get("CONNECT_DELIVERY_MODE")??"local",proxySecret:Deno.env.get("CONNECT_PROXY_SECRET")}));
