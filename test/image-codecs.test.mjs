import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import http from 'node:http';
import {imageMetadata,downloadImage} from '../lib/image-codecs.mjs';
test('JPEG and WebP dimensions use encoded bytes and malformed segments fail',()=>{
 const jpeg=Buffer.from([255,216,255,192,0,8,8,0,20,0,30,1,255,217]);assert.deepEqual(imageMetadata(jpeg),{mime:'image/jpeg',width:30,height:20});
 const webp=Buffer.alloc(30);webp.write('RIFF');webp.write('WEBP',8);webp.write('VP8X',12);webp.writeUIntLE(749,24,3);webp.writeUIntLE(1474,27,3);assert.deepEqual(imageMetadata(webp),{mime:'image/webp',width:750,height:1475});
 assert.throws(()=>imageMetadata(Buffer.from([255,216,255,192,255,255])),/INVALID_JPEG/);
});
test('image download preserves bytes, refuses an existing file and rejects HTML before writing',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bm-download-')),image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const server=http.createServer((req,res)=>res.end(req.url==='/png'?image:'<html>login required</html>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 try{const file=path.join(dir,'source.png');await downloadImage(url+'/png',file);assert.deepEqual(await readFile(file),image);await assert.rejects(downloadImage(url+'/png',file),/TARGET_EXISTS/);const invalid=path.join(dir,'invalid.png');await assert.rejects(downloadImage(url+'/html',invalid),/UNSUPPORTED_IMAGE_FORMAT/);await assert.rejects(readFile(invalid),/ENOENT/);}
 finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
