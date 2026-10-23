import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {sealMail} from '../supabase/functions/_shared/mail-crypto.mjs';
export async function fixture(db,storage){
 const ids=Object.fromEntries(['actor','reviewer','other','org','org2','project','lead','resource','mail','invitation','broker','access','link'].map(k=>[k,randomUUID()]));
 const canary='Synthetic-Privacy-'+randomUUID();const email=`${randomUUID()}@example.invalid`;
 for(const id of [ids.actor,ids.reviewer,ids.other,ids.broker])await db.query("insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values($1,'authenticated','authenticated',$2,now(),now(),now())",[id,`${id}@test.local`]);
 for(const [id,name] of [[ids.org,'Privacy synthetic'],[ids.org2,'Privacy other']])await db.query('insert into public.organizations(id,name,slug) values($1::uuid,$2,$1::text)',[id,name]);
 for(const [user,org] of [[ids.actor,ids.org],[ids.reviewer,ids.org],[ids.other,ids.org2]])await db.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'organization_admin')",[org,user]);
 await db.query("insert into public.projects(id,organization_id,name,slug,public_slug,city,state) values($1::uuid,$2,'Synthetic privacy',$1::text,$1::text,'São Paulo','SP')",[ids.project,ids.org]);
 await db.query("insert into public.leads(id,organization_id,project_id,buyer_name,contact_channel,contact_value,message,source,privacy_notice_version,next_action,closure_reason) values($1,$2,$3,$4,'email',$5,$4,'public','2026-10-23',$4,$4)",[ids.lead,ids.org,ids.project,canary,email]);
 await db.query('insert into private.privacy_fixtures values($1)',[ids.lead]);
 await db.query("insert into public.lead_activities(lead_id,activity_type,detail) values($1,'note_added',jsonb_build_object('note',$2::text,'oldValue',$2::text))",[ids.lead,canary]);
 await db.query("insert into public.audit_events(organization_id,actor_id,action,subject_type,subject_id,detail) values($1,$2,'crm.note_added','lead',$3,jsonb_build_object('copied',$4::text))",[ids.org,ids.actor,ids.lead,canary]);
 await db.query("insert into public.interest_idempotency(id,payload_hash,receipt_id) select gen_random_uuid(),repeat('b',64),receipt_id from public.leads where id=$1",[ids.lead]);
 await db.query("insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state) values($1,'Synthetic Broker',$2,'11999990000','12345','SP')",[ids.broker,`${ids.broker}@test.local`]);
 await db.query("insert into public.project_broker_access(id,organization_id,project_id,broker_user_id,status) values($1,$2,$3,$4,'revoked')",[ids.access,ids.org,ids.project,ids.broker]);
 await db.query("insert into public.broker_links(id,organization_id,project_id,broker_user_id,access_id,token_hash,status,expires_at) values($1,$2,$3,$4,$5,$6,'invalidated',now()-interval '1 day')",[ids.link,ids.org,ids.project,ids.broker,ids.access,randomBytes(32).toString('hex')]);
 await db.query("insert into public.lead_attributions(lead_id,broker_user_id,access_id,broker_link_id,access_status_at_submit) values($1,$2,$3,$4,'active')",[ids.lead,ids.broker,ids.access,ids.link]);
 const keys=JSON.parse(await readFile(new URL('../mail-worker/.local/keys.json',import.meta.url),'utf8'));const token=randomBytes(32).toString('hex');
 const payload=await sealMail({token},ids.mail,keys.kid,keys.publicKey);
 // Existing mail type, explicitly associated only for this disposable fixture; workers are paused by the runner.
 await db.query("insert into public.broker_invitations(id,organization_id,project_id,invited_email,token_hash,created_by,expires_at,operation_id) values($1,$2,$3,$4,$6,$5,now()+interval '2 days',gen_random_uuid())",[ids.invitation,ids.org,ids.project,email,ids.actor,createHash("sha256").update(token).digest("hex")]);
 await db.query("insert into private.mail_outbox(id,organization_id,invitation_id,payload) values($1,$2,$3,$4)",[ids.mail,ids.org,ids.invitation,payload]);
 await db.query("insert into private.privacy_resources(lead_id,kind,mail_id) values($1,'mail',$2)",[ids.lead,ids.mail]);
 const paths=[];
 for(const kind of ['storage','export','temporary']){
  const path=`${ids.lead}/${randomUUID()}`;paths.push(path);
  await storage.upload(path,canary);
  await db.query("insert into private.privacy_resources(lead_id,kind,bucket,path) values($1,$2,'connect-privacy-private',$3)",[ids.lead,kind,path]);
 }
 return {...ids,email,canary,paths};
}
