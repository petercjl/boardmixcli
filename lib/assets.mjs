import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {imageMetadata} from './image-codecs.mjs';

export async function inspectImage(file) {
  const absolute=path.resolve(file), metadata=await stat(absolute);
  if(!metadata.isFile())throw Error('IMAGE_FILE_REQUIRED');
  const bytes=await readFile(absolute);
  const {width,height,mime}=imageMetadata(bytes);
  if(!width||!height||bytes.length>100*1024*1024)throw Error('INVALID_IMAGE');
  return {file:absolute,name:path.basename(absolute),mime,size:bytes.length,width,height,sha256:createHash('sha256').update(bytes).digest('hex'),md5:createHash('md5').update(bytes).digest('hex')};
}
export async function listImages(directory) {
  const entries=await readdir(directory,{withFileTypes:true});
  const names=entries.filter(e=>e.isFile()&&/\.(png|jpe?g|webp)$/i.test(e.name)).map(e=>e.name).sort((a,b)=>a.localeCompare(b,'en',{numeric:true}));
  return Promise.all(names.map(name=>inspectImage(path.join(directory,name))));
}
