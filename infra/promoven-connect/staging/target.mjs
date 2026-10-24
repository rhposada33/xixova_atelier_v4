const local={id:'promoven_connect_local',environment:'local',appOrigin:'http://127.0.0.1:5178',supabaseUrl:'http://127.0.0.1:56321',functionsUrl:'http://127.0.0.1:56410'};
export function validateTarget(target,approvedTargets=[]){
  if(!target||/escobar|maquette|commercial.leads/i.test(JSON.stringify(target)))return false;
  if(target.environment==='local')return Object.keys(local).every(k=>target[k]===local[k]);
  if(!['staging','production'].includes(target.environment)||!/^connect-[a-z0-9-]+$/.test(target.id??''))return false;
  const approved=approvedTargets.find(t=>t.id===target.id&&t.environment===target.environment);
  if(!approved||JSON.stringify(approved)!==JSON.stringify(target))return false;
  return ['appOrigin','supabaseUrl','functionsUrl'].every(k=>{
    try{const u=new URL(target[k]);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&!/localhost|127\.0\.0\.1|REPLACE|example|invalid/i.test(u.hostname);}catch{return false;}
  });
}
export function validatePublicEnvironment(env,target){
  const allowed=['VITE_CONNECT_ENV','VITE_CONNECT_SUPABASE_URL','VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY','VITE_CONNECT_FUNCTIONS_URL'];
  if(Object.keys(env).some(k=>k.startsWith('VITE_')&&!allowed.includes(k)))return false;
  if(!allowed.every(k=>typeof env[k]==='string'&&env[k].length>0))return false;
  const key=env.VITE_CONNECT_SUPABASE_PUBLISHABLE_KEY;
  let publicKey=key.startsWith('sb_publishable_');
  try{publicKey||=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon';}catch{/* Invalid opaque key. */}
  return publicKey&&env.VITE_CONNECT_ENV===target.environment&&env.VITE_CONNECT_SUPABASE_URL===target.supabaseUrl&&env.VITE_CONNECT_FUNCTIONS_URL===target.functionsUrl;
}
export {local as localTarget};
