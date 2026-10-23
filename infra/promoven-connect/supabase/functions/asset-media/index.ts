import { createClient } from "npm:@supabase/supabase-js@2.109.0";

const origin = Deno.env.get("CONNECT_APP_ORIGIN") ?? "http://127.0.0.1:5178";
const bucket = "connect-media-private";
const maxBytes = 5_242_880;
const cors = {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store","Content-Type":"application/json","Referrer-Policy":"no-referrer"};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const u32=(b:Uint8Array,i:number)=>((b[i]*2**24)+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3])>>>0;

function png(b:Uint8Array){
  if(b.length<67||hex(b.slice(0,8))!=="89504e470d0a1a0a")return false;
  let pos=8,head=false,data=false,end=false;
  while(pos+12<=b.length){const len=u32(b,pos),kind=new TextDecoder().decode(b.slice(pos+4,pos+8));pos+=8;if(len>b.length-pos-4)return false;
    if(!["IHDR","PLTE","tRNS","IDAT","IEND"].includes(kind))return false;
    if(!head){if(kind!=="IHDR"||len!==13)return false;const w=u32(b,pos),h=u32(b,pos+4);if(!w||!h||w>8000||h>8000||w*h>20_000_000)return false;head=true;}
    if(kind==="IDAT")data=true;
    pos+=len+4;
    if(kind==="IEND"){end=len===0;break;}
  }
  return head&&data&&end&&pos===b.length;
}
function jpeg(b:Uint8Array){
  if(b.length<100||b[0]!==255||b[1]!==216||b.at(-2)!==255||b.at(-1)!==217)return false;
  let pos=2,dimensions=false,scan=false;
  while(pos<b.length-2){if(b[pos++]!==255)return false;while(b[pos]===255)pos++;const marker=b[pos++];
    if(marker===0xda){scan=true;break;}
    if(marker===0xd9||marker===0x00||marker===0xd8||marker>=0xd0&&marker<=0xd7)return false;
    if(pos+2>b.length)return false;const len=(b[pos]<<8)|b[pos+1];if(len<2||pos+len>b.length)return false;
    if(marker>=0xe1&&marker<=0xef||marker===0xfe)return false; // EXIF, XMP, IPTC, comments and other metadata.
    if(marker===0xc0||marker===0xc2){if(len<7)return false;const h=(b[pos+3]<<8)|b[pos+4],w=(b[pos+5]<<8)|b[pos+6];if(!w||!h||w>8000||h>8000||w*h>20_000_000)return false;dimensions=true;}
    pos+=len;
  }
  return dimensions&&scan;
}
function webp(b:Uint8Array){
  if(b.length<40||new TextDecoder().decode(b.slice(0,4))!=="RIFF"||new TextDecoder().decode(b.slice(8,12))!=="WEBP"||u32(new Uint8Array([b[7],b[6],b[5],b[4]]),0)+8!==b.length)return false;
  let pos=12,visual=false;
  while(pos+8<=b.length){const kind=new TextDecoder().decode(b.slice(pos,pos+4)),size=(b[pos+4]|b[pos+5]<<8|b[pos+6]<<16|b[pos+7]<<24)>>>0;pos+=8;if(size>b.length-pos)return false;
    if(!["VP8 ","VP8L","VP8X","ALPH","ANIM","ANMF"].includes(kind))return false;
    if(kind==="VP8 "||kind==="VP8L")visual=true;
    pos+=size+(size%2);
  }
  return visual&&pos===b.length;
}
function validImage(bytes:Uint8Array,mime:string){return mime==="image/png"?png(bytes):mime==="image/jpeg"?jpeg(bytes):mime==="image/webp"?webp(bytes):false;}

Deno.serve(async request=>{
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
    const file=body.get("file");if(!(file instanceof File)||file.size<1024||file.size>maxBytes)return reply(422,{error:"invalid_size"});
    const bytes=new Uint8Array(await file.arrayBuffer());if(!validImage(bytes,file.type))return reply(422,{error:"invalid_content"});
    const checksum=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)));
    const projectId=String(body.get("projectId")??""),unitId=String(body.get("unitId")??"")||null,role=String(body.get("role")??"");
    const reserved=await user.rpc("connect_reserve_media",{p_project_id:projectId,p_unit_id:unitId,p_role:role,p_mime:file.type,p_size:file.size,p_checksum:checksum});
    if(reserved.error||!reserved.data)return reply(reserved.error?.code==="42501"?403:422,{error:"upload_not_allowed"});
    const asset=reserved.data;
    const uploaded=await admin.storage.from(bucket).upload(asset.storage_path,bytes,{contentType:file.type,upsert:false,cacheControl:"60"});
    if(uploaded.error){await user.rpc("connect_delete_media",{p_asset_id:asset.id,p_expected_version:asset.version});return reply(503,{error:"storage_failed"});}
    const finished=await user.rpc("connect_finish_media",{p_asset_id:asset.id});
    if(finished.error){await admin.storage.from(bucket).remove([asset.storage_path]);await user.rpc("connect_delete_media",{p_asset_id:asset.id,p_expected_version:asset.version});return reply(503,{error:"finalize_failed"});}
    return reply(201,{assetId:asset.id,version:finished.data.version,checksum,sizeBytes:file.size,role});
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
});
