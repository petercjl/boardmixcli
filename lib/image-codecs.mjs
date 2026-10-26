import {lstat,writeFile} from 'node:fs/promises';
import path from 'node:path';
export function imageMetadata(b){
 if(b.length>=24&&b.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return {mime:'image/png',width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
 if(b.length>4&&b[0]===255&&b[1]===216){
  let i=2;while(i+4<=b.length){if(b[i++]!==255)throw Error('INVALID_JPEG');while(b[i]===255)i++;const marker=b[i++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;const len=b.readUInt16BE(i);if(len<2||i+len>b.length)throw Error('INVALID_JPEG');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(len<7)throw Error('INVALID_JPEG');return {mime:'image/jpeg',height:b.readUInt16BE(i+3),width:b.readUInt16BE(i+5)};}i+=len;}
 }
 if(b.length>=30&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  const kind=b.toString('ascii',12,16);
  if(kind==='VP8X')return {mime:'image/webp',width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
  if(kind==='VP8 '&&b.subarray(23,26).toString('hex')==='9d012a')return {mime:'image/webp',width:b.readUInt16LE(26)&16383,height:b.readUInt16LE(28)&16383};
  if(kind==='VP8L'&&b[20]===47){const v=b.readUInt32LE(21);return {mime:'image/webp',width:(v&16383)+1,height:((v>>>14)&16383)+1};}
 }
 throw Error('UNSUPPORTED_IMAGE_FORMAT_PNG_REQUIRED_OR_JPEG_WEBP');
}
export async function downloadImage(url,output){
 const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('INVALID_IMAGE_URL');
 const target=path.resolve(output);try{await lstat(target);throw Error('TARGET_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
 const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('IMAGE_DOWNLOAD_HTTP_'+r.status);
 const chunks=[];let size=0;for await(const c of r.body){size+=c.length;if(size>100*1024*1024)throw Error('IMAGE_TOO_LARGE');chunks.push(c);}
 const data=Buffer.concat(chunks),m=imageMetadata(data);if(!m.width||!m.height)throw Error('INVALID_IMAGE');
 await writeFile(target,data,{flag:'wx',mode:0o600});return {file:target,sourceUrl:u.href,...m,size};
}
