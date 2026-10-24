import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {localTarget,validateTarget,validatePublicEnvironment} from './target.mjs';
import {evaluateRelease,localChecks,stagingChecks,productionChecks,sha256,verifyEvidence} from './evidence.mjs';

test('targets reject cross-product, unknown refs, changed hosts and HTTP remotely',()=>{
 assert.equal(validateTarget(localTarget),true);
 for(const t of [{...localTarget,id:'escobar'},{...localTarget,supabaseUrl:'http://127.0.0.1:54321'},{...localTarget,environment:'staging',id:'connect-stage'},{...localTarget,supabaseUrl:'https://unknown.supabase.co'}])assert.equal(validateTarget(t),false);
 const remote={...localTarget,environment:'staging',id:'connect-stage',appOrigin:'https://connect-stage.promoven.online',supabaseUrl:'https://api-stage.promoven.online',functionsUrl:'https://proxy-stage.promoven.online'};
 assert.equal(validateTarget(remote,[remote]),true);
 assert.equal(validateTarget({...remote,supabaseUrl:'https://other.supabase.co'},[remote]),false);
 assert.equal(validateTarget({...remote,appOrigin:'http://connect-stage.promoven.online'},[{...remote,appOrigin:'http://connect-stage.promoven.online'}]),false);
});
test('public variables reject privileged keys, extra VITE secrets and missing proxy',()=>{
 const env={VITE_CONNECT_ENV:'local',VITE_CONNECT_SUPABASE_URL:localTarget.supabaseUrl,VITE_CONNECT_FUNCTIONS_URL:localTarget.functionsUrl,VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'};
 assert.equal(validatePublicEnvironment(env,localTarget),true);
 assert.equal(validatePublicEnvironment({...env,VITE_SERVICE_ROLE:'synthetic'},localTarget),false);
 assert.equal(validatePublicEnvironment({...env,VITE_CONNECT_FUNCTIONS_URL:''},localTarget),false);
 const jwt='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';
 assert.equal(validatePublicEnvironment({...env,VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY:jwt},localTarget),false);
});
test('gates separate synthetic vs production, verify evidence and never infer approval',()=>{
 const base=mkdtempSync(resolve(tmpdir(),'connect-gate-')),dir='infra/promoven-connect/staging/.local/';mkdirSync(resolve(base,dir),{recursive:true});
 const now=Date.now(),digest='synthetic-digest',head='synthetic-head',options={base,digest,head,now};
 const state={targets:{staging:'connect-stage',production:'connect-prod'},approvals:{},evidence:[],approvedTargets:['staging','production'].map(environment=>({id:environment==='staging'?'connect-stage':'connect-prod',environment,appOrigin:`https://${environment}.promoven.online`,supabaseUrl:`https://api-${environment}.promoven.online`,functionsUrl:`https://proxy-${environment}.promoven.online`}))};
 let serial=0;
 const record=(check,scope,target)=>{
  const path=dir+`${serial++}.json`,completedAt=new Date(now).toISOString();
  const value={check,scope,target,sourceDigest:digest,completedAt,status:'PASS'},body=JSON.stringify(value);
  writeFileSync(resolve(base,path),body);return {...value,path,sha256:sha256(body)};
 };
 const approve=(environment)=>({approved:true,environment,target:state.targets[environment],sourceDigest:digest,head,userAuthorizationReference:'synthetic-test-only-reference',approvedAt:new Date(now).toISOString(),expiresAt:new Date(now+10000).toISOString()});
 try{
  for(const c of localChecks)state.evidence.push(record(c,'local','promoven_connect_local'));
  for(const c of stagingChecks)state.evidence.push(record(c,'remote','connect-stage'));
  assert.equal(evaluateRelease(state,options).syntheticStagingReady,false);
  state.approvals.staging=approve('staging');
  let r=evaluateRelease(state,options);assert.equal(r.syntheticStagingReady,true);assert.equal(r.productionReady,false);assert.equal(r.realBuyerDataAllowed,false);
  state.approvals.staging.head='stale';assert.equal(evaluateRelease(state,options).syntheticStagingReady,false);state.approvals.staging=approve('staging');
  assert.equal(evaluateRelease(state,{...options,digest:'changed'}).syntheticStagingReady,false);
  assert.equal(evaluateRelease(state,{...options,now:now+8*86400000}).syntheticStagingReady,false);
  const e=state.evidence[0];writeFileSync(resolve(base,e.path),'{}');assert.equal(verifyEvidence(e,{...options,scope:e.scope,target:e.target}),false);state.evidence[0]=record(e.check,e.scope,e.target);
  assert.equal(verifyEvidence({...e,path:'../../etc/passwd'},{...options,scope:e.scope,target:e.target}),false);
  for(const c of [...stagingChecks,...productionChecks])state.evidence.push(record(c,'remote','connect-prod'));
  state.approvals.production=approve('production');r=evaluateRelease(state,options);assert.equal(r.productionReady,true);assert.equal(r.realBuyerDataAllowed,false);
  state.approvals.production.realBuyerDataAuthorized=true;assert.equal(evaluateRelease(state,options).realBuyerDataAllowed,true);
 }finally{rmSync(base,{recursive:true,force:true});}
});
