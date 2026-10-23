import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import {ledger,storageAdapter} from './worker.mjs';
test('durable journal idempotency, tamper and missing key fail closed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'connect-privacy-'));
 try{
  const e={id:randomUUID(),leadId:randomUUID(),organizationId:randomUUID(),actor:randomUUID(),contactHash:'a'.repeat(64),resources:[]};
  ledger(dir,'key');ledger(dir,'append',e);ledger(dir,'append',e);assert.equal(ledger(dir,'list').length,1);assert.equal(ledger(dir,'confirmed').length,0);ledger(dir,'confirm',e);assert.equal(ledger(dir,'confirmed').length,1);
  assert.throws(()=>ledger(dir,'append',{...e,contactHash:'b'.repeat(64)}));
  const head=await readFile(join(dir,'ledger.head'));await writeFile(join(dir,'ledger.head'),'{}');assert.throws(()=>ledger(dir,'list'));
  await writeFile(join(dir,'ledger.head'),head);await rm(join(dir,'ledger.key'));assert.throws(()=>ledger(dir,'list'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('transport rejects remote target and unowned paths before HTTP',async()=>{
 assert.throws(()=>storageAdapter({url:'https://external.invalid',key:'synthetic'}));
 await assert.rejects(storageAdapter({url:'http://127.0.0.1:56321',key:'synthetic'}).remove({bucket:'connect-media-private',path:'other'}));
});
