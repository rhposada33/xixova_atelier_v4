"""Only attached to the disposable restore network. Never connects to source DB/SMTP."""
from pathlib import Path
import subprocess,json,time,base64,hmac,hashlib

def validate_mail_restore(container,network,mailpit,auth,jwtsecret,fixture):
 assert container.startswith('connect-recovery-') and container[len('connect-recovery-'):].isdigit()
 root=Path(__file__).resolve().parents[1];created=[]
 def run(*args):return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL,timeout=45).strip()
 def sql(q):return run('docker','exec',container,'psql','-h','/tmp','-p','55432','-U','postgres','-Atc',q)
 def jwt(role):
  enc=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).decode().rstrip('=')
  raw=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'iss':f'http://{auth}:9999','aud':'authenticated','exp':int(time.time())+600})
  return raw+'.'+base64.urlsafe_b64encode(hmac.new(jwtsecret.encode(),raw.encode(),hashlib.sha256).digest()).decode().rstrip('=')
 ident=fixture['id'];assert len(ident)==36 and all(c in '0123456789abcdef-' for c in ident)
 assert sql(f"select state from private.mail_outbox where id='{ident}'")=='pending','pending_outbox_not_restored'
 # Only this copy is changed. Prevent any unrelated recovered mail from being dispatched.
 sql(f"update private.mail_outbox set state='cancelled' where id<>'{ident}' and state in ('pending','processing','retry'); alter role authenticator password 'synthetic-restore-only';")
 try:
  rest=container+'-mail-rest';image=json.loads(run('docker','container','inspect','supabase_rest_promoven_connect_local'))[0]['Config']['Image']
  run('docker','run','-d','--name',rest,'--network',network,'-e',f'PGRST_DB_URI=postgres://authenticator:synthetic-restore-only@{container}:55432/postgres','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_JWT_SECRET='+jwtsecret,image);created.append(rest)
  keys=json.loads((root/'mail-worker'/'.local'/'keys.json').read_text())
  config={'rest':f'http://{rest}:3000','auth':f'http://{auth}:9999','mailpit':mailpit,'workerJwt':jwt('connect_mail_worker'),'serviceJwt':jwt('service_role'),'keys':keys,'id':ident}
  probe=container+'-mail-probe';created.append(probe)
  result=subprocess.run(['docker','run','--rm','-i','--name',probe,'--network',network,'--entrypoint','node','connect-mail-worker:local','restore-probe.mjs'],input=json.dumps(config),text=True,capture_output=True,timeout=45)
  if result.returncode:
   state=sql(f"select state||':'||coalesce(last_code,'none') from private.mail_outbox where id='{ident}'")
   import re
   detail=re.search(r'auth_(?:http_[0-9]+|origin_mismatch|transport_failure)',result.stderr)
   raise RuntimeError('restored_mail_worker_failed:'+state+':'+(detail.group(0) if detail else 'unknown'))
  assert sql(f"select state from private.mail_outbox where id='{ident}'")=='sent','restored_delivery_not_confirmed'
  return json.loads(result.stdout)
 finally:
  for name in created:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
