// Explicit --execute-local required. No remote target/command accepted.
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,openSync,closeSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {root,sha256,sourceDigest} from './evidence.mjs';
const base='infra/promoven-connect/',web='apps/promoven-connect-web';
const groups={
 migrations:[['python3',[base+'staging/migrations-local.py']]],
 sqlRls:[['SUPABASE',['test','db','--workdir',base]]],
 unitContracts:[...['worker','privacy-worker','mail-worker'].map(p=>['npm',['--prefix',base+p,'test']]),['node',['--test',base+'staging/preflight.test.mjs',base+'ops/media-persistence.test.mjs',base+'ops/operations.test.mjs',base+'proxy/proxy.test.mjs']],['npm',['--prefix','packages/connect-contracts','test']],['npm',['--prefix','packages/connect-contracts','run','typecheck']],['npm',['--prefix',web,'run','lint']],['npm',['--prefix',web,'run','test:unit']]],
 proxyHttp:[['node',[base+'proxy/real-integration.mjs']]],
 mailHttp:[['node',[base+'mail-worker/real-integration.mjs']]],
 webBuild:[['node',[base+'staging/build-reproducible.mjs']]],
 syntheticDemo:[['node',['tests/staging-demo.mjs'],web]],
 webE2e:[['npm',['run','test:e2e','--','--reporter=line'],web]],
 concurrency:['link','crm','media-quota'].map(n=>['node',[`tests/${n}-concurrency.mjs`],web]),
 recovery:[['bash',[base+'ops/recovery-local.sh']]],
 hygiene:[['node',[base+'staging/hygiene.mjs']]],
};
const args=process.argv.slice(2);
if(!args.length){console.log(JSON.stringify({mode:'dry-run',scope:'fixed local Connect only',checks:Object.keys(groups),execute:'node infra/promoven-connect/staging/validate.mjs --execute-local [check ...]'}));process.exit(0);}
if(args[0]!=='--execute-local'||args.slice(1).some(x=>!groups[x]))throw Error('unsupported_arguments');
const selected=args.length>1?args.slice(1):Object.keys(groups),digest=sourceDigest();
const env={...process.env,CONNECT_PRIVACY_RECOVERY:'1'};
for(const line of readFileSync(resolve(root,web,'.env.e2e.local'),'utf8').split('\n')){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
if(!env.CONNECT_SUPABASE_CLI||!existsSync(env.CONNECT_SUPABASE_CLI))throw Error('installed_CONNECT_SUPABASE_CLI_required');
const dir=resolve(root,base+'staging/.local'),indexPath=resolve(dir,'evidence-index.json');mkdirSync(dir,{recursive:true,mode:0o700});
let index=existsSync(indexPath)?JSON.parse(readFileSync(indexPath)):[];
let failed=false;
for(const check of selected){
 const start=performance.now(),log=resolve(dir,check+'.log'),fd=openSync(log,'w',0o600);let ok=true;
 try{for(let [cmd,argv,cwd] of groups[check]){if(cmd==='SUPABASE')cmd=env.CONNECT_SUPABASE_CLI;const p=spawnSync(cmd,argv,{cwd:resolve(root,cwd??'.'),env,stdio:['ignore',fd,fd],timeout:300000});if(p.status!==0){ok=false;break;}}}finally{closeSync(fd);}
 const output=readFileSync(log,'utf8');
 if(check==='webE2e'&&(!/\d+ passed/.test(output)||/\d+ skipped/.test(output)))ok=false;
 if(check==='sqlRls'&&!/All tests successful/.test(output))ok=false;
 if(sourceDigest()!==digest)ok=false;
 const completedAt=new Date().toISOString(),status=ok?'PASS':'FAIL';
 const report={check,status,scope:'local',target:'promoven_connect_local',sourceDigest:digest,completedAt,seconds:Math.round((performance.now()-start)/10)/100,log:relative(root,log),logSha256:sha256(output)};
 const path=resolve(dir,check+'.json'),body=JSON.stringify(report,null,2)+'\n';writeFileSync(path,body,{mode:0o600});
 index=index.filter(r=>r.check!==check);index.push({...report,path:relative(root,path),sha256:sha256(body)});writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({check,status,seconds:report.seconds,log:report.log}));
 if(!ok){failed=true;break;}
}
if(failed)process.exitCode=1;
