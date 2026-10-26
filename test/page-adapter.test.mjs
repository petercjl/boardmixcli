import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../lib/page-adapter.js',import.meta.url),'utf8')).replace('await import(src)','moduleStub');
async function runResize({fail=false,op='object.resize'}={}){
  const shape={guid:{sessionID:2,localID:3},x:0,y:0,width:100,height:200,aspectRatioLocked:true};
  const handlers=new Set(),patches=[];let resolveResult;
  const finished=new Promise(r=>{resolveResult=r;});let delivered=false;
  const manager={fileKey:'abcdefgh',renameFile(){},fileInfo:{name:'test',team_id:1,project_id:2,folder_id:0}};
  const moduleStub={z:()=>manager,bm:()=>({httpCreateFile(){}}),rl:()=>({coopStatus:1}),eb:{importPureRefFiles(){}},lr:{async run(){}},mK:({nodes})=>{
    const n=nodes[0];patches.push(n);
    if(n.name!==undefined)shape.name=n.name;
    if(n.privateInfo)shape.aspectRatioLocked=n.privateInfo.lockAspectRatio;
    if(n.width!==undefined){if(fail)throw Error('PATCH_FAILED');if(shape.aspectRatioLocked)throw Error('ASPECT_LOCK_NOT_RELEASED');shape.width=n.width;shape.height=n.height;}
  }};
  const window={addEventListener:(type,h)=>handlers.add(h),removeEventListener:(type,h)=>handlers.delete(h),postMessage:({pluginMessage:m})=>{
    const response={channel:'boardmixcli-v1',id:m.id,ok:true,result:m.op==='frame.create'?{created:structuredClone(shape),readback:structuredClone(shape)}:structuredClone(shape)};
    queueMicrotask(()=>{for(const h of handlers)h({data:{pluginMessage:response}});});
  }};
  const document={scripts:[{src:'https://cdnhw.boardmix.cn/app/assets/index-DjSD2oPg.js'}]};
  const fetch=async(url,options)=>({ok:true,json:async()=>{
    if(url.includes('/next?')){if(delivered)return {request:null};delivered=true;return {request:{id:'resize-1',op,fileKey:'abcdefgh',params:op==='frame.create'?{x:0,y:0,width:100,height:200,content:'测试容器'}:{sessionID:2,localID:3,width:300,height:400}}};}
    if(url.endsWith('/result')){resolveResult(JSON.parse(options.body));return {accepted:true};}
    throw Error('UNEXPECTED_ROUTE');
  }});
  const install=new Function('window','document','fetch','crypto','moduleStub','location',`return (${source})`)(window,document,fetch,crypto,moduleStub,{origin:'https://boardmix.cn'});
  await install({endpoint:'http://127.0.0.1:1234',token:'test'},'test');
  const response=await finished;window.__boardmixcliPageBridge.stop();return {shape,patches,response};
}
test('exact resizing temporarily releases ratio lock and returns restored final state',async()=>{
  const {shape,patches,response}=await runResize();assert.equal(response.ok,true);assert.equal(shape.width,300);assert.equal(shape.height,400);assert.equal(shape.aspectRatioLocked,true);assert.equal(response.result.aspectRatioLocked,true);assert.equal(patches.length,3);
});
test('ratio lock is restored when native resizing fails',async()=>{
  const {shape,response}=await runResize({fail:true});assert.equal(response.ok,false);assert.equal(response.error,'PATCH_FAILED');assert.equal(shape.aspectRatioLocked,true);
});

test('Frame adapter applies and verifies the native Unicode name after creation',async()=>{const {shape,response}=await runResize({op:'frame.create'});assert.equal(response.ok,true);assert.equal(shape.name,'测试容器');assert.equal(response.result.readback.name,'测试容器');});
