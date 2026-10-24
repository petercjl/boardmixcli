import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {checkUpdate} from '../lib/maintenance.mjs';
test('automatic update detection throttles network, backs off offline, and honors opt-out',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bm-update-')),priorFetch=globalThis.fetch,priorCache=process.env.BOARDMIXCLI_CACHE_DIR,priorDisable=process.env.BOARDMIXCLI_UPDATE_CHECK;
 process.env.BOARDMIXCLI_CACHE_DIR=dir;delete process.env.BOARDMIXCLI_UPDATE_CHECK;
 let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({version:'0.1.0'})};};
 try{
  assert.equal((await checkUpdate({automatic:true})).available,false);
  assert.equal((await checkUpdate({automatic:true})).cached,true);assert.equal(calls,1);
  process.env.BOARDMIXCLI_UPDATE_CHECK='0';assert.equal((await checkUpdate()).enabled,false);assert.equal(calls,1);
  delete process.env.BOARDMIXCLI_UPDATE_CHECK;
  globalThis.fetch=async()=>{calls++;throw Error('offline');};assert.equal((await checkUpdate()).error,'offline');
  assert.equal((await checkUpdate({automatic:true})).cached,true);assert.equal(calls,2);
 }finally{
  globalThis.fetch=priorFetch;
  if(priorCache===undefined)delete process.env.BOARDMIXCLI_CACHE_DIR;else process.env.BOARDMIXCLI_CACHE_DIR=priorCache;
  if(priorDisable===undefined)delete process.env.BOARDMIXCLI_UPDATE_CHECK;else process.env.BOARDMIXCLI_UPDATE_CHECK=priorDisable;
  await rm(dir,{recursive:true,force:true});
 }
});
