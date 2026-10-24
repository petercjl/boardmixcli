import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../lib/protocol.mjs';
import {startBridge} from '../lib/bridge.mjs';
test('rejects arbitrary operations and malformed geometry before dispatch',()=>{
  assert.throws(()=>validate({op:'eval',fileKey:'abcdefgh'}),/UNSUPPORTED/);
  assert.throws(()=>validate({op:'frame.create',fileKey:'abcdefgh',params:{x:0,y:0,width:-1,height:3}}),/GEOMETRY/);
  assert.throws(()=>validate({op:'info',fileKey:'abcdefgh',params:{script:'x'}}),/PARAMETER/);
});
test('bridge requires authentication and a connected plugin',async()=>{
  const b=await startBridge();
  try{
    assert.equal((await fetch(b.endpoint+'/status')).status,401);
    const headers={Authorization:'Bearer '+b.token,'Content-Type':'application/json'};
    const r=await fetch(b.endpoint+'/request',{method:'POST',headers,body:JSON.stringify({op:'info',fileKey:'abcdefgh'})});
    assert.equal(r.status,409);assert.equal((await r.json()).error,'PLUGIN_NOT_CONNECTED');
  }finally{b.server.closeAllConnections();await new Promise(r=>b.server.close(r));}
});
test('bridge correlates a request with a plugin response',async()=>{
  const b=await startBridge();const headers={Authorization:'Bearer '+b.token,'Content-Type':'application/json'};
  try{
    await fetch(b.endpoint+'/next',{headers});
    const done=fetch(b.endpoint+'/request',{method:'POST',headers,body:JSON.stringify({op:'info',fileKey:'abcdefgh'})});
    let job;
    for(let i=0;i<30&&!job;i++){job=(await (await fetch(b.endpoint+'/next',{headers})).json()).request;if(!job)await new Promise(r=>setTimeout(r,10));}
    assert.ok(job);
    await fetch(b.endpoint+'/result',{method:'POST',headers,body:JSON.stringify({id:job.id,ok:true,result:{fileKey:'abcdefgh'}})});
    assert.equal((await (await done).json()).result.fileKey,'abcdefgh');
  }finally{b.server.closeAllConnections();await new Promise(r=>b.server.close(r));}
});
