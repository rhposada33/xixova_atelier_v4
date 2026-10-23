"""Disposable HTTP Auth probe; only accepts a container created by recovery-local.sh."""
import subprocess,json,sys,secrets,time,urllib.request,urllib.error,os,base64,hmac,hashlib
container=sys.argv[1]
assert container.startswith('connect-recovery-') and container[len('connect-recovery-'):].isdigit()
def run(*args):
 try:return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL,timeout=45).strip()
 except Exception:raise RuntimeError('isolated_recovery_command_failed') from None
def inspect(name):return json.loads(run('docker','inspect',name))[0]
def env(name):return dict(x.split('=',1) for x in inspect(name)['Config']['Env'] if '=' in x)
network=container+'-http';auth=container+'-auth';created=[];started=time.monotonic()
try:
 run('docker','network','create','--internal',network);run('docker','network','disconnect','none',container);run('docker','network','connect',network,container)
 run('docker','exec',container,'psql','-h','/tmp','-p','55432','-U','postgres','-c',"alter role supabase_auth_admin password 'synthetic-restore-only';")
 run('docker','exec',container,'sh','-c',"printf 'host all all 0.0.0.0/0 scram-sha-256\\n' >> /tmp/recovery-db/pg_hba.conf")
 run('docker','exec',container,'pg_ctl','-D','/tmp/recovery-db','-o',"-k /tmp -p 55432 -c listen_addresses='*'",'-l','/tmp/pg.log','restart')
 mailpit=container+'-mailpit'
 run('docker','run','-d','--name',mailpit,'--network',network,inspect('supabase_inbucket_promoven_connect_local')['Config']['Image']);created.append(mailpit)
 config=env('supabase_auth_promoven_connect_local');config.update({'GOTRUE_DB_DATABASE_URL':f'postgres://supabase_auth_admin:synthetic-restore-only@{container}:55432/postgres','GOTRUE_JWT_SECRET':secrets.token_hex(32),'GOTRUE_SMTP_HOST':mailpit,'GOTRUE_SMTP_PORT':'1025','API_EXTERNAL_URL':f'http://{auth}:9999','GOTRUE_SMTP_PASS':'','GOTRUE_SMTP_USER':''})
 config.pop('GOTRUE_JWT_KEYS',None)
 config.update({'GOTRUE_JWT_VALID_METHODS':'HS256','GOTRUE_JWT_VALIDMETHODS':'HS256','GOTRUE_JWT_ISSUER':f'http://{auth}:9999'})
 # Only local source configuration; no production secrets. SMTP cannot leave internal network.
 args=['docker','run','-d','--name',auth,'--network',network]
 for k,v in config.items():
  if k.startswith('GOTRUE_') or k in ('API_EXTERNAL_URL','DATABASE_URL'):args+=['-e',k+'='+v]
 args+=[inspect('supabase_auth_promoven_connect_local')['Config']['Image']];run(*args);created.append(auth)
 # Restore Storage HTTP with independent synthetic JWT keys and database credentials.
 storage=container+'-storage'
 run('docker','exec',container,'psql','-h','/tmp','-p','55432','-U','postgres','-c',"alter role supabase_storage_admin password 'synthetic-restore-only'; alter role postgres password 'synthetic-restore-only';")
 jwtsecret=config['GOTRUE_JWT_SECRET']
 def jwt(role):
  enc=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).decode().rstrip('=')
  raw=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'iss':'supabase','exp':int(time.time())+600})
  return raw+'.'+base64.urlsafe_b64encode(hmac.new(jwtsecret.encode(),raw.encode(),hashlib.sha256).digest()).decode().rstrip('=')
 servicekey=jwt('service_role');anonkey=jwt('anon')
 st=env('supabase_storage_promoven_connect_local');st.update({'DATABASE_URL':f'postgres://supabase_storage_admin:synthetic-restore-only@{container}:55432/postgres','AUTH_JWT_SECRET':jwtsecret,'SERVICE_KEY':servicekey,'ANON_KEY':anonkey,'S3_PROTOCOL_ENABLED':'false','VECTOR_ENABLED':'false','ENABLE_IMAGE_TRANSFORMATION':'false','IMAGE_TRANSFORMATION_ENABLED':'false'})
 st.pop('JWT_JWKS',None);st['VECTOR_DATABASE_URL']=f'postgres://postgres:synthetic-restore-only@{container}:55432/postgres'
 args=['docker','create','--name',storage,'--network',network]
 for k,v in st.items():
  if k not in ('PATH','NODE_VERSION','YARN_VERSION','VERSION'):args+=['-e',k+'='+v]
 args+=[inspect('supabase_storage_promoven_connect_local')['Config']['Image']];run(*args);created.append(storage)
 export=subprocess.Popen(['docker','cp',container+':/tmp/restored-storage/.','-'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 copied=subprocess.run(['docker','cp','-',storage+':/mnt'],stdin=export.stdout,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30);export.stdout.close();export.wait(timeout=30)
 if copied.returncode:raise RuntimeError('storage_copy_failed')
 run('docker','start',storage)
 objectname=run('docker','exec',container,'psql','-h','/tmp','-p','55432','-U','postgres','-Atc',"select o.name||'|'||a.checksum from storage.objects o join public.project_assets a on a.storage_path=o.name where o.bucket_id='connect-media-private' and a.upload_state='ready' order by o.name limit 1")
 if not objectname:raise RuntimeError('synthetic_storage_fixture_required')
 objectname,expectedhash=objectname.split('|')
 credentials={}
 with open('../../../apps/promoven-connect-web/.env.e2e.local') as f:
  for line in f:
   if '=' in line:
    k,v=line.strip().split('=',1);credentials[k]=v.strip('"'+chr(39))
 code="""const chunks=[];for await(const b of process.stdin)chunks.push(b);const c=JSON.parse(Buffer.concat(chunks));const base='http://'+c.host+':9999';for(let i=0;i<30;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}const r=await fetch(base+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:c.email,password:c.password})});if(!r.ok)throw Error('login_status_'+r.status);const token=(await r.json()).access_token;const u=await fetch(base+'/user',{headers:{Authorization:'Bearer '+token}});if(!u.ok)throw Error('user_status_'+u.status);const storage='http://'+c.storage+':5000';for(let i=0;i<30;i++){try{if((await fetch(storage+'/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}const direct=await fetch(storage+'/object/authenticated/connect-media-private/'+c.object,{headers:{Authorization:'Bearer '+c.anon}});if(direct.ok)throw Error('private_object_exposed');const signed=await fetch(storage+'/object/sign/connect-media-private/'+c.object,{method:'POST',headers:{Authorization:'Bearer '+c.service,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:60})});if(!signed.ok)throw Error('sign_status_'+signed.status);const value=await signed.json();const download=await fetch(storage+(value.signedURL??value.signedUrl));if(!download.ok)throw Error('signed_download_'+download.status);const downloaded=await download.arrayBuffer();if(downloaded.byteLength<1)throw Error('empty_object');if((await import('node:crypto')).createHash('sha256').update(Buffer.from(downloaded)).digest('hex')!==c.expectedhash)throw Error('hash_mismatch');const recovered=await fetch(base+'/recover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:c.email})});if(!recovered.ok)throw Error('recovery_status_'+recovered.status);let delivered=false;for(let i=0;i<20;i++){const mails=await fetch('http://'+c.mailpit+':8025/api/v1/messages');if(mails.ok&&(await mails.json()).messages?.length){delivered=true;break;}await new Promise(r=>setTimeout(r,100));}if(!delivered)throw Error('recovery_mail_missing');console.log(JSON.stringify({authHealth:true,syntheticLogin:true,authenticatedUser:true,storageHTTP:true,privateStorageDenied:true,signedObjectDelivered:true,objectChecksumVerified:true,recoveryEmail:true}));"""
 probe=container+'-probe';created.append(probe)
 result=subprocess.run(['docker','run','--rm','-i','--name',probe,'--network',network,'--entrypoint','node','connect-media-worker:local','--input-type=module','-e',code],input=json.dumps({'host':auth,'email':credentials['CONNECT_E2E_EMAIL'],'password':credentials['CONNECT_E2E_PASSWORD'],'storage':storage,'service':servicekey,'anon':anonkey,'object':objectname,'expectedhash':expectedhash,'mailpit':mailpit}),capture_output=True,text=True,timeout=45)
 if result.returncode:
  import re
  category=re.search(r'(login_status_\d+|user_status_\d+|sign_status_\d+|signed_download_\d+|private_object_exposed|empty_object|ECONNREFUSED)',result.stderr)
  print(json.dumps({'probeFailure':category.group(0) if category else 'transport_failure','storageRunning':inspect(storage)['State']['Running']}))
  raise RuntimeError('auth_storage_http_probe_failed')
 data=json.loads(result.stdout);data['seconds']=round(time.monotonic()-started,2);print(json.dumps(data))

except Exception:
 print(json.dumps({'httpRestore':'failed','components':[name.rsplit('-',1)[-1] for name in created]}))
 raise

finally:
 for name in created:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['docker','network','disconnect',network,container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 subprocess.run(['docker','network','rm',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
