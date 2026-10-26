import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../plugin/main.js',import.meta.url),'utf8');
function sandbox(){
  let handler;const responses=[],reads=[];
  const shape={guid:{sessionID:2,localID:3},x:10,y:20,width:480,height:280};
  const moves=[];
  const boardmix={fileKey:'abcdefgh',ui:{on:(event,fn)=>{handler=fn;},postMessage:r=>responses.push(r),hide(){}},showUI(){},createText:p=>{shape.width=84;shape.height=42;shape.textInfo={fontSize:p.style.fontSize};return shape;},createFrame:()=>shape,getById:(...args)=>{reads.push(args);return shape;},moveTo:(s,l,x,y)=>{moves.push([s,l,x,y]);shape.x=x-shape.width/2;shape.y=y-shape.height/2;}};
  vm.runInNewContext(source,{boardmix});return {send:input=>handler(input),responses,reads,moves,shape,boardmix};
}
test('plugin ignores echoed replies instead of replying recursively',()=>{
  const s=sandbox();s.send({channel:'boardmixcli-v1',id:'1',ok:true,result:{}});assert.equal(s.responses.length,0);
});
test('plugin rejects commands targeting another board',()=>{
  const s=sandbox();s.send({channel:'boardmixcli-v1',id:'1',op:'frame.create',fileKey:'different'});
  assert.equal(s.responses[0].error,'FILE_MISMATCH');assert.equal(s.reads.length,0);
});
test('create verifies the new shape with separate numeric GUID arguments',()=>{
  const s=sandbox();s.send({channel:'boardmixcli-v1',id:'1',op:'frame.create',fileKey:'abcdefgh',params:{x:10,y:20,width:480,height:280}});
  assert.deepEqual(s.reads,[[2,3]]);assert.equal(s.responses[0].ok,true);
  assert.equal(s.responses[0].result.readback.width,480);
});
test('top-left movement translates to native center coordinates and verifies readback',()=>{
  const s=sandbox();s.send({channel:'boardmixcli-v1',id:'2',op:'object.move',fileKey:'abcdefgh',params:{sessionID:2,localID:3,x:0,y:1475}});
  assert.deepEqual(s.moves,[[2,3,240,1615]]);assert.equal(s.responses[0].result.x,0);assert.equal(s.responses[0].result.y,1475);
});

test('text creation passes native typography and normalizes auto-fit top-left geometry',()=>{
 const s=sandbox();s.send({channel:'boardmixcli-v1',id:'text',op:'text.create',fileKey:'abcdefgh',params:{x:0,y:-160,width:320,height:72,content:'主图区',fontSize:48}});
 assert.equal(s.responses[0].ok,true);assert.equal(s.responses[0].result.readback.fontSize,48);assert.equal(s.responses[0].result.readback.x,0);assert.equal(s.responses[0].result.readback.y,-160);assert.equal(s.responses[0].result.readback.width,84);
});

test('video geometry uses native resize and preserves source identity and aspect lock',()=>{
 const s=sandbox();s.shape.fileInfo={mimeType:'video/mp4',hash:'video-md5',isInLoading:false};s.shape.lockAspectRatio=true;s.boardmix.resize=(sid,lid,width,height)=>{assert.equal(sid,2);assert.equal(lid,3);s.shape.width=width;s.shape.height=height;};s.send({channel:'boardmixcli-v1',id:'video-size',op:'object.resize',fileKey:'abcdefgh',params:{sessionID:2,localID:3,width:320,height:180}});assert.equal(s.responses[0].ok,true);assert.equal(s.responses[0].result.width,320);assert.equal(s.responses[0].result.height,180);assert.equal(s.responses[0].result.resourceHash,'video-md5');assert.equal(s.responses[0].result.aspectRatioLocked,true);
});
