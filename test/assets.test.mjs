import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {inspectImage,listImages} from '../lib/assets.mjs';
import {validate} from '../lib/protocol.mjs';
test('image inventory reports native dimensions and natural filename order',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'boardmixcli-assets-'));
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  try{for(const n of ['10-screen.png','2-screen.png'])await writeFile(path.join(dir,n),png,{flag:'wx'});
    await writeFile(path.join(dir,'.DS_Store'),'ignored',{flag:'wx'});
    const images=await listImages(dir);assert.deepEqual(images.map(x=>x.name),['2-screen.png','10-screen.png']);assert.equal(images[0].width,1);assert.equal(images[0].height,1);assert.equal(images[0].sha256.length,64);
    await assert.rejects(inspectImage(path.join(dir,'.DS_Store')),/PNG_REQUIRED/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('atomic commands validate destinations, identifiers and dimensions',()=>{
  assert.throws(()=>validate({op:'board.create',fileKey:'abcdefgh',params:{teamId:1,projectId:-2,folderId:0}}),/DESTINATION/);
  assert.throws(()=>validate({op:'object.resize',fileKey:'abcdefgh',params:{sessionID:2,localID:3,width:750,height:0}}),/GEOMETRY/);
  assert.throws(()=>validate({op:'board.rename',fileKey:'abcdefgh',params:{name:''}}),/NAME/);
  assert.equal(validate({op:'board.close',fileKey:'abcdefgh'}).op,'board.close');
});
