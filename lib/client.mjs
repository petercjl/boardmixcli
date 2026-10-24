import {readFile} from 'node:fs/promises';
export async function connect(sessionPath){
  if(!sessionPath)throw Error('SESSION_PATH_REQUIRED');
  const {endpoint,token}=JSON.parse(await readFile(sessionPath,'utf8'));
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint)||typeof token!=='string')throw Error('INVALID_SESSION');
  async function call(route,data){
    const r=await fetch(endpoint+route,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(190000)});
    const result=await r.json();if(!r.ok||result.ok===false){const e=Error(result.error||'REQUEST_FAILED');e.details=result;throw e;}return result;
  }
  return {call,request:(op,fileKey,params={})=>call('/request',{op,fileKey,params})};
}
