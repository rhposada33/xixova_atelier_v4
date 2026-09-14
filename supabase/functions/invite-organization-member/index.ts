import {createClient} from 'npm:@supabase/supabase-js@2';

const cors=(origin:string)=>({'access-control-allow-origin':origin,'access-control-allow-headers':'authorization,content-type,x-idempotency-key','access-control-allow-methods':'POST,OPTIONS','access-control-max-age':'600','vary':'origin'});
const json=(status:number,body:Record<string,unknown>,origin:string)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...cors(origin)}});
const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const digest=async(value:string)=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))));

Deno.serve(async request=>{
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'http://127.0.0.1:5173,http://localhost:5173').split(',');
  const origin=request.headers.get('origin')??allowed[0];
  if(!allowed.includes(origin))return json(403,{code:'forbidden'},allowed[0]);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='POST')return json(405,{code:'method_not_allowed'},origin);
  const authorization=request.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return json(401,{code:'forbidden'},origin);
  try{
    const url=Deno.env.get('SUPABASE_URL')!;const anon=Deno.env.get('SUPABASE_ANON_KEY')!;const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await caller.auth.getUser();if(userError||!user)return json(401,{code:'forbidden'},origin);
    const body=await request.json() as {organizationId?:string;email?:string;role?:string;operationId?:string;invitationId?:string;expectedVersion?:number};
    const token=base64(crypto.getRandomValues(new Uint8Array(32)));const tokenHash=await digest(token);
    const prepared=body.invitationId
      ?await caller.rpc('admin_retry_invitation',{p_invitation_id:body.invitationId,p_expected_version:body.expectedVersion,p_token_hash:tokenHash,p_operation_id:body.operationId})
      :await caller.rpc('admin_prepare_invitation',{p_organization_id:body.organizationId,p_email:body.email,p_role:body.role,p_token_hash:tokenHash,p_operation_id:body.operationId});
    const {data:invitation,error:prepareError}=prepared;
    if(prepareError)return json(400,{code:'request_rejected',details:prepareError.details},origin);
    if(invitation.status!=='pending_delivery')return json(200,{status:invitation.status,invitationId:invitation.id},origin);
    const {data:claimed,error:claimError}=await admin.rpc('admin_claim_invitation_delivery',{p_invitation_id:invitation.id,p_actor_id:user.id});
    if(claimError)throw claimError;
    if(!claimed)return json(202,{status:'pending_delivery',invitationId:invitation.id,verificationRequired:true},origin);
    const redirectTo=`${origin}/accept-invitation?token=${encodeURIComponent(token)}`;
    let exists=false;let page=1;
    do{const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});if(error)throw error;exists=data.users.some(item=>item.email?.toLowerCase()===String(body.email).trim().toLowerCase());if(exists||data.users.length<1000)break;page++;}while(page<10);
    let deliveryError:Error|null=null;
    if(exists){const result=await admin.auth.signInWithOtp({email:String(body.email),options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});deliveryError=result.error;}
    else{const result=await admin.auth.admin.inviteUserByEmail(String(body.email),{redirectTo});deliveryError=result.error;}
    const safeCode=deliveryError?'auth_delivery_failed':null;
    const {error:markError}=await admin.rpc('admin_mark_invitation_delivery',{p_invitation_id:invitation.id,p_success:!deliveryError,p_error_code:safeCode,p_actor_id:user.id});
    if(markError)throw markError;
    return json(202,{status:deliveryError?'delivery_failed':'sent',invitationId:invitation.id},origin);
  }catch(error){console.error('invitation_delivery_error',{name:error instanceof Error?error.name:'unknown'});return json(500,{code:'delivery_unknown'},origin);}
});
