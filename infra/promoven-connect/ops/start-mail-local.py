"""Local Connect only. Keys never enter the database, image, web bundle or stdout."""
from pathlib import Path
import subprocess,json,os,base64,hashlib,hmac,time
root=Path(__file__).resolve().parents[1];state=root/'mail-worker'/'.local';state.mkdir(exist_ok=True);os.chmod(state,0o700)
def save(path,value):path.write_text(value);os.chmod(path,0o600)
def run(*args,**kwargs):return subprocess.run(args,check=True,**kwargs)
def inspect(n):return json.loads(subprocess.check_output(['docker','container','inspect',n]))[0]
keys=state/'keys.json'
if not keys.exists():
 # Never silently replace a lost key when encrypted mail/backups already exist.
 exists=subprocess.check_output(['docker','exec','supabase_db_promoven_connect_local','psql','-U','postgres','-d','postgres','-Atc',"select to_regclass('private.mail_outbox') is not null"],text=True).strip()
 if exists=='t':
  count=subprocess.check_output(['docker','exec','supabase_db_promoven_connect_local','psql','-U','postgres','-d','postgres','-Atc','select count(*) from private.mail_outbox'],text=True).strip()
  assert count=='0','Existing outbox requires restoring its keyring; automatic replacement refused'
 source="""const {generateKeyPairSync}=require('node:crypto');const p=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'der'},privateKeyEncoding:{type:'pkcs8',format:'der'}});console.log(JSON.stringify({kid:'local-v1',publicKey:p.publicKey.toString('base64'),privateKeys:{'local-v1':p.privateKey.toString('base64')}}));"""
 save(keys,subprocess.check_output(['node','-e',source],text=True))
k=json.loads(keys.read_text())
edgepath=root/'supabase'/'.env.functions.local'
settings=dict(l.split('=',1) for l in edgepath.read_text().splitlines() if '=' in l and not l.startswith('#'))
settings.update(CONNECT_MAIL_KEY_ID=k['kid'],CONNECT_MAIL_PUBLIC_KEY=k['publicKey'])
save(edgepath,'\n'.join(a+'='+b for a,b in settings.items())+'\n')
# Reuses the PC07B3A bootstrap: migrations, mandatory HMAC, private Edge, direct route block.
run('python3',str(root/'ops'/'start-proxy-local.py'))
env=dict(v.split('=',1) for v in inspect('supabase_edge_runtime_promoven_connect_local')['Config']['Env'])
def b64(v):return base64.urlsafe_b64encode(v).decode().rstrip('=')
message=b64(b'{"alg":"HS256","typ":"JWT"}')+'.'+b64(json.dumps({'role':'connect_mail_worker','exp':int(time.time())+86400}).encode())
jwt=message+'.'+b64(hmac.new(env['SUPABASE_INTERNAL_JWT_SECRET'].encode(),message.encode(),hashlib.sha256).digest())
config={'CONNECT_MAIL_MODE':'local','CONNECT_MAIL_REST_URL':'http://supabase_rest_promoven_connect_local:3000','CONNECT_MAIL_WORKER_TOKEN':jwt,
 'CONNECT_MAIL_PRIVATE_KEYS':json.dumps(k['privateKeys'],separators=(',',':')),'CONNECT_MAIL_PUBLIC_KEY':k['publicKey'],'CONNECT_MAIL_KEY_ID':k['kid'],
 'CONNECT_APP_ORIGIN':settings['CONNECT_APP_ORIGIN'],'CONNECT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:56321','CONNECT_AUTH_URL':'http://kong:8000',
 'CONNECT_AUTH_SERVICE_KEY':env['SUPABASE_SERVICE_ROLE_KEY'],'CONNECT_MAIL_SMTP_HOST':'supabase_inbucket_promoven_connect_local','CONNECT_MAIL_SMTP_PORT':'1025',
 'CONNECT_MAIL_MAILPIT_URL':'http://supabase_inbucket_promoven_connect_local:8025','CONNECT_MAIL_MAX_ATTEMPTS':'5'}
save(state/'worker.env','\n'.join(a+'='+b for a,b in config.items())+'\n')
run('docker','build','-f',str(root/'mail-worker'/'Dockerfile'),'-t','connect-mail-worker:local',str(root))
for index in (1,2):
 name='connect-mail-worker-local-'+str(index)
 if subprocess.run(['docker','container','inspect',name],capture_output=True).returncode==0:run('docker','stop','--time','20',name,stdout=subprocess.DEVNULL);run('docker','rm',name,stdout=subprocess.DEVNULL)
 run('docker','run','-d','--name',name,'--network','connect_edge_private_local','--restart','unless-stopped','--memory','192m','--cpus','0.5','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file',str(state/'worker.env'),'connect-mail-worker:local',stdout=subprocess.DEVNULL)
print('Two private mail workers started. Local Mailpit only; JWT renewal required within 24h; private key backup stored separately from database.')
