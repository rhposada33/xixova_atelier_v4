import type { BrokerShareLink, ConnectLead, InterestPayload, PublicProject, PublicShare, PublicUnit, ConnectMediaAsset } from "@promoven/connect-contracts";
import { connectClient } from "./supabase";

function requireData<T>(data:T|null,error:{message:string}|null):T { if(error)throw new Error(error.message);if(data===null)throw new Error("Conteúdo indisponível.");return data; }
export async function sha256(value:string):Promise<string>{const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");}
export const shareApi={
  async publicProject(slug:string):Promise<PublicProject>{const {data,error}=await connectClient().rpc("connect_public_project",{p_public_slug:slug});return requireData(data,error) as PublicProject;},
  async publicUnit(slug:string,code:string):Promise<PublicUnit>{const {data,error}=await connectClient().rpc("connect_public_unit",{p_public_slug:slug,p_unit_code:code});return requireData(data,error) as PublicUnit;},
  async publicShare(token:string):Promise<PublicShare>{const {data,error}=await connectClient().rpc("connect_public_share",{p_token_hash:await sha256(token)});return requireData(data,error) as PublicShare;},
  async publicMedia(slug:string,code:string|null=null):Promise<ConnectMediaAsset[]>{const {data,error}=await connectClient().rpc("connect_public_media_by_slug",{p_public_slug:slug,p_unit_code:code});if(error)throw new Error(error.message);return (data??[]) as ConnectMediaAsset[];},
  async createLink(projectId:string,unitId:string|null):Promise<{url:string;id:string}>{const {data,error}=await connectClient().functions.invoke("broker-link",{body:{projectId,unitId}});if(error||!data?.url)throw new Error("Não foi possível criar o link. Verifique o acesso ao empreendimento.");return data as {url:string;id:string};},
  async links():Promise<BrokerShareLink[]>{const {data,error}=await connectClient().rpc("connect_broker_links");if(error)throw new Error(error.message);return (data??[]) as BrokerShareLink[];},
  async revoke(id:string,version:number):Promise<void>{const {error}=await connectClient().rpc("connect_revoke_broker_link",{p_id:id,p_expected_version:version});if(error)throw new Error(error.message);},
  async leads(organizationId:string|null):Promise<ConnectLead[]>{const {data,error}=await connectClient().rpc("connect_leads",{p_organization_id:organizationId});if(error)throw new Error(error.message);return (data??[]) as ConnectLead[];},
  async interest(source:{shareToken:string}|{publicSlug:string},payload:InterestPayload,idempotencyKey:string):Promise<{receiptId:string;status:string}>{const {data,error}=await connectClient().functions.invoke("public-interest",{body:{...source,...payload,website:""},headers:{"Idempotency-Key":idempotencyKey}});if(error||!data?.receiptId)throw new Error("Não foi possível registrar seu interesse. Tente novamente.");return data as {receiptId:string;status:string};},
};
