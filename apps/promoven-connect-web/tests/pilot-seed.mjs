// Local synthetic fixture only. Never accepts a remote database URL.
import {performance} from 'node:perf_hooks';
import pg from 'pg';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import process from 'node:process';
const db=new pg.Client({host:'127.0.0.1',port:56322,user:'postgres',password:'postgres',database:'postgres'});
const slug=`pc07a-${Date.now()}`, timings=[];
const hash=s=>createHash('sha256').update(s).digest('hex');
async function timed(task,fn){const start=performance.now();const result=await fn();timings.push({task,ms:Math.round(performance.now()-start)});return result;}
async function rpc(name,args){const q=await db.query(`select to_jsonb(public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')})) as value`,args);return q.rows[0].value;}
async function actor(id){await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query('set local role authenticated');}
try{
 await db.connect();await db.query('begin');
 const admin=(await db.query('select id from auth.users where email=$1',[process.env.CONNECT_E2E_EMAIL])).rows[0]?.id;
 if(!admin)throw Error('Synthetic E2E administrator required');
 await actor(admin);
 const org=await timed('Provisionar organização via RPC',()=>rpc('connect_create_organization',['Incorporadora Sintética PC07A',slug]));
 const projects=[];
 for(let n=1;n<=2;n++){
  const project=await timed(`Criar empreendimento ${n}`,()=>rpc('connect_create_project',[JSON.stringify({organizationId:org.id,name:`Residencial Sintético ${n}`,slug:`${slug}-${n}`,publicSlug:`${slug}-${n}`,city:'São Paulo',state:'SP'})]));
  const rows=Array.from({length:25},(_,i)=>({code:`A${101+i}`,floor:Math.floor(i/5)+1,type:'Apartamento',bedrooms:2,bathrooms:2,parkingSpaces:1,expectedVersion:null,areaM2:'75.000',priceBRL:'500000.00',status:'available',published:true}));
  await timed(`Prévia e confirmação de 25 unidades no projeto ${n}`,async()=>{const preview=await rpc('connect_preview_inventory',[project.id,JSON.stringify(rows)]);await rpc('connect_confirm_inventory',[project.id,JSON.stringify(rows),preview.hash,randomUUID()]);});
  await rpc('connect_publish_project',[project.id,1,'published']);projects.push(project);
 }
 await timed('Preparar cinco identidades sintéticas e dez autorizações',async()=>{
  await db.query('reset role');
  for(let n=1;n<=5;n++){
   const broker=randomUUID(),email=`${slug}-broker-${n}@test.local`;
   await db.query("insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values($1,'authenticated','authenticated',$2,now(),now(),now())",[broker,email]);
   await db.query("insert into public.broker_profiles(user_id,display_name,professional_email,professional_phone,creci_number,creci_state,verification_status) values($1,$2,$3,'11999990000',$4,'SP','verified')",[broker,`Corretor Sintético ${n}`,email,`1000${n}`]);
   for(const project of projects){
    await db.query("insert into public.project_broker_access(organization_id,project_id,broker_user_id,status,verification_status,approved_by,activated_at) values($1,$2,$3,'active','verified',$4,now())",[org.id,project.id,broker,admin]);
    await rpc('connect_create_broker_link',[broker,project.id,null,hash(`${slug}-${project.id}-${n}`),new Date(Date.now()+86400000).toISOString()]);
   }
  }
 });
 await timed('Captar dez interesses atribuídos',async()=>{
  for(const project of projects)for(let n=1;n<=5;n++){
   const payload={buyerName:`Comprador Sintético ${n}`,contactChannel:'email',contactValue:`buyer-${n}@test.local`,privacyNoticeVersion:'2026-10-23'};
   await rpc('connect_submit_interest',[hash(`${slug}-${project.id}-${n}`),null,JSON.stringify(payload),randomUUID(),hash(JSON.stringify(payload))]);
  }
 });
 const leads=(await db.query('select id from public.leads where organization_id=$1 order by id',[org.id])).rows;
 await actor(admin);
 await timed('Registrar acompanhamentos e propostas',async()=>{
  for(let i=0;i<leads.length;i++){
   await rpc('connect_crm_change',[leads[i].id,1,'schedule',JSON.stringify({nextAction:'Retorno sintético',followUpAt:new Date(Date.now()+86400000).toISOString()})]);
   await rpc('connect_crm_change',[leads[i].id,2,'status',JSON.stringify({status:i<4?'proposal':'contacted'})]);
  }
 });
 const analytics=await timed('Consultar analytics',()=>rpc('connect_crm_analytics',[JSON.stringify({organizationId:org.id})]));
 const progress=await rpc('connect_onboarding',[org.id]);
 if(progress.projects.length!==2||progress.projects.reduce((sum,p)=>sum+p.units,0)!==50||analytics.received!==10||analytics.statuses.proposal!==4)throw Error('Pilot count mismatch');
 await db.query('commit');
 const result={synthetic:true,organizationId:org.id,organizationName:org.name,slug,projects:projects.map(p=>({id:p.id,publicSlug:p.public_slug})),counts:{projects:2,units:50,brokers:5,links:10,leads:10,followUps:10,proposals:4},timings,errors:0,limitations:['Auth identities and broker approvals are fixtures; Mailpit invitation flow is covered separately by E2E.','Timing is local RPC automation, not human task time.','No media fabricated; upload and publication covered by browser regression.']};
 await mkdir('pilot-results',{recursive:true});await writeFile('pilot-results/pc07a.json',JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result,null,2)+'\n');
}catch(error){await db.query('rollback');throw error;}finally{await db.end();}
