// No writes, network calls, installs, migrations, deploys or resource mutations.
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {root,sourceDigest,evaluateRelease} from './evidence.mjs';
import {localTarget,validateTarget,validatePublicEnvironment} from './target.mjs';
const checks=[];
const check=(name,ok,detail='',missing='FAIL')=>checks.push({name,status:ok?'PASS':missing,detail});
const read=p=>readFileSync(resolve(root,p),'utf8');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const infra='infra/promoven-connect/',web='apps/promoven-connect-web/';
try{
  check('repository',existsSync(resolve(root,'AGENTS.md'))&&JSON.parse(read(web+'package.json')).name==='promoven-connect-web');
  const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--target'))throw Error('unsupported_arguments');
  const state=JSON.parse(read(infra+'staging/readiness.json'));
  const target=args.length?JSON.parse(readFileSync(resolve(args[1]),'utf8')):localTarget;
  check('approvedTarget',validateTarget(target,state.approvedTargets));
  if(checks.at(-1).status!=='PASS')throw Error('target_rejected');
  const head=git('rev-parse','HEAD'),digest=sourceDigest();
  check('git',true,JSON.stringify({branch:git('branch','--show-current'),head,dirty:!!git('status','--porcelain')}));
  const major=Number(process.versions.node.split('.')[0]);
  check('nodeVersion',(major===20&&Number(process.versions.node.split('.')[1])>=19)||(major===22&&Number(process.versions.node.split('.')[1])>=12)||major>=24,process.versions.node);
  let cli='';try{cli=execFileSync(process.env.CONNECT_SUPABASE_CLI??'supabase',['--version'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{/* Missing CLI. */}
  check('supabaseCli',/^2\.\d+\.\d+$/.test(cli),cli||'installed CLI path required; never auto-installed');
  for(const pkg of [web,'packages/connect-contracts/',infra+'worker/',infra+'mail-worker/',infra+'privacy-worker/']){
    let valid=false;try{execFileSync('npm',['ls','--omit=optional','--depth=0','--json'],{cwd:resolve(root,pkg),stdio:['ignore','pipe','pipe']});valid=true;}catch{/* Only names, never npm diagnostics. */}
    check('dependencies:'+pkg,valid&&existsSync(resolve(root,pkg+'package-lock.json')));
  }
  const migrations=readdirSync(resolve(root,infra+'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
  check('migrationSequence',migrations.length>=34&&migrations.every(f=>/^\d{14}_[a-z0-9_]+\.sql$/.test(f))&&new Set(migrations.map(f=>f.slice(0,14))).size===migrations.length,`${migrations.length} files; execution requires evidence`);
  const config=read(infra+'supabase/config.toml');
  check('authConfiguration',/project_id = "promoven_connect_local"/.test(config)&&/enable_signup = false/.test(config)&&/enable_confirmations = true/.test(config));
  check('authRedirects',/site_url = "http:\/\/127.0.0.1:5178"/.test(config)&&!config.includes('https://'),'Local redirects; remote export required');
  const env={};for(const line of read(web+'.env.local').split('\n')){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
  for(const [key,value] of Object.entries(process.env))if(key.startsWith('VITE_'))env[key]=value;
  check('publicVariables',validatePublicEnvironment(env,target));
  check('edgeFunctions', ['public-interest','broker-invite','broker-link','asset-media'].every(n=>existsSync(resolve(root,infra+`supabase/functions/${n}/index.ts`))));
  check('privateProxyContract',read(infra+'proxy/proxy.mjs').includes('sharedRate')&&read(infra+'proxy/proxy.mjs').includes('req.socket.remoteAddress'));
  check('workers', ['worker/Dockerfile','mail-worker/Dockerfile','privacy-worker/main.mjs'].every(n=>existsSync(resolve(root,infra+n))));
  check('smtpMode',target.environment==='local','Mailpit only; remote SMTP not validated', 'BLOCKED');
  check('cors',read(infra+'proxy/proxy.mjs').includes('req.headers.origin!==origin'), 'Runtime HTTP evidence required');
  const headers=JSON.parse(read(web+'vercel.json')).headers.flatMap(h=>h.headers);
  check('cspRemote',headers.some(h=>h.key.toLowerCase()==='content-security-policy'),'Exact remote CSP + browser enforcement not yet validated','BLOCKED');
  check('publicRoutes',read(web+'src/main.tsx').includes('/s/')&&read(infra+'proxy/proxy.mjs').includes('public-interest'));
  check('runbooks',['PRIVACY_RUNBOOK','DEPLOYMENT_PLAN','REMOTE_ARCHITECTURE','COST_MATRIX','STAGING_APPROVAL'].every(n=>existsSync(resolve(root,`docs/PROMOVEN_CONNECT_${n}.md`))));
  const files=git('ls-files','--cached','--others','--exclude-standard','--',web,'packages/connect-contracts',infra).split('\n').filter(Boolean);
  const suspicious=files.filter(p=>/(?:\.dump$|\.env(?:\.|$)|\/\.local\/|\/artifacts\/|\/test-results\/|\.pem$|\.key$)/.test(p)&&!p.endsWith('.env.example'));
  check('gitArtifacts',suspicious.length===0,`${suspicious.length} unsafe tracked/unignored paths`);
  const literalSecret=/-----BEGIN (?:RSA |EC |)PRIVATE KEY-----\s+[A-Za-z0-9+/]{32,}|sb_secret_[A-Za-z0-9_-]{24,}/;
  check('literalSecrets',!files.some(p=>existsSync(resolve(root,p))&&literalSecret.test(read(p))));
  const dist=resolve(root,web+'dist');
  const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(resolve(p,x.name)):[resolve(p,x.name)]);
  const bundle=existsSync(dist)?walk(dist).map(p=>readFileSync(p,'utf8')).join('\n'):'';
  check('bundleIsolation',!!bundle&&!/escobar|sb_secret_[A-Za-z0-9_-]{12,}|-----BEGIN PRIVATE KEY-----/i.test(bundle),'Build/reproducibility require fresh evidence');
  const index=resolve(root,infra+'staging/.local/evidence-index.json');
  if(existsSync(index))state.evidence=[...(state.evidence??[]),...JSON.parse(readFileSync(index))];
  const release=evaluateRelease(state,{digest,head});
  for(const name of ['migrations','sqlRls','unitContracts','proxyHttp','mailHttp','webBuild','webE2e','concurrency','syntheticDemo','recovery','hygiene']){
    check('evidence:'+name,!release.blocked.staging.includes(name),'Fresh source-bound local evidence', 'NOT RUN');
  }
  check('runtimeSecrets',release.localEvidenceComplete,'Authenticated HTTP exercises validate local secret injection; remote provisioning pending','NOT RUN');
  console.log(JSON.stringify({mode:'read-only',scope:target.environment,sourceDigest:digest,checks,release},null,2));
  if(checks.some(c=>c.status!=='PASS'))process.exitCode=1;
}catch(error){console.log(JSON.stringify({mode:'read-only',status:'FAIL',reason:['unsupported_arguments','target_rejected'].includes(error.message)?error.message:'preflight_incomplete',checks}));process.exitCode=1;}
