import {parse} from './maintenance.mjs';
import {connect} from './client.mjs';
import {inspectImage,listImages} from './assets.mjs';
export async function atomicCommand(command,args){
  const extras={
   'image.list':['--directory'],'image.inspect':['--file'],'image.import':['--file'],
   'board.create':['--team-id','--project-id','--folder-id'],'board.rename':['--name'],
   'board.open':['--target-file-key'],'object.get':['--session-id','--local-id'],
   'object.move':['--session-id','--local-id','--x','--y'],
   'object.resize':['--session-id','--local-id','--width','--height'],'view.fit':['--ids']
  };
  const flags=[...(command==='image.list'||command==='image.inspect'?[]:['--session','--file-key']),...(extras[command]||[])];
  parse(args,Object.fromEntries(flags.map(k=>[k,'string'])));
  function option(name,required=true){const i=args.indexOf(name);const v=i<0?undefined:args[i+1];if(required&&(!v||v.startsWith('--')))throw Error(name+'_REQUIRED');return v;}
  function number(name){const v=Number(option(name));if(!Number.isFinite(v))throw Error('INVALID_'+name);return v;}
  if(command==='image.list')return {images:await listImages(option('--directory'))};
  if(command==='image.inspect')return inspectImage(option('--file'));
  const client=await connect(option('--session')),fileKey=option('--file-key');
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
