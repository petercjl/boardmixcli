import {inspectVideo,downloadVideo,importVideo} from './video.mjs';
import {readFile} from 'node:fs/promises';
import {inspectBatch,importBatch} from './batch.mjs';
import {parse} from './maintenance.mjs';
import {connect} from './client.mjs';
import {downloadImage} from './image-codecs.mjs';
import {inspectImage,listImages} from './assets.mjs';
export async function atomicCommand(command,args){
  const extras={
   'video.inspect':['--file'],'video.download':['--url','--output'],'video.import':['--file','--receipt'],
   'image.inspect.batch':['--input'],'image.import.batch':['--input','--receipt'],'object.get.batch':['--input'],'object.place.batch':['--input'],
   'image.download':['--url','--output'],'frame.create':['--x','--y','--width','--height','--name'],'text.create':['--x','--y','--width','--height','--text','--font-size'],'image.list':['--directory'],'image.inspect':['--file'],'image.import':['--file'],
   'board.create':['--team-id','--project-id','--folder-id'],'board.rename':['--name'],
   'board.open':['--target-file-key'],'object.get':['--session-id','--local-id'],
   'object.move':['--session-id','--local-id','--x','--y'],
   'object.resize':['--session-id','--local-id','--width','--height'],'view.fit':['--ids']
  };
  const flags=[...(['video.inspect','video.download','image.list','image.inspect','image.download','image.inspect.batch'].includes(command)?[]:['--session','--file-key']),...(extras[command]||[])];
  parse(args,Object.fromEntries(flags.map(k=>[k,'string'])));
  function option(name,required=true){const i=args.indexOf(name);const v=i<0?undefined:args[i+1];if(required&&(!v||v.startsWith('--')))throw Error(name+'_REQUIRED');return v;}
  function number(name){const v=Number(option(name));if(!Number.isFinite(v))throw Error('INVALID_'+name);return v;}
  if(command==='image.inspect.batch')return inspectBatch(JSON.parse(await readFile(option('--input'),'utf8')));
  if(command==='video.inspect')return inspectVideo(option('--file'));
  if(command==='video.download')return downloadVideo(option('--url'),option('--output'));
  if(command==='image.list')return {images:await listImages(option('--directory'))};
  if(command==='image.inspect')return inspectImage(option('--file'));
  if(command==='image.download'){const r=await downloadImage(option('--url'),option('--output'));return {...await inspectImage(r.file),sourceUrl:r.sourceUrl};}
  const client=await connect(option('--session')),fileKey=option('--file-key');
  if(command==='video.import')return importVideo(client,fileKey,option('--file'),option('--receipt'));
  if(command==='image.import.batch')return importBatch(client,fileKey,JSON.parse(await readFile(option('--input'),'utf8')),option('--receipt'));
  if(command==='object.get.batch')return client.request(command,fileKey,{guids:JSON.parse(await readFile(option('--input'),'utf8'))});
  if(command==='object.place.batch')return client.request(command,fileKey,{items:JSON.parse(await readFile(option('--input'),'utf8'))});
  if(['frame.create','text.create'].includes(command))return client.request(command,fileKey,{x:number('--x'),y:number('--y'),width:number('--width'),height:number('--height'),content:option(command==='frame.create'?'--name':'--text'),...(command==='text.create'?{fontSize:Number(option('--font-size',false)||28)}:{})});
  if(command==='board.info')return client.request(command,fileKey);
  if(command==='board.create')return client.request(command,fileKey,{teamId:number('--team-id'),projectId:number('--project-id'),folderId:Number(option('--folder-id',false)||0)});
  if(command==='board.rename')return client.request(command,fileKey,{name:option('--name')});
  if(command==='board.open')return client.request(command,fileKey,{targetFileKey:option('--target-file-key')});
  if(command==='board.close')return client.request(command,fileKey);
  if(command==='object.selection')return client.request(command,fileKey);
  if(command==='object.get')return client.request(command,fileKey,{sessionID:number('--session-id'),localID:number('--local-id')});
  if(command==='object.move')return client.request(command,fileKey,{sessionID:number('--session-id'),localID:number('--local-id'),x:number('--x'),y:number('--y')});
  if(command==='object.resize')return client.request(command,fileKey,{sessionID:number('--session-id'),localID:number('--local-id'),width:number('--width'),height:number('--height')});
  if(command==='view.fit')return client.request(command,fileKey,{guids:JSON.parse(option('--ids'))});
  if(command==='image.import'){
    const asset=await inspectImage(option('--file'));
    const registered=await client.call('/register-asset',{file:asset.file,sha256:asset.sha256});
    return client.request(command,fileKey,{assetId:registered.assetId});
  }
  throw Error('UNKNOWN_COMMAND');
}
