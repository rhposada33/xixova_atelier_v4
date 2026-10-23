"""Connect only. Reapply after Supabase CLI recreates containers. No remote operation."""
from pathlib import Path
import os, json, subprocess, secrets, time, base64, hmac, hashlib
import yaml
root=Path(__file__).resolve().parents[1]
state=root/'proxy'/'.local';state.mkdir(exist_ok=True);os.chmod(state,0o700)
net='connect_edge_private_local';edge='supabase_edge_runtime_promoven_connect_local';kong='supabase_kong_promoven_connect_local'
def run(*args,**kw): return subprocess.run(args,check=True,**kw)
def inspect(name): return json.loads(subprocess.check_output(['docker','container','inspect',name]))[0]
def save(path,text): path.write_text(text);os.chmod(path,0o600)
# Save config before the first change; contains local credentials, never print/commit it.
original=state/'kong.before.yml'
if not original.exists(): save(original,subprocess.check_output(['docker','exec',kong,'cat','/home/kong/kong.yml']).decode())
config=yaml.safe_load(original.read_text());config['services']=[s for s in config['services'] if s['name']!='functions-v1']
save(state/'kong.hardened.yml',yaml.safe_dump(config))
run('docker','cp',str(state/'kong.hardened.yml'),kong+':/home/kong/kong.yml',stdout=subprocess.DEVNULL)
run('docker','exec',kong,'kong','reload',stdout=subprocess.DEVNULL)
# Only apply outstanding LOCAL migrations; never reset existing data.
cli=os.environ.get('CONNECT_SUPABASE_CLI')
assert cli and Path(cli).is_file(),'Set CONNECT_SUPABASE_CLI to the installed CLI binary'
run(cli,'migration','up','--local','--workdir',str(root))
envpath=root/'supabase'/'.env.functions.local'
settings=dict(line.split('=',1) for line in envpath.read_text().splitlines() if '=' in line and not line.startswith('#'))
secret=settings.setdefault('CONNECT_PROXY_SECRET',secrets.token_hex(32));save(envpath,'\n'.join(k+'='+v for k,v in settings.items())+'\n')
exists=subprocess.run(['docker','container','inspect',edge],capture_output=True).returncode==0
current=inspect(edge) if exists else None
current_env=dict(x.split('=',1) for x in current['Config']['Env']) if current else {}
if current_env.get('CONNECT_PROXY_SECRET')!=secret:
 # CLI owns its generated runtime/main service; preserve that implementation.
 if exists: run('docker','rm','-f',edge,stdout=subprocess.DEVNULL)
 log=open(state/'runtime.log','ab',buffering=0);os.chmod(state/'runtime.log',0o600)
 proc=subprocess.Popen([cli,'functions','serve','--no-verify-jwt','--workdir',str(root),'--env-file',str(envpath)],stdout=log,stderr=log,start_new_session=True)
 save(state/'serve.pid',str(proc.pid))
 for _ in range(60):
  time.sleep(0.5)
  if proc.poll() is not None: raise RuntimeError('Edge startup failed; inspect private runtime.log')
  p=subprocess.run(['docker','container','inspect',edge],capture_output=True)
  if p.returncode==0 and json.loads(p.stdout)[0]['State']['Running']: break
 else: raise RuntimeError('Edge startup timeout')
 # Resolve pinned npm imports before removing runtime egress. No handler writes: unsigned calls MUST be rejected.
 probe="""const base='http://supabase_edge_runtime_promoven_connect_local:8081';
 for(let i=0;i<60;i++){try{if((await fetch(base+'/_internal/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 for(const name of ['public-interest','broker-invite','broker-link','asset-media']){
 const r=await fetch(base+'/'+name,{method:'POST',body:'{}',signal:AbortSignal.timeout(60000)});
 if(r.status!==403)throw Error('warmup_or_HMAC_failed');await r.arrayBuffer();}console.log('Edge dependencies ready; unsigned calls rejected');"""
 run('docker','run','--rm','--network','supabase_network_promoven_connect_local','--entrypoint','node','connect-media-worker:local','--input-type=module','-e',probe)
else: run('docker','start',edge,stdout=subprocess.DEVNULL)
if subprocess.run(['docker','network','inspect',net],capture_output=True).returncode:
 run('docker','network','create','--internal',net,stdout=subprocess.DEVNULL)
assert json.loads(subprocess.check_output(['docker','network','inspect',net]))[0]['Internal']
front='connect_proxy_front_local'
if subprocess.run(['docker','network','inspect',front],capture_output=True).returncode:
 run('docker','network','create',front,stdout=subprocess.DEVNULL)
# Egress dependencies of Edge are reachable on the same private network.
for name in [edge,kong,'supabase_rest_promoven_connect_local','supabase_inbucket_promoven_connect_local','connect-media-worker-local']:
 networks=inspect(name)['NetworkSettings']['Networks']
 if name==kong and net in networks and 'kong' not in (networks[net]['Aliases'] or []):
  run('docker','network','disconnect',net,name);networks=inspect(name)['NetworkSettings']['Networks']
 if net not in networks: run('docker','network','connect',*(['--alias','kong'] if name==kong else []),net,name)
run('docker','start','connect-media-worker-local',stdout=subprocess.DEVNULL)
for attached in inspect(edge)['NetworkSettings']['Networks']:
 if attached!=net: run('docker','network','disconnect',attached,edge)
assert not inspect(edge)['HostConfig']['PortBindings']
run('docker','cp',str(state/'kong.hardened.yml'),kong+':/home/kong/kong.yml',stdout=subprocess.DEVNULL)
run('docker','exec',kong,'kong','reload',stdout=subprocess.DEVNULL)
# Dedicated restricted JWT. Never reuse service_role in the proxy.
env=dict(x.split('=',1) for x in inspect(edge)['Config']['Env'])
def b64(b):return base64.urlsafe_b64encode(b).decode().rstrip('=')
message=b64(b'{"alg":"HS256","typ":"JWT"}')+'.'+b64(json.dumps({'role':'connect_proxy','iss':'supabase-demo','exp':int(time.time())+86400}).encode())
token=message+'.'+b64(hmac.new(env['SUPABASE_INTERNAL_JWT_SECRET'].encode(),message.encode(),hashlib.sha256).digest())
save(state/'proxy.env','\n'.join(['CONNECT_PROXY_SECRET='+secret,'CONNECT_APP_ORIGIN='+settings['CONNECT_APP_ORIGIN'],'CONNECT_PROXY_UPSTREAM=http://'+edge+':8081','CONNECT_RATE_URL=http://supabase_rest_promoven_connect_local:3000','CONNECT_RATE_TOKEN='+token])+'\n')
run('docker','build','-t','connect-proxy:local',str(root/'proxy'),stdout=subprocess.DEVNULL)
for idx,port in [(1,56410),(2,56411)]:
 name='connect-proxy-local-'+str(idx)
 if subprocess.run(['docker','container','inspect',name],capture_output=True).returncode==0:run('docker','rm','-f',name,stdout=subprocess.DEVNULL)
 run('docker','run','-d','--name',name,'--network',front,'--restart','unless-stopped','--memory','128m','--cpus','0.5','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file',str(state/'proxy.env'),'-p',f'127.0.0.1:{port}:8080','connect-proxy:local',stdout=subprocess.DEVNULL)
 run('docker','network','connect',net,name)
print('Connect proxies: 127.0.0.1:56410/56411; Edge private; direct Kong functions route removed. JWT valid 24h; rerun bootstrap to renew.')
