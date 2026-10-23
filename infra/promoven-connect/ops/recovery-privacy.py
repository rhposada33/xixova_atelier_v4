"""Only an isolated Connect recovery container; journal remains outside the DB snapshot."""
import json,subprocess,re,importlib.util
from pathlib import Path

def validate_privacy_restore(container,network,storage,servicekey,fixturepath):
 if not re.fullmatch(r'connect-recovery-\d+',container):raise RuntimeError('disposable_required')
 root=Path(__file__).resolve().parents[1];worker=root/'privacy-worker';folder=worker/'.local'/'ledger'
 spec=importlib.util.spec_from_file_location('ledger',worker/'ledger.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 if not all((folder/name).is_file() for name in ['ledger.key','ledger.anchor.key','ledger.sqlite','ledger.head']):raise RuntimeError('external_ledger_required')
 all_entries=module.process(folder,'list');entries=module.process(folder,'confirmed')
 if len(entries)!=len(all_entries):raise RuntimeError('pending_suppression_requires_operator_review')
 ledgerkey=module.process(folder,'key')['key']
 fixture=json.loads(Path(fixturepath).read_text()) if fixturepath else None
 config={'db':{'host':container,'port':55432,'user':'postgres','password':'synthetic-restore-only','database':'postgres'},'storage':'http://'+storage+':5000','serviceKey':servicekey,'fixture':fixture,'entries':entries,'ledgerKey':ledgerkey}
 name=container+'-privacy-probe'
 try:
  result=subprocess.run(['docker','run','--rm','-i','--name',name,'--network',network,'--mount','type=bind,source='+str(worker/'worker.mjs')+',target=/privacy/worker.mjs,readonly','--mount','type=bind,source='+str(worker/'restore-probe.mjs')+',target=/privacy/restore-probe.mjs,readonly','--mount','type=bind,source='+str(worker/'node_modules')+',target=/privacy/node_modules,readonly','--entrypoint','node','connect-media-worker:local','/privacy/restore-probe.mjs'],input=json.dumps(config),capture_output=True,text=True,timeout=60)
  if result.returncode:raise RuntimeError('privacy_restore_probe_failed:'+result.stderr[:180])
  return json.loads(result.stdout)
 finally:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
