import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';import {sealMail} from '../supabase/functions/_shared/mail-crypto.mjs';
const sql=q=>execFileSync('docker',['exec','-i','supabase_db_promoven_connect_local','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']});
if(process.argv[2]==='--cancel'){
 const {id,actor}=JSON.parse(readFileSync(process.argv[3],'utf8'));if(!/^[0-9a-f-]{36}$/.test(id)||!/^[0-9a-f-]{36}$/.test(actor))throw Error('invalid_fixture');
 sql(`update public.broker_invitations set status='cancelled',version=version+1 where operation_id='${id}' and created_by='${actor}' and status='pending';`);
}else{
 const keys=JSON.parse(readFileSync(new URL('.local/keys.json',import.meta.url),'utf8'));const id=randomUUID(),actor=randomUUID(),org=randomUUID(),project=randomUUID(),token=createHash('sha256').update(randomUUID()).digest('hex');const payload=await sealMail({token},id,keys.kid,keys.publicKey);
 sql(`begin;insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at) values('${actor}','authenticated','authenticated','restore-${actor}@test.local',now(),now(),now());insert into public.organizations(id,name,slug) values('${org}','Mail Restore Synthetic','mail-restore-${org}');insert into public.organization_members(organization_id,user_id,role) values('${org}','${actor}','organization_admin');insert into public.projects(id,organization_id,name,slug,public_slug,city,state) values('${project}','${org}','Mail Restore Synthetic','mail-restore-${project}','mail-restore-${project}','São Paulo','SP');select public.connect_queue_invitation('${actor}','create','${project}','restore-recipient-${id}@test.local',null,null,'${createHash('sha256').update(token).digest('hex')}','${id}',$payload$${JSON.stringify(payload)}$payload$);commit;`);
 console.log(JSON.stringify({id,actor,org,project}));
}
