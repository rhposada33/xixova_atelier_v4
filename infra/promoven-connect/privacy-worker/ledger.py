"""Separate, local suppression journal. JSON on stdin; no subject data on stdout except verified opaque entries."""
import sys,json,sqlite3,hmac,hashlib,os
from pathlib import Path

def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def _process(folder,action,entry=None):
 folder=Path(folder);folder.mkdir(mode=0o700,parents=True,exist_ok=True);os.chmod(folder,0o700)
 keypath=folder/'ledger.key';dbpath=folder/'ledger.sqlite';headpath=folder/'ledger.head'
 if not keypath.exists():
  if action!='key':raise ValueError('ledger_bootstrap_required')
  if dbpath.exists():raise ValueError('ledger_key_missing')
  fd=os.open(keypath,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'wb') as f:f.write(os.urandom(32));f.flush();os.fsync(f.fileno())
 anchorpath=folder/'ledger.anchor.key'
 if not anchorpath.exists():
  if dbpath.exists():raise ValueError('ledger_anchor_missing')
  fd=os.open(anchorpath,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'wb') as f:f.write(os.urandom(32));f.flush();os.fsync(f.fileno())
 anchor=anchorpath.read_bytes()
 if len(anchor)!=32:raise ValueError('ledger_anchor_invalid')
 key=keypath.read_bytes()
 if len(key)!=32:raise ValueError('ledger_key_invalid')
 db=sqlite3.connect(dbpath,timeout=10);os.chmod(dbpath,0o600)
 db.execute('pragma synchronous=FULL');db.execute('pragma journal_mode=DELETE')
 db.execute('create table if not exists events(seq integer primary key,operation text unique not null,body text not null,prev text not null,mac text not null)')
 db.execute('begin immediate')
 rows=db.execute('select seq,operation,body,prev,mac from events order by seq').fetchall();prev='0'*64;entries=[]
 for seq,op,body,parent,mac in rows:
  if seq!=len(entries)+1 or parent!=prev or not hmac.compare_digest(mac,hmac.new(key,str(seq).encode()+b'\n'+parent.encode()+b'\n'+body.encode(),hashlib.sha256).hexdigest()):raise ValueError('ledger_integrity')
  item=json.loads(body)
  if item['id']!=op:raise ValueError('ledger_integrity')
  entries.append(item);prev=mac
 if rows and not headpath.exists():raise ValueError('ledger_head_missing')
 if headpath.exists():
  head=json.loads(headpath.read_text())
  if head!={'seq':len(rows),'mac':prev,'seal':hmac.new(anchor,str(len(rows)).encode()+b'\n'+prev.encode(),hashlib.sha256).hexdigest()}:raise ValueError('ledger_truncated_or_uncommitted')
 if action=='confirm':
  saved=next((v for v in entries if v['id']==entry['id']),None)
  if saved!=entry:raise ValueError('confirmation_mismatch')
  receipt=folder/(entry['id']+'.confirmed')
  value=hmac.new(anchor,b'confirmed\n'+canonical(entry),hashlib.sha256).hexdigest()
  fd=os.open(receipt,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
  with os.fdopen(fd,'wb') as f:f.write(value.encode());f.flush();os.fsync(f.fileno())
  fd=os.open(folder,os.O_RDONLY);os.fsync(fd);os.close(fd)
 if action=='append':
  allowed={'id','leadId','organizationId','contactHash','actor','resources'}
  if set(entry)!=allowed or len(entry['contactHash'])!=64:raise ValueError('ledger_shape')
  import re
  for field in ['id','leadId','organizationId','actor']:
   if not re.fullmatch('[a-f0-9-]{36}',entry[field]):raise ValueError('ledger_identifier')
  for resource in entry['resources']:
   if set(resource)!={'id','kind','bucket','path'} or resource['kind'] not in ['storage','export','temporary'] or resource['bucket']!='connect-privacy-private' or not re.fullmatch(re.escape(entry['leadId'])+'/[a-f0-9-]{36}',resource['path']):raise ValueError('ledger_resource')
  old=next((v for v in entries if v['id']==entry['id']),None)
  if old is not None and old!=entry:raise ValueError('ledger_operation_mismatch')
  if old is None:
   body=canonical(entry).decode();seq=len(entries)+1;mac=hmac.new(key,str(seq).encode()+b'\n'+prev.encode()+b'\n'+body.encode(),hashlib.sha256).hexdigest()
   db.execute('insert into events values(?,?,?,?,?)',(seq,entry['id'],body,prev,mac));entries.append(entry);prev=mac
 db.commit();db.close()
 if action=='append' or not headpath.exists():
  temp=folder/'ledger.head.tmp'
  fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
  with os.fdopen(fd,'wb') as f:f.write(canonical({'seq':len(entries),'mac':prev,'seal':hmac.new(anchor,str(len(entries)).encode()+b'\n'+prev.encode(),hashlib.sha256).hexdigest()}));f.flush();os.fsync(f.fileno())
  os.replace(temp,headpath)
  fd=os.open(folder,os.O_RDONLY);os.fsync(fd);os.close(fd)
 if action=='key':return {'key':key.hex()}
 if action=='confirmed':
  confirmed=[]
  for item in entries:
   receipt=folder/(item['id']+'.confirmed')
   if receipt.exists():
    if not hmac.compare_digest(receipt.read_text(),hmac.new(anchor,b'confirmed\n'+canonical(item),hashlib.sha256).hexdigest()):raise ValueError('confirmation_integrity')
    confirmed.append(item)
  return confirmed
 if action not in ['append','list','confirm']:raise ValueError('ledger_action')
 return entries
def process(folder,action,entry=None):
 import fcntl
 folder=Path(folder)
 if action!='key' and not (folder/'ledger.sqlite').exists():raise ValueError('ledger_missing')
 folder.mkdir(mode=0o700,parents=True,exist_ok=True)
 with open(folder/'ledger.lock','a') as lock:
  os.chmod(folder/'ledger.lock',0o600);fcntl.flock(lock,fcntl.LOCK_EX)
  return _process(folder,action,entry)

if __name__=='__main__':
 try:
  request=json.load(sys.stdin);print(json.dumps(process(request['folder'],request['action'],request.get('entry'))))
 except Exception:
  print(json.dumps({'error':'ledger_unavailable_or_integrity_failure'}));sys.exit(1)
