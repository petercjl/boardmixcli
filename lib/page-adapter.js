// Versioned adapter for the Boardmix web bundle observed in desktop 1.7.2.
// Called with explicit local endpoint/token; no business layout decisions here.
async function installPageAdapter(config,mainScript){
  if(window.__boardmixcliPageBridge)window.__boardmixcliPageBridge.stop();
  const src=Array.from(document.scripts).map(s=>s.src).find(s=>/\/assets\/index-[^/]+\.js/.test(s));
  if(!src||!src.endsWith('/index-DjSD2oPg.js'))throw Error('UNVERIFIED_BOARDMIX_BUILD');
  const module=await import(src), manager=module.z(),files=module.bm(),importer=module.eb;
  if(typeof manager.renameFile!=='function'||typeof files.httpCreateFile!=='function'||typeof importer.importPureRefFiles!=='function')throw Error('ADAPTER_CONTRACT_MISMATCH');
  const headers={Authorization:'Bearer '+config.token,'Content-Type':'application/json'};
  let stopped=false,timer,pendingReply;
  async function send(route,data){const r=await fetch(config.endpoint+route,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined});if(!r.ok)throw Error('LOCAL_BRIDGE_'+r.status);return r.json();}
  const runner=module.lr;
  await runner.run({id:'boardmixcli-atomic',name:'boardmixcli',main:'main.js'},mainScript,'<!doctype html><meta charset="utf-8"><p>boardmixcli 已连接</p>');
  function onReply(e){const r=e.data?.pluginMessage;if(r?.channel==='boardmixcli-v1'&&typeof r.ok==='boolean'&&pendingReply?.id===r.id){const done=pendingReply.resolve;pendingReply=null;done(r);}}
  window.addEventListener('message',onReply);
  async function plugin(op,params={}){
    if(pendingReply)throw Error('PLUGIN_BUSY');
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const t=setTimeout(()=>{if(pendingReply?.id===id)pendingReply=null;reject(Error('PLUGIN_TIMEOUT'));},10000);
      pendingReply={id,resolve:r=>{clearTimeout(t);r.ok?resolve(r.result):reject(Error(r.error));}};
      window.postMessage({pluginMessage:{channel:'boardmixcli-v1',id,op,fileKey:manager.fileKey,params}},location.origin);
    });
  }
  function boardInfo(){const f=manager.fileInfo;return {fileKey:manager.fileKey,name:f.name,teamId:f.team_id,projectId:f.project_id,folderId:f.folder_id,localSavePending:manager.isLocalSpaceActive&&manager.isEditorNeedSave,coopStatus:module.rl().coopStatus,uploading:importer.progressMap?.size||0};}
  async function execute(job){
    if(job.fileKey!==manager.fileKey)throw Error('FILE_MISMATCH');
    const p=job.params;
    if(job.op==='board.info')return boardInfo();
    if(job.op==='board.create'){
      const r=await files.httpCreateFile(p.teamId,p.projectId,p.folderId,undefined);
      return {fileKey:r.file_key,name:r.name,teamId:r.team_id,projectId:r.project_id};
    }
    if(job.op==='board.rename'){await manager.renameFile(p.name);const read=await files.httpGetFile(job.fileKey);if(read.name!==p.name)throw Error('RENAME_READBACK_MISMATCH');return {fileKey:job.fileKey,name:read.name};}
    if(job.op==='board.open'){if(!window.desktopManagerApi?.openFile)throw Error('DESKTOP_OPEN_UNAVAILABLE');window.desktopManagerApi.openFile(p.targetFileKey);return {requested:true,targetFileKey:p.targetFileKey};}
    if(job.op==='board.close'){
      if(importer.progressMap?.size||(manager.isLocalSpaceActive&&manager.isEditorNeedSave)||(!manager.isLocalSpaceActive&&module.rl().coopStatus!==1))throw Error('SAVE_OR_UPLOAD_PENDING');
      if(!window.desktopManagerApi?.closeView)throw Error('DESKTOP_CLOSE_UNAVAILABLE');return {closeRequested:true,fileKey:job.fileKey};
    }
    if(job.op==='object.resize'){
      const guid={sessionID:p.sessionID,localID:p.localID},original=await plugin('object.get',guid);
      const locked=original.aspectRatioLocked;
      let matched=false;
      try{
        if(locked){module.mK({nodes:[{guid,privateInfo:{lockAspectRatio:false}}]});await new Promise(r=>setTimeout(r,150));}
        module.mK({nodes:[{guid,width:p.width,height:p.height}]});
        const deadline=Date.now()+3000;
        while(Date.now()<deadline){await new Promise(r=>setTimeout(r,100));const shape=await plugin('object.get',guid);if(Math.abs(shape.width-p.width)<0.01&&Math.abs(shape.height-p.height)<0.01){matched=true;break;}}
        if(!matched)throw Error('RESIZE_READBACK_MISMATCH');
      }finally{if(locked){module.mK({nodes:[{guid,privateInfo:{lockAspectRatio:true}}]});await new Promise(r=>setTimeout(r,150));}}
      return plugin('object.get',guid);
    }
    if(job.op==='image.import'){
      const a=await send('/asset-info/'+p.assetId),before=await plugin('object.selection');
      const r=await fetch(config.endpoint+'/asset/'+p.assetId,{headers});if(!r.ok)throw Error('ASSET_FETCH_FAILED');
      const blob=await r.blob(),file=new File([blob],a.name,{type:a.mime});
      const submitted=await importer.importPureRefFiles([{file}]);if(submitted!==1)throw Error('IMPORT_REJECTED');
      const known=new Set(before.objects.map(x=>x.guid.sessionID+':'+x.guid.localID));
      const deadline=Date.now()+120000;
      while(Date.now()<deadline){
        await new Promise(r=>setTimeout(r,500));
        const current=await plugin('object.selection'),added=current.objects.filter(x=>!known.has(x.guid.sessionID+':'+x.guid.localID));
        if(added.length>1)throw Error('CONCURRENT_CANVAS_MUTATION');
        if(added.length===1&&!(importer.progressMap?.size)&&added[0].width>0&&added[0].height>0)return {asset:{name:a.name,sha256:a.sha256,width:a.width,height:a.height},object:added[0],uploadFinished:true};
      }
      throw Error('IMPORT_OUTCOME_UNKNOWN');
    }
    return plugin(job.op,p);
  }
  async function poll(){
    if(stopped)return;
    try{
      const next=await send('/next?fileKey='+encodeURIComponent(manager.fileKey));
      if(next.request){const job=next.request;let response;try{response={id:job.id,ok:true,result:await execute(job)};}catch(e){response={id:job.id,ok:false,error:String(e.message||e)};}
        await send('/result',response);
        if(job.op==='board.close'&&response.ok){window.__boardmixcliPageBridge.stop();setTimeout(()=>window.desktopManagerApi.closeView(),100);return;}
      }
    }catch(e){console.warn('boardmixcli connection',e.message);}
    timer=setTimeout(poll,350);
  }
  window.__boardmixcliPageBridge={stop(){stopped=true;clearTimeout(timer);window.removeEventListener('message',onReply);}};
  poll();return {connected:true,...boardInfo()};
}
