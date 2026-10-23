import type { ConnectAdminMediaAsset, ConnectMediaAsset, ConnectMediaRole } from "@promoven/connect-contracts";
import { connectClient } from "./supabase";

type Row=Record<string,unknown>;
function check(error:{code?:string;message:string}|null){if(!error)return;if(error.code==="42501"||error.code==="P0002")throw new Error("Mídia indisponível ou acesso não autorizado.");if(error.code==="PT409")throw new Error("Mídia alterada. Atualize a página.");throw new Error(error.message);}
const asset=(r:Row):ConnectAdminMediaAsset=>({assetId:String(r.id),role:r.media_role as ConnectMediaRole,unitId:r.unit_id?String(r.unit_id):null,mimeType:r.mime_type as ConnectMediaAsset["mimeType"],checksum:String(r.checksum),version:Number(r.version),published:Boolean(r.published),uploadState:r.upload_state as ConnectAdminMediaAsset["uploadState"],sizeBytes:Number(r.size_bytes)});
function form(action:string,fields:Record<string,string>){const data=new FormData();data.set("action",action);for(const [key,value] of Object.entries(fields))data.set(key,value);return data;}
export const mediaApi={
 async adminAssets(projectId:string){const {data,error}=await connectClient().from("project_assets").select("id,unit_id,media_role,mime_type,checksum,version,published,upload_state,size_bytes").eq("project_id",projectId).neq("upload_state","deleted").order("created_at",{ascending:false});check(error);return (data??[]).filter(r=>r.media_role).map(asset);},
 async upload(projectId:string,unitId:string|null,role:ConnectMediaRole,file:File){const body=form("upload",{projectId,role,...(unitId?{unitId}:{})});body.set("file",file);const {data,error}=await connectClient().functions.invoke("asset-media",{body});if(error)throw new Error("Upload recusado. Verifique o formato, conteúdo, tamanho e sua permissão.");return data as {assetId:string;version:number;checksum:string;sizeBytes:number};},
 async publish(assetId:string,version:number,visible:boolean){const {error}=await connectClient().rpc("connect_publish_media",{p_asset_id:assetId,p_expected_version:version,p_visible:visible});check(error);},
 async remove(assetId:string,version:number){const {error}=await connectClient().functions.invoke("asset-media",{body:form("delete",{assetId,version:String(version)})});if(error)throw new Error("Não foi possível excluir esta mídia.");},
 async replace(assetId:string,version:number,newAssetId:string){const {error}=await connectClient().functions.invoke("asset-media",{body:form("replace",{assetId,version:String(version),newAssetId})});if(error)throw new Error("Não foi possível substituir esta mídia.");},
 async privateManifest(projectId:string,unitId:string|null=null):Promise<ConnectMediaAsset[]>{const {data,error}=await connectClient().rpc("connect_private_media_manifest",{p_project_id:projectId,p_unit_id:unitId});check(error);return data??[];},
 async publicManifest(projectId:string,unitId:string|null=null):Promise<ConnectMediaAsset[]>{const {data,error}=await connectClient().rpc("connect_public_media_manifest",{p_project_id:projectId,p_unit_id:unitId});check(error);return data??[];},
 async url(assetId:string):Promise<string>{const {data,error}=await connectClient().functions.invoke("asset-media",{body:form("url",{assetId})});if(error||!data?.url)throw new Error("Imagem indisponível.");return String(data.url);},
};
