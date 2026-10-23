import {test} from 'node:test';import assert from 'node:assert/strict';import {persistNormalized} from '../supabase/functions/_shared/media-persistence.mjs';
for(const failure of ['upload','finalize','throw','cleanup'])test(`normalized persistence compensates ${failure} failure`,async()=>{
 const calls=[];const storage={upload:async(path,bytes,options)=>{calls.push(['upload',options]);if(failure==='throw')throw Error('private provider detail');return {error:failure!=='finalize'};},remove:async()=>{calls.push(['remove']);return {error:failure==='cleanup'};}};
 const user={rpc:async(name)=>{calls.push([name]);return {error:name==='connect_finish_media'&&failure==='finalize'};}};
 const result=await persistNormalized({user,admin:{storage:{from:()=>storage}},bucket:'connect-media-private',asset:{id:'synthetic',storage_path:'synthetic/path',version:1},bytes:new Uint8Array([1])});
 assert.ok(result.error);assert.ok(calls.some(c=>c[0]==='remove'));assert.ok(calls.some(c=>c[0]==='connect_delete_media'));assert.equal(calls[0][1].contentType,'image/png');assert.equal(calls[0][1].upsert,false);if(failure==='cleanup')assert.equal(result.error,'storage_cleanup_pending');
});
