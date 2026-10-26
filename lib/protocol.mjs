export const operations = ['video.import','image.import.batch','object.get.batch','object.place.batch','info','text.create','frame.create','object.get','object.selection','object.move','object.resize','view.fit','board.info','board.create','board.rename','board.open','board.close','image.import'];
export function validate(input) {
  if (!input || !operations.includes(input.op)) throw new Error('UNSUPPORTED_OPERATION');
  if (typeof input.fileKey !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(input.fileKey)) throw new Error('INVALID_FILE_KEY');
  const p = input.params ?? {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('INVALID_PARAMS');
  const fields = ({'video.import':['assetId','operationId'],'image.import.batch':['items','operationId'],'object.get.batch':['guids'],'object.place.batch':['items'],'text.create':['x','y','width','height','content','fontSize'],'frame.create':['x','y','width','height','content'],'object.get':['sessionID','localID'],'object.move':['sessionID','localID','x','y'],'object.resize':['sessionID','localID','width','height'],'view.fit':['guids'],'board.create':['teamId','projectId','folderId'],'board.rename':['name'],'board.open':['targetFileKey'],'image.import':['assetId']})[input.op]||[];
  if (Object.keys(p).some(k => !fields.includes(k))) throw new Error('UNKNOWN_PARAMETER');
  if (['frame.create','text.create'].includes(input.op)) {
    for (const k of ['x','y','width','height']) if (!Number.isFinite(p[k]) || Math.abs(p[k]) > 1e6) throw new Error('INVALID_GEOMETRY');
    if (p.width <= 0 || p.height <= 0) throw new Error('INVALID_GEOMETRY');
    if (p.content !== undefined && (typeof p.content !== 'string' || p.content.length > 1000)) throw new Error('INVALID_CONTENT');
  }
  if(input.op==='text.create'&&p.fontSize!==undefined&&(!Number.isFinite(p.fontSize)||p.fontSize<=0||p.fontSize>200))throw Error('INVALID_FONT_SIZE');
  if (['object.get','object.move','object.resize'].includes(input.op)) for (const k of ['sessionID','localID']) if (!Number.isSafeInteger(p[k]) || p[k] < 0) throw new Error('INVALID_GUID');
  if(input.op==='object.move')for(const k of ['x','y'])if(!Number.isFinite(p[k])||Math.abs(p[k])>1e7)throw Error('INVALID_GEOMETRY');
  if(input.op==='object.resize')for(const k of ['width','height'])if(!Number.isFinite(p[k])||p[k]<=0||p[k]>1e6)throw Error('INVALID_GEOMETRY');
  if(input.op==='board.create')for(const k of ['teamId','projectId','folderId'])if(!Number.isSafeInteger(p[k])||p[k]<0)throw Error('INVALID_DESTINATION');
  if(input.op==='board.rename'&&(typeof p.name!=='string'||!p.name.trim()||p.name.length>100))throw Error('INVALID_NAME');
  if(input.op==='board.open'&&(typeof p.targetFileKey!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(p.targetFileKey)))throw Error('INVALID_FILE_KEY');
  if(['image.import','video.import'].includes(input.op)&&(typeof p.assetId!=='string'||!/^[a-f0-9]{64}$/.test(p.assetId)))throw Error('INVALID_ASSET_ID');
  if(input.op==='view.fit'&&(!Array.isArray(p.guids)||!p.guids.length||p.guids.length>1000||p.guids.some(g=>!Number.isSafeInteger(g.sessionID)||g.sessionID<0||!Number.isSafeInteger(g.localID)||g.localID<0)))throw Error('INVALID_GUID_LIST');
  if(input.op==='video.import'&&(typeof p.operationId!=='string'||!/^[a-f0-9-]{36}$/.test(p.operationId)))throw Error('INVALID_OPERATION_ID');
  if(input.op==='image.import.batch'){
    if(typeof p.operationId!=='string'||!/^[a-f0-9-]{36}$/.test(p.operationId))throw Error('INVALID_OPERATION_ID');
    if(!Array.isArray(p.items)||!p.items.length||p.items.length>20)throw Error('INVALID_BATCH');
    const keys=new Set();for(const i of p.items){if(!i||Object.keys(i).some(k=>!['key','assetId'].includes(k))||typeof i.key!=='string'||!i.key||i.key.length>200||keys.has(i.key))throw Error('INVALID_BATCH_KEY');keys.add(i.key);validate({op:'image.import',fileKey:input.fileKey,params:{assetId:i.assetId}});}
  }
  if(input.op==='object.get.batch')validate({op:'view.fit',fileKey:input.fileKey,params:{guids:p.guids}});
  if(input.op==='object.place.batch'){
    if(!Array.isArray(p.items)||!p.items.length||p.items.length>200)throw Error('INVALID_BATCH');
    const seen=new Set();for(const i of p.items){if(!i||Object.keys(i).some(k=>!['sessionID','localID','x','y','width','height'].includes(k)))throw Error('UNKNOWN_PARAMETER');const {sessionID,localID,x,y,width,height}=i;validate({op:'object.move',fileKey:input.fileKey,params:{sessionID,localID,x,y}});validate({op:'object.resize',fileKey:input.fileKey,params:{sessionID,localID,width,height}});const key=sessionID+':'+localID;if(seen.has(key))throw Error('DUPLICATE_GUID');seen.add(key);}
  }
  return {op:input.op,fileKey:input.fileKey,params:p};
}
