import {execFileSync} from 'node:child_process';
import {mkdtempSync,cpSync,readFileSync,readdirSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import assert from 'node:assert/strict';
import {root,sha256} from './evidence.mjs';
import {localTarget,validatePublicEnvironment} from './target.mjs';
const packages=['packages/connect-contracts','apps/promoven-connect-web','infra/promoven-connect/worker','infra/promoven-connect/mail-worker','infra/promoven-connect/privacy-worker'];
const env=Object.fromEntries(readFileSync(resolve(root,'apps/promoven-connect-web/.env.local'),'utf8').split('\n').flatMap(line=>{const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);return m?[[m[1],m[2].replace(/^['"]|['"]$/g,'')]]:[];}));
assert.equal(validatePublicEnvironment(env,localTarget),true);
mkdirSync(resolve(root,'infra/promoven-connect/staging/.local'),{recursive:true});
const temp=mkdtempSync(resolve(root,'infra/promoven-connect/staging/.local/build-'));
// Only the validated public configuration enters Vite, including inherited env.
const buildEnv={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('VITE_'))),...env};
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,env:buildEnv,stdio:['ignore','pipe','pipe']});
const hashTree=path=>{
 const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(resolve(p,d.name)):[resolve(p,d.name)]);
 return walk(path).sort().map(p=>[relative(path,p),sha256(readFileSync(p))]);
};
try{
 for(const pkg of packages){
  cpSync(resolve(root,pkg),resolve(temp,pkg),{recursive:true,filter:p=>!/(?:^|\/)(node_modules|dist|test-results|playwright-report|pilot-results|media-results|broker-recheck|\.local)(\/|$)/.test(relative(resolve(root,pkg),p))&&!/\.env/.test(relative(resolve(root,pkg),p))});
  assert.equal(existsSync(resolve(temp,pkg,'package-lock.json')),true);
  run('npm',['ci','--offline','--no-audit','--no-fund'],resolve(temp,pkg));
 }
 run('npm',['run','build'],resolve(root,packages[1]));
 run('npm',['run','build'],resolve(temp,packages[1]));
 const artifacts=hashTree(resolve(root,packages[1],'dist'));
 assert.deepEqual(hashTree(resolve(temp,packages[1],'dist')),artifacts);
 console.log(JSON.stringify({status:'PASS',frozenOfflineInstalls:packages.length,identicalBuilds:2,artifacts}));
}finally{rmSync(temp,{recursive:true,force:true});}
