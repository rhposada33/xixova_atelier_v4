"""Explicit local bootstrap; never starts Cloud, never restarts another container."""
from pathlib import Path
import subprocess,secrets,os
root=Path(__file__).resolve().parents[1];worker=root/'worker';target=root/'supabase'/'.env.functions.local'
assert target.exists(), 'Initialize the dedicated Connect local environment first'
settings={}
for line in target.read_text().splitlines():
 if '=' in line and not line.startswith('#'):
  k,v=line.split('=',1);settings[k]=v
secret=settings.get('CONNECT_WORKER_SECRET') or secrets.token_hex(32)
(worker/'.env.local').write_text('CONNECT_WORKER_SECRET='+secret+'\n');os.chmod(worker/'.env.local',0o600)
lines=[l for l in target.read_text().splitlines() if not l.startswith(('CONNECT_MEDIA_WORKER_URL=','CONNECT_WORKER_SECRET='))]
target.write_text('\n'.join(lines)+'\nCONNECT_MEDIA_WORKER_URL=http://connect-media-worker-local:8080\nCONNECT_WORKER_SECRET='+secret+'\n')
exists=subprocess.run(['docker','inspect','connect-media-worker-local'],capture_output=True).returncode==0
if exists:
 print('Worker already exists; no restart performed. Verify image/version before testing.')
else:
 subprocess.run(['docker','build','-t','connect-media-worker:local',str(worker)],check=True)
 subprocess.run(['docker','run','-d','--name','connect-media-worker-local','--network','supabase_network_promoven_connect_local','--memory','384m','--cpus','1','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file',str(worker/'.env.local'),'connect-media-worker:local'],check=True)
print('Serve Connect Edge functions with the absolute env-file path; no environment values printed.')
