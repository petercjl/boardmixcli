import http from 'node:http';
import {randomBytes, randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validate} from './protocol.mjs';
import {inspectImage} from './assets.mjs';

const main = await readFile(new URL('../plugin/main.js', import.meta.url), 'utf8');
const pageAdapter = await readFile(new URL('./page-adapter.js',import.meta.url),'utf8');
export async function startBridge() {
  const token = randomBytes(32).toString('hex');
  const queue = [], pending = new Map(), assets=new Map(),clients=new Map(),outcomes=new Map();
  let lastSeen = 0;
  function reply(res,status,data) { res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
  async function body(req) { let s=''; for await (const c of req) {s+=c; if(s.length>16384) throw new Error('BODY_TOO_LARGE');} return JSON.parse(s || '{}'); }
  const server = http.createServer(async(req,res)=>{
    const host = `127.0.0.1:${server.address().port}`;
    if(req.headers.host !== host) return reply(res,403,{error:'INVALID_HOST'});
    if(req.method==='OPTIONS') {res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Private-Network':'true'});return res.end();}
    if(req.headers.authorization !== `Bearer ${token}`) return reply(res,401,{error:'UNAUTHORIZED'});
    try {
      if(req.method==='GET' && req.url==='/status') return reply(res,200,{connected:Date.now()-lastSeen<5000,pending:pending.size,clients:Array.from(clients,([fileKey,time])=>({fileKey,connected:Date.now()-time<5000}))});
      if(req.method==='GET' && req.url==='/bootstrap') return reply(res,200,{script:bootstrap()});
      if(req.method==='POST'&&req.url==='/register-asset'){
        const input=await body(req);if(typeof input.file!=='string')throw Error('FILE_REQUIRED');
        const a=await inspectImage(input.file);if(a.sha256!==input.sha256)throw Error('ASSET_CHANGED');assets.set(a.sha256,a);return reply(res,200,{assetId:a.sha256,...a});
      }
      if(req.method==='GET'&&req.url.startsWith('/asset-info/')){const a=assets.get(req.url.slice('/asset-info/'.length));if(!a)return reply(res,404,{error:'ASSET_NOT_REGISTERED'});const {file,...publicInfo}=a;return reply(res,200,publicInfo);}
      if(req.method==='GET'&&req.url.startsWith('/asset/')){const a=assets.get(req.url.slice('/asset/'.length));if(!a)return reply(res,404,{error:'ASSET_NOT_REGISTERED'});const current=await inspectImage(a.file);if(current.sha256!==a.sha256)throw Error('ASSET_CHANGED');res.writeHead(200,{'Content-Type':a.mime,'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});return res.end(await readFile(a.file));}
      if(req.method==='GET'&&req.url.startsWith('/outcome/'))return reply(res,200,outcomes.get(req.url.slice('/outcome/'.length))||{error:'OUTCOME_NOT_FOUND'});
      if(req.method==='GET' && req.url.startsWith('/next')) {lastSeen=Date.now();const key=new URL(req.url,'http://localhost').searchParams.get('fileKey');if(key)clients.set(key,lastSeen);const i=queue.findIndex(x=>!key||x.fileKey===key);return reply(res,200,{request:i<0?null:queue.splice(i,1)[0]});}
      if(req.method==='POST' && req.url==='/result') {
        const r=await body(req); const task=pending.get(r.id);
        outcomes.set(r.id,r);if(task) {clearTimeout(task.timer);pending.delete(r.id);reply(task.res,200,r);}
        return reply(res,200,{accepted:!!task});
      }
      if(req.method==='POST' && req.url==='/request') {
        const input=validate(await body(req));
        if(input.op==='image.import'&&!assets.has(input.params.assetId))throw Error('ASSET_NOT_REGISTERED');
        if(clients.size&&Date.now()-(clients.get(input.fileKey)||0)>=5000)return reply(res,409,{error:'TARGET_BOARD_NOT_CONNECTED'});
        if(Date.now()-lastSeen>=5000) return reply(res,409,{error:'PLUGIN_NOT_CONNECTED'});
        if(pending.size) return reply(res,409,{error:'BUSY'});
        const id=randomUUID(); const task={id,channel:'boardmixcli-v1',...input};
        const timer=setTimeout(()=>{pending.delete(id);const i=queue.findIndex(x=>x.id===id);if(i>=0)queue.splice(i,1);reply(res,504,{error:'OUTCOME_UNKNOWN',id,retrySafe:['info','board.info','object.get','object.list'].includes(input.op)});},input.op==='image.import'?150000:30000);
        pending.set(id,{res,timer});queue.push(task);return;
      }
      reply(res,404,{error:'NOT_FOUND'});
    } catch(error) {reply(res,400,{error:error.message});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const endpoint=`http://127.0.0.1:${server.address().port}`;
  function bootstrap() {
    return `(${pageAdapter})(${JSON.stringify({endpoint,token})},${JSON.stringify(main)})`;
  }
  return {server,endpoint,token,bootstrap};
}
