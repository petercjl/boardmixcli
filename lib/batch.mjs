import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {inspectImage} from './assets.mjs';
import {validate} from './protocol.mjs';

export async function inspectBatch(files){
  if(!Array.isArray(files)||!files.length||files.length>1000||files.some(f=>typeof f!=='string'))throw Error('INVALID_FILE_LIST');
  const images=[];
  for(let i=0;i<files.length;i+=4)images.push(...await Promise.all(files.slice(i,i+4).map(inspectImage)));
  return {images};
}
// A receipt is reserved before submitting. Repeating it only reads a known outcome.
export async function importBatch(client,fileKey,items,receiptPath){
  if(!Array.isArray(items)||!items.length||items.length>20)throw Error('INVALID_BATCH');
  const keys=new Set();
  for(const i of items){if(!i||Object.keys(i).some(k=>!['key','file','sha256'].includes(k))||typeof i.key!=='string'||!i.key||i.key.length>200||keys.has(i.key)||typeof i.file!=='string'||i.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(i.sha256))throw Error('INVALID_BATCH_ITEM');keys.add(i.key);}
  const identity=crypto.createHash('sha256').update(JSON.stringify({fileKey,items})).digest('hex');
  let old;
  try{old=JSON.parse(await fs.readFile(receiptPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(old){
    if(old.owner!=='@petercjl/boardmixcli'||old.identity!==identity)throw Error('RECEIPT_CONFLICT');
    if(old.result)return {ok:true,result:old.result,recovered:true};
    const outcome=await client.call('/outcome/'+old.operationId);
    if(!outcome.ok||!outcome.result)throw Object.assign(Error('BATCH_OUTCOME_UNRESOLVED'),{details:{operationId:old.operationId,receipt:receiptPath,outcome}});
    await saveReceipt(receiptPath,{...old,result:outcome.result,status:'completed'});
    return {...outcome,recovered:true};
  }
  const inspected=(await inspectBatch(items.map(i=>i.file))).images;
  for(let i=0;i<items.length;i++)if(items[i].sha256&&inspected[i].sha256!==items[i].sha256)throw Error('ASSET_CHANGED');
  const params={operationId:crypto.randomUUID(),items:items.map((i,n)=>({key:i.key,assetId:inspected[n].sha256}))};
  validate({op:'image.import.batch',fileKey,params});
  for(let i=0;i<items.length;i+=4)await Promise.all(inspected.slice(i,i+4).map(a=>client.call('/register-asset',{file:a.file,sha256:a.sha256})));
  const receipt={owner:'@petercjl/boardmixcli',schemaVersion:1,identity,fileKey,operationId:params.operationId,status:'submitted',createdAt:new Date().toISOString()};
  await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
  const response=await client.request('image.import.batch',fileKey,params);
  await saveReceipt(receiptPath,{...receipt,status:'completed',result:response.result});
  return response;
}
async function saveReceipt(file,value){
  const old=JSON.parse(await fs.readFile(file,'utf8'));
  if(old.owner!==value.owner||old.identity!==value.identity)throw Error('RECEIPT_CONFLICT');
  await fs.copyFile(file,file+'.'+crypto.randomUUID()+'.backup',fs.constants.COPYFILE_EXCL);
  const stage=file+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(stage,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});await fs.rename(stage,file);
}
