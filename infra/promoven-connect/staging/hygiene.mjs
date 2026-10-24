import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {root} from './evidence.mjs';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const scope=['apps/promoven-connect-web','packages/connect-contracts','infra/promoven-connect'];
const files=git('ls-files','--cached','--others','--exclude-standard','--',...scope).trim().split('\n');
const forbidden=/(?:\.dump$|\.pem$|\.key$|\/\.local\/|\/artifacts\/|\/test-results\/|\/dist\/|\/node_modules\/|\/\.env(?:\.|$))/;
assert.ok(!files.some(p=>forbidden.test(p)&&!p.endsWith('.env.example')),'unsafe release path');
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(resolve(p,d.name)):[resolve(p,d.name)]);
const bundle=walk(resolve(root,'apps/promoven-connect-web/dist')).map(p=>readFileSync(p,'utf8')).join('\n');
const sources=files.filter(p=>existsSync(resolve(root,p))).map(p=>readFileSync(resolve(root,p),'utf8')).join('\n');
assert.doesNotMatch(bundle,/escobar|sb_secret_[a-zA-Z0-9_-]{24,}|-----BEGIN PRIVATE KEY-----/i);
assert.doesNotMatch(sources,/-----BEGIN (?:RSA |EC |)PRIVATE KEY-----\s+[A-Za-z0-9+/]{32,}/);
let compared=0;
for(const name of ['connect-proxy-local-1','supabase_edge_runtime_promoven_connect_local','connect-media-worker-local','connect-mail-worker-local-1']){
 const config=JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0];
 for(const entry of config.Config.Env){const i=entry.indexOf('='),key=entry.slice(0,i),value=entry.slice(i+1);if(/SECRET|PRIVATE_KEYS|SERVICE_ROLE_KEY|WORKER_TOKEN|RATE_TOKEN|AUTH_SERVICE_KEY/.test(key)&&value.length>=20){assert.ok(!bundle.includes(value)&&!sources.includes(value),'privileged value in release');compared++;}}
}
for(const path of ['infra/promoven-connect/staging/.local/probe.json','infra/promoven-connect/ops/artifacts/probe.dump','apps/promoven-connect-web/.env.local','apps/promoven-connect-web/test-results/probe.png'])assert.ok(git('check-ignore',path).trim());
git('diff','--check');
console.log(JSON.stringify({status:'PASS',scopedFiles:files.length,privilegedValuesCompared:compared,ignoredArtifacts:true,bundleEscobarAbsent:true}));
