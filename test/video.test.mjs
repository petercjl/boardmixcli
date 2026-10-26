import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {inspectVideo,downloadVideo} from '../lib/video.mjs';
import {validate} from '../lib/protocol.mjs';
test('video import requires a stable operation identity and validated asset',()=>{
 const p={op:'video.import',fileKey:'abcdefgh',params:{assetId:'a'.repeat(64),operationId:'01234567-0123-0123-0123-012345678901'}};assert.equal(validate(p).op,'video.import');assert.throws(()=>validate({...p,params:{assetId:p.params.assetId}}),/INVALID_OPERATION_ID/);assert.throws(()=>validate({...p,params:{...p.params,assetId:'x'}}),/INVALID_ASSET_ID/);
});
test('video inspection rejects HTML and downloads preserve existing destinations',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'boardmix-video-'));const file=path.join(dir,'existing.mp4');try{await fs.writeFile(file,'<html>not video</html>');await assert.rejects(inspectVideo(file),/MP4_REQUIRED/);await assert.rejects(downloadVideo('https://example.test/a.mp4',file),/TARGET_EXISTS/);assert.equal(await fs.readFile(file,'utf8'),'<html>not video</html>');await assert.rejects(downloadVideo('http://example.test/a.mp4',path.join(dir,'new.mp4')),/HTTPS_REQUIRED/);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
