import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
export async function inspectVideo(file){
 const absolute=path.resolve(file),s=await fs.stat(absolute);
 if(!s.isFile()||s.size>100*1024*1024)throw Error('INVALID_VIDEO_SIZE');
 const bytes=await fs.readFile(absolute);if(bytes.toString('ascii',4,8)!=='ftyp')throw Error('MP4_REQUIRED');
 let result;try{result=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',absolute],{timeout:30000,maxBuffer:1024*1024});}catch(e){throw Error(e.code==='ENOENT'?'FFPROBE_REQUIRED':'VIDEO_PROBE_FAILED');}
 const info=JSON.parse(result.stdout),stream=info.streams.find(s=>s.codec_type==='video'),duration=Number(info.format.duration);
 if(!stream?.width||!stream?.height||!Number.isFinite(duration)||duration<=0)throw Error('INVALID_VIDEO');
 return {file:absolute,name:path.basename(absolute),kind:'video',mime:'video/mp4',size:bytes.length,width:stream.width,height:stream.height,duration,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),md5:crypto.createHash('md5').update(bytes).digest('hex')};
}
export async function downloadVideo(url,output){
 if(new URL(url).protocol!=='https:')throw Error('HTTPS_REQUIRED');
 try{await fs.stat(output);throw Error('TARGET_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
 const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok||new URL(r.url).protocol!=='https:')throw Error('VIDEO_DOWNLOAD_FAILED');
 const chunks=[];let size=0;for await(const c of r.body){size+=c.length;if(size>100*1024*1024)throw Error('INVALID_VIDEO_SIZE');chunks.push(c);}
 const bytes=Buffer.concat(chunks);if(bytes.toString('ascii',4,8)!=='ftyp')throw Error('MP4_REQUIRED');
 await fs.writeFile(output,bytes,{flag:'wx',mode:0o600});return {...await inspectVideo(output),sourceUrl:url};
}
export async function importVideo(client,fileKey,file,receiptPath){
 const asset=await inspectVideo(file),identity=crypto.createHash('sha256').update(JSON.stringify({fileKey,sha256:asset.sha256})).digest('hex');
 let old;try{old=JSON.parse(await fs.readFile(receiptPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 async function complete(value){await fs.copyFile(receiptPath,receiptPath+'.'+crypto.randomUUID()+'.backup',fs.constants.COPYFILE_EXCL);await fs.writeFile(receiptPath,JSON.stringify(value,null,2),{mode:0o600});}
 if(old){if(old.owner!=='@petercjl/boardmixcli'||old.identity!==identity)throw Error('RECEIPT_CONFLICT');if(old.result)return {ok:true,result:old.result,recovered:true};const out=await client.call('/outcome/'+old.operationId);if(!out.ok||!out.result)throw Error('VIDEO_OUTCOME_UNRESOLVED');await complete({...old,status:'completed',result:out.result});return out;}
 await client.call('/register-asset',{file:asset.file,sha256:asset.sha256,kind:'video'});
 const receipt={owner:'@petercjl/boardmixcli',identity,fileKey,operationId:crypto.randomUUID(),status:'submitted',sha256:asset.sha256};
 await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
 const out=await client.request('video.import',fileKey,{assetId:asset.sha256,operationId:receipt.operationId});await complete({...receipt,status:'completed',result:out.result});return out;
}
