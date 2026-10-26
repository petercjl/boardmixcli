import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureBrowser,authStatus,classifyAuth} from '../lib/browser-session.mjs';
import {matchesProcess,profile} from '../lib/browser-process.mjs';
test('process identity rejects foreign port, profile and unsafe Chrome',()=>{
 const command=`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9223 --user-data-dir=${profile}`;
 assert.equal(matchesProcess(command),true);
 for(const c of [command.replace('9223','9222'),command+'x',command+' --no-sandbox'])assert.equal(matchesProcess(c),false);
});
test('auth classification requires workspace markers and rejects guest editors',()=>{
 assert.equal(classifyAuth({url:'https://boardmix.cn/app/team/123',text:'最近打开 我的收藏 全部项目'}),'ready');
 assert.equal(classifyAuth({url:'https://boardmix.cn/app/login',text:''}),'login_required');
 assert.equal(classifyAuth({url:'https://boardmix.cn/app/',text:'微信登录'}),'login_required');
 assert.equal(classifyAuth({url:'https://boardmix.cn/app/editor/123',text:'最近打开 我的收藏 全部项目'}),'unknown');
 assert.equal(classifyAuth({url:'https://example.com/app/team/123',text:'最近打开 我的收藏 全部项目'}),'unknown');
});
test('cold browser opens Boardmix then returns actionable login pause',async()=>{
 const calls=[];const r=await ensureBrowser({}, {start:async url=>{calls.push(url);return {started:true,profile:'fixed'};},list:async()=>[],authStatus:async()=>({ok:false,state:'login_required',code:'AUTH_REQUIRED'}),pause:async()=>{throw Error('should return immediately');}});
 assert.deepEqual(calls,[undefined,'https://boardmix.cn/app/']);assert.equal(r.code,'AUTH_REQUIRED');assert.equal(r.browserStarted,true);
});
test('repeated ensure reuses page and wait resumes after login',async()=>{
 let starts=0,probes=0;const deps={start:async()=>{starts++;return {started:false};},list:async()=>[{type:'page',url:'https://boardmix.cn/app/login'}],authStatus:async()=>++probes===1?{ok:false,state:'login_required'}:{ok:true,state:'ready'},pause:async()=>{}};
 const r=await ensureBrowser({waitMs:60000},deps);assert.equal(r.ok,true);assert.equal(starts,1);assert.equal(probes,2);
});
test('conflict propagates before tab creation and invalid wait before launch',async()=>{
 let launched=false;const deps={start:async()=>{launched=true;throw Error('PORT_CONFLICT');}};
 await assert.rejects(ensureBrowser({waitMs:-1},deps),/INVALID_WAIT_MS/);assert.equal(launched,false);
 await assert.rejects(ensureBrowser({},deps),/PORT_CONFLICT/);
});
test('unknown state remains unresolved, no false auth success',async()=>{
 const deps={processStatus:async()=>({ok:true}),list:async()=>[{id:'1',type:'page',url:'https://boardmix.cn/app/'}],read:async()=>({url:'https://boardmix.cn/app/',text:'loading'})};
 assert.equal((await authStatus(deps)).code,'AUTH_STATE_UNKNOWN');
});

import {open as launch} from '../lib/browser-process.mjs';
import {EventEmitter} from 'node:events';
test('cold launch uses persistent profile and fixed debugging flags, then verifies readiness',async()=>{
 let checks=0,spawned;
 const deps={status:async()=>++checks===1?{ok:false,state:'stopped'}:{ok:true,state:'ready'},access:async()=>{},mkdir:async()=>{},pause:async()=>{},spawn:(exe,args,opts)=>{spawned={exe,args,opts};const c=new EventEmitter();c.unref=()=>{};queueMicrotask(()=>c.emit('spawn'));return c;}};
 const result=await launch(undefined,deps);assert.equal(result.started,true);assert.equal(checks,2);assert.ok(spawned.args.includes('--remote-debugging-port=9223'));assert.ok(spawned.args.includes(`--user-data-dir=${profile}`));assert.equal(spawned.opts.detached,true);
});

test('cold guest recent-file shell requires login before workspace readiness',()=>{
 const guest={url:'https://boardmix.cn/app/recent-file',text:'最近打开 我的收藏 全部项目 登录 / 注册'};
 assert.equal(classifyAuth(guest),'login_required');
 assert.equal(classifyAuth({...guest,text:'最近打开 我的收藏 全部项目'}),'unknown');
 assert.equal(classifyAuth({...guest,text:'最近打开 我的收藏 全部项目',hasUserAvatar:true}),'ready');
});
test('ensure opens the login entry once while waiting for the human',async()=>{
 let opened=0,n=0;
 const result=await ensureBrowser({waitMs:60000},{start:async()=>({started:false}),list:async()=>[{type:'page',url:'https://boardmix.cn/app/recent-file'}],pause:async()=>{},enterLogin:async()=>{opened++;},authStatus:async()=>++n<3?{state:'login_required',ok:false}:{state:'ready',ok:true}});
 assert.equal(opened,1);assert.equal(result.ok,true);
});
