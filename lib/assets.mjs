import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

export async function inspectImage(file) {
  const absolute=path.resolve(file), metadata=await stat(absolute);
  if(!metadata.isFile())throw Error('IMAGE_FILE_REQUIRED');
  const bytes=await readFile(absolute);
  if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('PNG_REQUIRED_IN_THIS_ADAPTER');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||bytes.length>100*1024*1024)throw Error('INVALID_IMAGE');
  return {file:absolute,name:path.basename(absolute),mime:'image/png',size:bytes.length,width,height,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export async function listImages(directory) {
  const entries=await readdir(directory,{withFileTypes:true});
  const names=entries.filter(e=>e.isFile()&&/\.png$/i.test(e.name)).map(e=>e.name).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
  return Promise.all(names.map(name=>inspectImage(path.join(directory,name))));
}
