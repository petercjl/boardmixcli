import {connect} from './client.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export const defaultEndpoint='http://127.0.0.1:19427';
export function endpoint(value=defaultEndpoint){
 if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(value))throw Error('LOOPBACK_ENDPOINT_REQUIRED');
 const port=Number(new URL(value).port);if(port<1024||port>65535)throw Error('INVALID_DEBUG_PORT');return value;
}
export function editorKey(url){try{const u=new URL(url);return u.origin==='https://boardmix.cn'&&/^\/app\/editor\/[A-Za-z0-9_-]{8,128}$/.test(u.pathname)?u.pathname.split('/').pop():null;}catch{return null;}}
function boardmixTarget(t){try{const u=new URL(t.url);return t.type==='page'&&(u.origin==='https://boardmix.cn'&&u.pathname.startsWith('/app/')||u.protocol==='file:'&&u.pathname.endsWith('/boardmix.app/Contents/Resources/app.asar/packages/renderer/dist/index.html'));}catch{return false;}}
export async function targets(base=defaultEndpoint){
 endpoint(base);let r;try{r=await fetch(base+'/json/list',{signal:AbortSignal.timeout(2000),redirect:'error'});}catch{throw Error('DESKTOP_CONNECTION_UNAVAILABLE');}
 if(!r.ok)throw Error('DESKTOP_CONNECTION_UNAVAILABLE');const list=await r.json();if(!Array.isArray(list))throw Error('INVALID_DESKTOP_RESPONSE');
 return list.filter(boardmixTarget).map(t=>({id:t.id,title:t.title,url:t.url,fileKey:editorKey(t.url),webSocketDebuggerUrl:t.webSocketDebuggerUrl}));
}
export async function rpc(base,target){
 const u=new URL(target.webSocketDebuggerUrl),b=new URL(endpoint(base));
 if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||u.port!==b.port||!u.pathname.startsWith('/devtools/page/')||u.username||u.password)throw Error('UNTRUSTED_DEBUG_TARGET');
 const ws=new WebSocket(u),pending=new Map();let serial=0;
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>{ws.close();reject(Error('DESKTOP_CONNECT_TIMEOUT'));},3000);ws.addEventListener('open',()=>{clearTimeout(t);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(t);reject(Error('DESKTOP_CONNECT_FAILED'));},{once:true});});
 ws.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error('CDP_REQUEST_FAILED')):p.resolve(m.result);});
 ws.addEventListener('close',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('DESKTOP_DISCONNECTED'));}pending.clear();});
 return {close:()=>ws.close(),send(method,params={}){return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('DESKTOP_REQUEST_TIMEOUT'));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}};
}
async function evaluate(c,expression){const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('DESKTOP_ADAPTER_FAILED');return r.result?.value;}
function validKey(k){if(typeof k!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(k))throw Error('FILE_KEY_REQUIRED');}
export async function attachDesktop({session,fileKey,base=defaultEndpoint,browser=false},deps={targets,rpc}){
 validKey(fileKey);endpoint(base);const client=await connect(session),status=await client.call('/status');
 const found=(await deps.targets(base)).filter(t=>t.fileKey===fileKey);
 if(found.length!==1)throw Error(found.length?'AMBIGUOUS_EDITOR':'EDITOR_NOT_OPEN');
 if(status.pending)throw Error('BRIDGE_BUSY');
 const c=await deps.rpc(base,found[0]);try{
  const identity=await evaluate(c,'({url:location.href,desktop:window.desktopManagerApi?.version,bridge:window.__boardmixcliPageBridge?.endpoint,active:window.__boardmixcliPageBridge?.active})');
  if(editorKey(identity?.url)!==fileKey||!browser&&identity.desktop!=='1.0.0')throw Error('DESKTOP_IDENTITY_MISMATCH');
  if(identity.active&&identity.bridge===client.endpoint&&status.clients?.some(c=>c.fileKey===fileKey&&c.connected))return {connected:true,fileKey,reused:true,visibleDevTools:false};
  const readyUntil=Date.now()+10000;let ready=false;
  while(Date.now()<readyUntil){if(await evaluate(c,"Array.from(document.scripts).some(s=>s.src.includes('/assets/index-')&&s.src.endsWith('.js'))")){ready=true;break;}await pause(200);}
  if(!ready)throw Error('EDITOR_LOADING');
  const {script}=await client.call('/bootstrap');const result=await evaluate(c,script);
  if(!result?.connected||result.fileKey!==fileKey)throw Error('ATTACH_READBACK_MISMATCH');
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){const s=await client.call('/status');if(s.clients?.some(x=>x.fileKey===fileKey&&x.connected))return {connected:true,fileKey,reused:false,visibleDevTools:false};await pause(100);}
  throw Error('ATTACH_NOT_CONFIRMED');
 }finally{c.close();}
}
export async function closeBrowser({session,fileKey,base}){
 validKey(fileKey);endpoint(base);const found=(await targets(base)).filter(t=>t.fileKey===fileKey);if(found.length!==1)throw Error(found.length?'AMBIGUOUS_EDITOR':'EDITOR_NOT_OPEN');
 const client=await connect(session),{result:info}=await client.request('board.info',fileKey);
 if(info.fileKey!==fileKey||info.uploading||info.localSavePending||info.coopStatus!==1)throw Error('SAVE_OR_UPLOAD_PENDING');
 const c=await rpc(base,found[0]);try{await evaluate(c,'window.__boardmixcliPageBridge?.stop()');const result=await c.send('Target.closeTarget',{targetId:found[0].id});if(!result.success)throw Error('BROWSER_CLOSE_FAILED');}finally{c.close();}
 const deadline=Date.now()+5000;while(Date.now()<deadline){if(!(await targets(base)).some(t=>t.id===found[0].id))return {closed:true,fileKey};await pause(100);}throw Error('BROWSER_CLOSE_PENDING');
}
export async function openDesktop({fileKey,base=defaultEndpoint,browser=false}){
 validKey(fileKey);const list=await targets(base),existing=list.filter(t=>t.fileKey===fileKey);
 if(existing.length>1)throw Error('AMBIGUOUS_EDITOR');if(existing.length===1)return {opened:true,fileKey,reused:true};
 const host=list.find(t=>t.url.startsWith('https://boardmix.cn/app/'));
 if(!host)throw Error('BOARDMIX_HOME_REQUIRED');const c=await rpc(base,host);
 try{if(browser)await c.send('Target.createTarget',{url:'https://boardmix.cn/app/editor/'+fileKey,background:false});else{const ok=await evaluate(c,`(()=>{if(window.desktopManagerApi?.version!=='1.0.0')return false;window.desktopManagerApi.openFile(${JSON.stringify(fileKey)});return true;})()`);if(!ok)throw Error('DESKTOP_IDENTITY_MISMATCH');}}finally{c.close();}
 const deadline=Date.now()+15000;while(Date.now()<deadline){if((await targets(base)).some(t=>t.fileKey===fileKey))return {opened:true,fileKey,reused:false};await pause(250);}throw Error('EDITOR_OPEN_PENDING');
}
