import {execFileSync} from 'node:child_process';
import {readFileSync, existsSync, realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative, sep} from 'node:path';
import {validateTarget} from './target.mjs';
export const root=resolve(new URL('../../../',import.meta.url).pathname);
export const sha256=value=>createHash('sha256').update(value).digest('hex');
function sourceBytes(base,name){
 const bytes=readFileSync(resolve(base,name));
 if(name==='infra/promoven-connect/staging/readiness.json'){
  const {approvals,evidence,...configuration}=JSON.parse(bytes);
  return JSON.stringify(configuration);
 }
 return bytes;
}
export function sourceDigest(base=root){
  const names=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard','--',
    'apps/promoven-connect-web','packages/connect-contracts','infra/promoven-connect'],{cwd:base}).toString().split('\0').filter(Boolean);
  return sha256([...new Set(names)].sort().filter(name=>existsSync(resolve(base,name))).map(name=>name+'\0'+sha256(sourceBytes(base,name))).join('\n'));
}
export function verifyEvidence(record,{base=root,digest,scope,target,now=Date.now()}={}){
  if(!record||record.scope!==scope||record.target!==target||record.sourceDigest!==digest)return false;
  const age=now-Date.parse(record.completedAt);
  if(!Number.isFinite(age)||age<0||age>7*86400000)return false;
  try{
    const file=realpathSync(resolve(base,record.path)),rel=relative(realpathSync(base),file);
    if(rel.startsWith('..'+sep)||rel==='..'||!rel.startsWith('infra/promoven-connect/staging/.local/'))return false;
    const data=readFileSync(file);
    if(sha256(data)!==record.sha256)return false;
    const result=JSON.parse(data);
    if(result.log){
      const log=realpathSync(resolve(base,result.log));
      if(!relative(realpathSync(base),log).startsWith('infra/promoven-connect/staging/.local/')||sha256(readFileSync(log))!==result.logSha256)return false;
    }
    return result.status==='PASS'&&result.scope===scope&&result.target===target&&result.sourceDigest===digest&&result.check===record.check&&result.completedAt===record.completedAt;
  }catch{return false;}
}
export const localChecks=['migrations','sqlRls','unitContracts','proxyHttp','mailHttp','webBuild','webE2e','concurrency','syntheticDemo','recovery','hygiene'];
export const stagingChecks=['restrictedAuth','syntheticOnly','tenantIsolation','privateProxy','tls','backupRemote','monitoring','captureRestricted','externalEmailDisabled','costsVerified','cspCors'];
export const productionChecks=['privacyPolicy','legalResponsibilities','retentionPolicy','subjectRights','smtpDelivery','mailWebhooks','backupTreatment','supportOwner','incidentPlan','commercialApproval','fullAnonymization'];
export function evaluateRelease(state,options){
  const {digest,head,now=Date.now()}=options;
  const evidence=state.evidence??[];
  const missing=(checks,scope,target)=>checks.filter(check=>!evidence.some(r=>r.check===check&&verifyEvidence(r,{...options,scope,target})));
  const approved=environment=>{
    const a=state.approvals?.[environment],target=state.targets?.[environment];
    const descriptor=state.approvedTargets?.find(t=>t.id===target&&t.environment===environment);
    return !!(validateTarget(descriptor,state.approvedTargets)&&target&&a?.approved===true&&a.environment===environment&&a.target===target&&a.head===head&&a.sourceDigest===digest&&
      typeof a.userAuthorizationReference==='string'&&a.userAuthorizationReference.trim().length>=12&&
      Date.parse(a.approvedAt)<=now&&Date.parse(a.expiresAt)>now&&Date.parse(a.expiresAt)-Date.parse(a.approvedAt)<=7*86400000);
  };
  const local=missing(localChecks,'local','promoven_connect_local');
  const staging=[...local,...missing(stagingChecks,'remote',state.targets?.staging)];
  const production=[...local,...missing([...stagingChecks.filter(c=>!['syntheticOnly','captureRestricted','externalEmailDisabled'].includes(c)),...productionChecks],'remote',state.targets?.production)];
  if(!approved('staging'))staging.push('explicitStagingApproval');
  if(!approved('production'))production.push('explicitProductionApproval');
  const syntheticStagingReady=staging.length===0,productionReady=production.length===0;
  return {syntheticStagingReady,productionReady,realBuyerDataAllowed:productionReady&&state.approvals?.production?.realBuyerDataAuthorized===true,
    deploymentAllowed:{staging:syntheticStagingReady,production:productionReady},blocked:{staging,production},localEvidenceComplete:local.length===0};
}
