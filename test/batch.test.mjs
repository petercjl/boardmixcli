import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {importBatch,inspectBatch} from '../lib/batch.mjs';
import {validate} from '../lib/protocol.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
test('batch receipt recovers lost response without importing twice; input changes refuse',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'boardmix-batch-'));try{
  const file=path.join(dir,'image.png');await fs.writeFile(file,png);const receipt=path.join(dir,'receipt.json');
  let imports=0,outcome;const client={call:async(route)=>route.startsWith('/outcome/')?outcome:{},request:async()=>{imports++;outcome={ok:true,result:{items:[{key:'a'}]}};throw Error('connection lost');}};
  const items=[{key:'a',file}];await assert.rejects(importBatch(client,'abcdefgh',items,receipt),/connection lost/);
  assert.equal((await importBatch(client,'abcdefgh',items,receipt)).recovered,true);assert.equal(imports,1);
  await importBatch(client,'abcdefgh',items,receipt);assert.equal(imports,1);
  await assert.rejects(importBatch(client,'abcdefgh',[{key:'b',file}],receipt),/RECEIPT_CONFLICT/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('unknown batch and mismatched source hashes refuse new submissions',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'boardmix-batch-'));try{
  const file=path.join(dir,'image.png');await fs.writeFile(file,png);const receipt=path.join(dir,'receipt.json');let imports=0;
  const client={call:async()=>({error:'OUTCOME_NOT_FOUND'}),request:async()=>{imports++;throw Error('unknown');}};
  await assert.rejects(importBatch(client,'abcdefgh',[{key:'a',file,sha256:'0'.repeat(64)}],receipt),/ASSET_CHANGED/);assert.equal(imports,0);
  await assert.rejects(importBatch(client,'abcdefgh',[{key:'a',file}],receipt),/unknown/);
  await assert.rejects(importBatch(client,'abcdefgh',[{key:'a',file}],receipt),/BATCH_OUTCOME_UNRESOLVED/);assert.equal(imports,1);
  const inspected=await inspectBatch([file,file]);assert.equal(inspected.images.length,2);assert.equal(inspected.images[0].md5.length,32);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('batch protocol validates every geometry and caller key before mutation',()=>{
 const fileKey='abcdefgh',items=[{sessionID:2,localID:3,x:0,y:10,width:100,height:200}];
 assert.equal(validate({op:'object.place.batch',fileKey,params:{items}}).params.items.length,1);
 assert.throws(()=>validate({op:'object.place.batch',fileKey,params:{items:[...items,...items]}}),/DUPLICATE_GUID/);
 assert.throws(()=>validate({op:'object.place.batch',fileKey,params:{items:[{...items[0],height:-1}]}}),/INVALID_GEOMETRY/);
 assert.throws(()=>validate({op:'image.import.batch',fileKey,params:{operationId:'0'.repeat(36),items:[{key:'a',assetId:'0'.repeat(64)},{key:'a',assetId:'1'.repeat(64)}]}}),/INVALID_BATCH_KEY/);
});
