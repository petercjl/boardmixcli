// Boardmix plugin sandbox. Only named operations are accepted.
function compact(r) {
  return {guid:r.guid,name:r.name,x:r.x,y:r.y,width:r.width,height:r.height,objectType:r.objectType,aspectRatioLocked:r.lockAspectRatio,resourceHash:r.imageInfo&&r.imageInfo.hash,cropped:r.imageInfo&&r.imageInfo.cropped,imageNum:r.imageNum};
}
boardmix.ui.on('message', function(message) {
  if (!message || message.channel !== 'boardmixcli-v1' || typeof message.op !== 'string') return;
  var response = {channel:'boardmixcli-v1', id:message.id};
  try {
    if (message.fileKey !== boardmix.fileKey) throw new Error('FILE_MISMATCH');
    var p = message.params || {};
    if (message.op === 'info') response.result = {fileKey:boardmix.fileKey, apiVersion:boardmix.apiVersion, view:boardmix.viewport.getView(), zoom:boardmix.viewport.getZoom(), operations:['info','frame.create','object.get']};
    else if (message.op === 'frame.create') {
      var created = boardmix.createFrame(p);
      var g = created.guid;
      response.result = {created:compact(created), readback:compact(boardmix.getById(g.sessionID,g.localID))};
    } else if (message.op === 'object.get') response.result = compact(boardmix.getById(p.sessionID,p.localID));
    else if(message.op==='object.selection'){
      var selection=boardmix.getSelect();response.result={objects:selection.guids.map(function(g){return compact(boardmix.getById(g.sessionID,g.localID));})};
    }
    else if(message.op==='view.fit'){
      boardmix.viewport.zoomTo({guids:p.guids});response.result={guids:p.guids,zoom:boardmix.viewport.getZoom(),view:boardmix.viewport.getView()};
    }
    else if(message.op==='object.move'){
      var original=boardmix.getById(p.sessionID,p.localID);
      boardmix.moveTo(p.sessionID,p.localID,p.x+original.width/2,p.y+original.height/2);
      var moved=compact(boardmix.getById(p.sessionID,p.localID));
      if(Math.abs(moved.x-p.x)>0.01||Math.abs(moved.y-p.y)>0.01)throw new Error('MOVE_READBACK_MISMATCH:'+JSON.stringify(moved));
      response.result=moved;
    }
    else if(message.op==='object.resize'){
      throw new Error('HOST_ADAPTER_REQUIRED_FOR_EXACT_RESIZE');
    }
    else throw new Error('UNSUPPORTED_OPERATION');
    response.ok = true;
  } catch (error) { response.ok = false; response.error = String(error.message || error); }
  boardmix.ui.postMessage(response);
});
// Boardmix routes sandbox replies through its plugin window wrapper.
boardmix.showUI({title:'boardmixcli',width:280,height:90});
boardmix.ui.hide();
