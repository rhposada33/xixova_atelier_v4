import pg from "pg";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";

const config={host:"127.0.0.1",port:56322,user:"postgres",password:"postgres",database:"postgres"};
const setup=new pg.Client(config), revoker=new pg.Client(config), submitter=new pg.Client(config);
const id={admin:randomUUID(),broker:randomUUID(),org:randomUUID(),project:randomUUID(),access:randomUUID(),link:randomUUID(),operation:randomUUID()};
const slug=`pc05-race-${Date.now()}`;
let seeded=false;
try{
  await Promise.all([setup.connect(),revoker.connect(),submitter.connect()]);
  await setup.query("begin");
  await setup.query("insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values($1,'authenticated','authenticated',$2,now(),now(),now()),($3,'authenticated','authenticated',$4,now(),now(),now())",[id.admin,`${slug}-admin@test.local`,id.broker,`${slug}-broker@test.local`]);
  await setup.query("insert into public.organizations(id,name,slug) values($1,'PC05 Race',$2)",[id.org,slug]);
  await setup.query("insert into public.organization_members(organization_id,user_id,role) values($1,$2,'organization_admin')",[id.org,id.admin]);
  await setup.query("insert into public.projects(id,organization_id,name,slug,public_slug,city,state,status) values($1,$2,'PC05 Race',$3,$3,'São Paulo','SP','published')",[id.project,id.org,slug]);
  await setup.query("insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state,verification_status) values($1,'Race Broker',$2,'11999990000','12345','SP','verified')",[id.broker,`${slug}-broker@test.local`]);
  await setup.query("insert into public.project_broker_access(id,organization_id,project_id,broker_user_id,status,verification_status,approved_by,activated_at) values($1,$2,$3,$4,'active','verified',$5,now())",[id.access,id.org,id.project,id.broker,id.admin]);
  await setup.query("insert into public.broker_links(id,organization_id,project_id,broker_user_id,access_id,token_hash,expires_at) values($1,$2,$3,$4,$5,$6,now()+interval '1 day')",[id.link,id.org,id.project,id.broker,id.access,"a".repeat(64)]);
  await setup.query("commit");seeded=true;
  await revoker.query("begin");
  await revoker.query("update public.project_broker_access set status='suspended',version=version+1 where id=$1",[id.access]);
  await submitter.query("begin");
  await submitter.query("set local role service_role");
  const submission=submitter.query("select public.connect_submit_interest($1,null,$2::jsonb,$3,$4)",["a".repeat(64),JSON.stringify({buyerName:"Concurrent Buyer",contactChannel:"email",contactValue:"race@test.local",privacyNoticeVersion:"2026-10-23"}),id.operation,"b".repeat(64)]).then(()=>"accepted",e=>e.code);
  let waiting=false;
  for(let i=0;i<40;i++){
    const state=await setup.query("select count(*)::int as n from pg_stat_activity where pid=$1 and wait_event_type='Lock'",[submitter.processID]);
    if(state.rows[0].n===1){waiting=true;break;}
    await delay(25);
  }
  if(!waiting)throw new Error("Submission did not reach the access lock");
  await revoker.query("commit");
  const result=await submission;
  await submitter.query("rollback");
  const count=await setup.query("select count(*)::int as n from public.leads where project_id=$1",[id.project]);
  if(result!=="P0002"||count.rows[0].n!==0)throw new Error(`Concurrent revoke invariant failed: ${result}, ${count.rows[0].n} leads`);
  process.stdout.write("PASS concurrent access suspension rejects attributed lead without deadlock\n");
}finally{
  await revoker.query("rollback").catch(()=>{});await submitter.query("rollback").catch(()=>{});
  if(seeded){await setup.query("begin");await setup.query("delete from public.audit_events where organization_id=$1",[id.org]);await setup.query("delete from public.broker_links where id=$1",[id.link]);await setup.query("delete from public.project_broker_access where id=$1",[id.access]);await setup.query("delete from public.broker_profiles where user_id=$1",[id.broker]);await setup.query("delete from public.projects where id=$1",[id.project]);await setup.query("delete from public.organization_members where organization_id=$1",[id.org]);await setup.query("delete from public.organizations where id=$1",[id.org]);await setup.query("delete from public.profiles where user_id in ($1,$2)",[id.admin,id.broker]);await setup.query("delete from auth.users where id in ($1,$2)",[id.admin,id.broker]);await setup.query("commit");}
  await Promise.all([setup.end().catch(()=>{}),revoker.end().catch(()=>{}),submitter.end().catch(()=>{})]);
}
