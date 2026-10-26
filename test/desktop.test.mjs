import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {endpoint,editorKey,targets,rpc,attachDesktop} from '../lib/desktop.mjs';
test('desktop targets restrict endpoints, origins and websocket destination',async()=>{
 for(const u of ['http://0.0.0.0:19427','http://127.0.0.1:19427/path','https://127.0.0.1:19427','http://127.0.0.1:80'])assert.throws(()=>endpoint(u));
 assert.equal(editorKey('https://boardmix.cn/app/editor/abcdefgh'),'abcdefgh');assert.equal(editorKey('https://boardmix.cn.evil.test/app/editor/abcdefgh'),null);
 await assert.rejects(rpc('http://127.0.0.1:19427',{webSocketDebuggerUrl:'ws://example.com:19427/devtools/page/1'}),/UNTRUSTED/);
 const server=http.createServer((q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify([{id:'1',type:'page',url:'https://boardmix.cn/app/editor/abcdefgh'},{id:'2',type:'page',url:'https://example.com/app/editor/abcdefgh'},{id:'3',type:'service_worker',url:'https://boardmix.cn/app/editor/abcdefgh'}]));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{assert.deepEqual((await targets('http://127.0.0.1:'+server.address().port)).map(x=>x.id),['1']);}finally{await new Promise(r=>server.close(r));}
});
test('attachment verifies identity, confirms bridge and reuses a live connection without injection',async()=>{
 let connected=false,injections=0,closed=0,identity='abcdefgh',count=1;
 const server=http.createServer((q,r)=>{assert.equal(q.headers.authorization,'Bearer test');r.setHeader('Content-Type','application/json');r.end(JSON.stringify(q.url==='/status'?{clients:[{fileKey:'abcdefgh',connected}]}:{script:'TEST_BOOTSTRAP'}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const dir=await fs.mkdtemp(path.join(os.tmpdir(),'boardmix-desktop-')),session=path.join(dir,'session.json');await fs.writeFile(session,JSON.stringify({endpoint:'http://127.0.0.1:'+server.address().port,token:'test'}),{flag:'wx',mode:0o600});
 const deps={targets:async()=>Array.from({length:count},()=>({fileKey:'abcdefgh'})),rpc:async()=>({close(){closed++;},async send(method,p){assert.equal(method,'Runtime.evaluate');if(p.expression.startsWith('Array.from'))return {result:{value:true}};if(p.expression==='TEST_BOOTSTRAP'){injections++;connected=true;return {result:{value:{connected:true,fileKey:'abcdefgh'}}};}return {result:{value:{url:'https://boardmix.cn/app/editor/'+identity,desktop:'1.0.0',active:connected,bridge:connected?'http://127.0.0.1:'+server.address().port:undefined}}};}})};
 try{const first=await attachDesktop({session,fileKey:'abcdefgh'},deps);assert.equal(first.reused,false);assert.equal(first.visibleDevTools,false);assert.equal(closed,1);assert.equal((await attachDesktop({session,fileKey:'abcdefgh'},deps)).reused,true);assert.equal(injections,1);
 connected=false;count=2;await assert.rejects(attachDesktop({session,fileKey:'abcdefgh'},deps),/AMBIGUOUS_EDITOR/);count=0;await assert.rejects(attachDesktop({session,fileKey:'abcdefgh'},deps),/EDITOR_NOT_OPEN/);count=1;identity='wrongkey';await assert.rejects(attachDesktop({session,fileKey:'abcdefgh'},deps),/IDENTITY_MISMATCH/);assert.equal(injections,1);assert.equal(closed,3);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
