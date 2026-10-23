/** Called only after server normalization and an authorized media reservation. */
export async function persistNormalized({user,admin,bucket,asset,bytes}){
 const storage=admin.storage.from(bucket);
 async function compensate(){
  const results=await Promise.allSettled([storage.remove([asset.storage_path]),user.rpc('connect_delete_media',{p_asset_id:asset.id,p_expected_version:asset.version})]);
  return results.every(r=>r.status==='fulfilled'&&!r.value.error);
 }
 try{
  const uploaded=await storage.upload(asset.storage_path,bytes,{contentType:'image/png',upsert:false,cacheControl:'60'});
  if(uploaded.error)return {error:await compensate()?'storage_failed':'storage_cleanup_pending'};
  const finished=await user.rpc('connect_finish_media',{p_asset_id:asset.id});
  if(finished.error)return {error:await compensate()?'finalize_failed':'storage_cleanup_pending'};
  return {version:finished.data.version};
 }catch{return {error:await compensate()?'storage_failed':'storage_cleanup_pending'};}
}
