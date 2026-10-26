import {open as start, status as processStatus} from './browser-process.mjs';
import {rpc} from './desktop.mjs';
export const browserEndpoint='http://127.0.0.1:9223';
const home='https://boardmix.cn/app/';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export function classifyAuth({url,text,hasUserAvatar=false}) {
 const u=new URL(url); if(u.origin!=='https://boardmix.cn')return 'unknown';
 if(/(?:^|\/)(?:login|signin)(?:\/|$)/i.test(u.pathname)||/扫码登录|验证码登录|密码登录|微信登录|登录\s*[/／]\s*注册/.test(text))return 'login_required';
 if((/^\/app\/team\//.test(u.pathname)||u.pathname==='/app/recent-file'&&hasUserAvatar)&&['最近打开','我的收藏','全部项目'].every(x=>text.includes(x)))return 'ready';
 return 'unknown';
}
async function list(){const r=await fetch(browserEndpoint+'/json/list',{signal:AbortSignal.timeout(2000),redirect:'error'});if(!r.ok)throw Error('BROWSER_UNAVAILABLE');return r.json();}
async function read(t){const c=await rpc(browserEndpoint,t);try{const r=await c.send('Runtime.evaluate',{expression:'({url:location.href,text:document.body?.innerText||"",hasUserAvatar:!!document.querySelector("nav .ed-avatar--container")})',returnByValue:true});if(r.exceptionDetails)throw Error('AUTH_PROBE_FAILED');return r.result.value;}finally{c.close();}}
function candidate(t){try{const u=new URL(t.url);return t.type==='page'&&u.origin==='https://boardmix.cn'&&!u.pathname.startsWith('/app/editor/');}catch{return false;}}
export async function authStatus(deps={list,read,processStatus}) {
 const browser=await deps.processStatus();if(!browser.ok)return {ok:false,state:'browser_unavailable',browser};
 const pages=(await deps.list()).filter(candidate); let login=null;
 for(const t of pages){const state=classifyAuth(await deps.read(t));if(state==='ready')return {ok:true,state,endpoint:browserEndpoint,tabId:t.id,url:t.url};if(state==='login_required')login=t;}
 return {ok:false,state:login?'login_required':'unknown',code:login?'AUTH_REQUIRED':'AUTH_STATE_UNKNOWN',endpoint:browserEndpoint,tabId:login?.id,url:login?.url||home,prompt:login?'请在已打开的 Chrome Boardmix 页面完成登录，然后继续检测。':'Boardmix 登录状态尚未确认，请等待页面加载或检查页面。',resume:'boardmixcli browser.ensure --wait-ms 60000'};
}
async function enterLogin(result){
 const t=(await list()).find(t=>t.id===result.tabId);if(!t)return;
 const c=await rpc(browserEndpoint,t);try{await c.send('Page.bringToFront');await c.send('Runtime.evaluate',{expression:`(()=>{const b=[...document.querySelectorAll('button.loginEntry--btn')].find(e=>/登录\\s*[/／]\\s*注册/.test(e.textContent));if(b)b.click();})()`});}finally{c.close();}
}
export async function ensureBrowser({waitMs=15000}={},deps={start,list,authStatus,pause,enterLogin}) {
 if(!Number.isInteger(waitMs)||waitMs<0||waitMs>60000)throw Error('INVALID_WAIT_MS');
 const browser=await deps.start();
 if(!(await deps.list()).some(candidate))await deps.start(home);
 const deadline=Date.now()+waitMs;let result,loginOpened=false;
 do{result=await deps.authStatus();if(result.state==='login_required'&&!loginOpened){await deps.enterLogin?.(result);loginOpened=true;}if(result.ok||result.state==='login_required'&&waitMs<=15000)break;if(Date.now()>=deadline)break;await deps.pause(500);}while(true);
 return {...result,browserStarted:browser.started,profile:browser.profile};
}
