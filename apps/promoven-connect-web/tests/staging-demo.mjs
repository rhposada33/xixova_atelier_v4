// Reuses the existing transactional pilot fixture. Fixed local URLs; synthetic only.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../../../infra/promoven-connect/worker/package.json',import.meta.url))('sharp');
const started=performance.now();
const result=JSON.parse(execFileSync(process.execPath,['tests/pilot-seed.mjs'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').map(l=>l.split(/=(.*)/s)).filter(x=>x.length>1).map(([k,v])=>[k,v.replace(/^['"]|['"]$/g,'')]));
assert.equal(env.VITE_CONNECT_SUPABASE_URL,'http://127.0.0.1:56321');assert.equal(env.VITE_CONNECT_FUNCTIONS_URL,'http://127.0.0.1:56410');
const base=env.VITE_CONNECT_SUPABASE_URL,apikey=env.VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY;
const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey,'content-type':'application/json'},body:JSON.stringify({email:process.env.CONNECT_E2E_EMAIL,password:process.env.CONNECT_E2E_PASSWORD})});assert.equal(login.status,200);
const session=await login.json(),headers={apikey,authorization:`Bearer ${session.access_token}`,origin:'http://127.0.0.1:5178'};
const rpc=async(name,body)=>{const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.ok,true,`${name}: ${r.status}`);return r.json();};
const media=[];
for(const project of result.projects){
 const t=performance.now();
 await rpc('connect_update_project',{p_id:project.id,p_expected_version:2,p_data:{visibility:{description:false,unitFeatures:false,price:false,images:true,floorPlans:false,availability:false}}});
 const input=await sharp({create:{width:160,height:120,channels:3,background:{r:20,g:120,b:80}}}).png().withMetadata({density:144}).toBuffer();
 const form=new FormData();form.set('action','upload');form.set('projectId',project.id);form.set('role','cover');form.set('file',new Blob([input],{type:'image/png'}),'synthetic.png');
 const uploaded=await fetch(env.VITE_CONNECT_FUNCTIONS_URL+'/functions/v1/asset-media',{method:'POST',headers,body:form});assert.equal(uploaded.status,201);
 const asset=await uploaded.json();assert.notEqual(asset.checksum,createHash('sha256').update(input).digest('hex'));
 await rpc('connect_publish_media',{p_asset_id:asset.assetId,p_expected_version:asset.version,p_visible:true});
 const request=new FormData();request.set('action','url');request.set('assetId',asset.assetId);
 const access=await fetch(env.VITE_CONNECT_FUNCTIONS_URL+'/functions/v1/asset-media',{method:'POST',headers,body:request});assert.equal(access.status,200);
 const {url}=await access.json(),download=await fetch(url);assert.equal(download.status,200);
 const image=Buffer.from(await download.arrayBuffer()),metadata=await sharp(image).metadata();assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);assert.equal(createHash('sha256').update(image).digest('hex'),asset.checksum);
 media.push({projectId:project.id,assetId:asset.assetId,normalized:true,httpStatus:download.status,ms:Math.round(performance.now()-t)});
}
const analytics=await rpc('connect_crm_analytics',{p_filters:{organizationId:result.organizationId}});assert.equal(analytics.received,10);assert.equal(analytics.statuses.proposal,4);
const evidence={...result,checkpoint:'PC-07C.1',normalizedMedia:media,seconds:Math.round((performance.now()-started)/10)/100,limitations:['Broker identities/approvals are local fixtures; invitation/acceptance covered by separate browser regression.','Local automated timings, not human productivity or commercial performance.']};
writeFileSync('pilot-results/pc07c1.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify({status:'PASS',counts:evidence.counts,normalizedMedia:media.length,seconds:evidence.seconds}));
