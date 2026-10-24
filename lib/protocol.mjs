export const operations = ['info','frame.create','object.get','object.selection','object.move','object.resize','view.fit','board.info','board.create','board.rename','board.open','board.close','image.import'];
export function validate(input) {
  if (!input || !operations.includes(input.op)) throw new Error('UNSUPPORTED_OPERATION');
  if (typeof input.fileKey !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(input.fileKey)) throw new Error('INVALID_FILE_KEY');
  const p = input.params ?? {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('INVALID_PARAMS');
  const fields = ({'frame.create':['x','y','width','height','content'],'object.get':['sessionID','localID'],'object.move':['sessionID','localID','x','y'],'object.resize':['sessionID','localID','width','height'],'view.fit':['guids'],'board.create':['teamId','projectId','folderId'],'board.rename':['name'],'board.open':['targetFileKey'],'image.import':['assetId']})[input.op]||[];
  if (Object.keys(p).some(k => !fields.includes(k))) throw new Error('UNKNOWN_PARAMETER');
  if (input.op === 'frame.create') {
    for (const k of ['x','y','width','height']) if (!Number.isFinite(p[k]) || Math.abs(p[k]) > 1e6) throw new Error('INVALID_GEOMETRY');
    if (p.width <= 0 || p.height <= 0) throw new Error('INVALID_GEOMETRY');
    if (p.content !== undefined && (typeof p.content !== 'string' || p.content.length > 1000)) throw new Error('INVALID_CONTENT');
  }
  if (['object.get','object.move','object.resize'].includes(input.op)) for (const k of ['sessionID','localID']) if (!Number.isSafeInteger(p[k]) || p[k] < 0) throw new Error('INVALID_GUID');
  if(input.op==='object.move')for(const k of ['x','y'])if(!Number.isFinite(p[k])||Math.abs(p[k])>1e7)throw Error('INVALID_GEOMETRY');
  if(input.op==='object.resize')for(const k of ['width','height'])if(!Number.isFinite(p[k])||p[k]<=0||p[k]>1e6)throw Error('INVALID_GEOMETRY');
  if(input.op==='board.create')for(const k of ['teamId','projectId','folderId'])if(!Number.isSafeInteger(p[k])||p[k]<0)throw Error('INVALID_DESTINATION');
  if(input.op==='board.rename'&&(typeof p.name!=='string'||!p.name.trim()||p.name.length>100))throw Error('INVALID_NAME');
  if(input.op==='board.open'&&(typeof p.targetFileKey!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(p.targetFileKey)))throw Error('INVALID_FILE_KEY');
  if(input.op==='image.import'&&(typeof p.assetId!=='string'||!/^[a-f0-9]{64}$/.test(p.assetId)))throw Error('INVALID_ASSET_ID');
  if(input.op==='view.fit'&&(!Array.isArray(p.guids)||!p.guids.length||p.guids.length>1000||p.guids.some(g=>!Number.isSafeInteger(g.sessionID)||g.sessionID<0||!Number.isSafeInteger(g.localID)||g.localID<0)))throw Error('INVALID_GUID_LIST');
  return {op:input.op,fileKey:input.fileKey,params:p};
}
