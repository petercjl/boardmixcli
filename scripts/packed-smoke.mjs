import {mkdtemp,readFile,rm,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),scratch=await mkdtemp(path.join(tmpdir(),'boardmix-packed-'));
const npmCli=process.env.npm_execpath||fileURLToPath(new URL('../../../npm/bin/npm-cli.js',import.meta.url));
function npm(args){return execFileSync(process.execPath,[npmCli,...args],{cwd:root,encoding:'utf8',env:{...process.env,BOARDMIXCLI_UPDATE_CHECK:'0'}});}
function cli(entry,args){return JSON.parse(execFileSync(process.execPath,[entry,...args],{encoding:'utf8',env:{...process.env,BOARDMIXCLI_UPDATE_CHECK:'0'}}));}
try{
 const packed=JSON.parse(npm(['pack','--silent','--json','--pack-destination',scratch]))[0];
 assert.ok(packed.files.every(f=>!/(evidence|\.bak-|\.session\.|bootstrap\.js)/.test(f.path)));
 const bootstrap=path.join(scratch,'bootstrap');npm(['install','--prefix',bootstrap,'--ignore-scripts','--no-audit','--no-fund',path.join(scratch,packed.filename)]);
 const entry=path.join(bootstrap,'node_modules/@petercjl/boardmixcli/bin/boardmixcli.mjs');
 const version=cli(entry,['version']).version;
 for(const name of ['host-a','host-b']){
  const target=path.join(scratch,name),args=['--agent',name,'--destination',target,'--json'];
  assert.equal(cli(entry,['skill','status',...args]).installed,false);
  assert.equal(cli(entry,['skill','install',...args]).current,true);
  assert.equal(cli(entry,['skill','update',...args]).changed,false);
 }
 const a=path.join(scratch,'host-a/.runtime/bin/boardmixcli.mjs'),b=path.join(scratch,'host-b/.runtime/bin/boardmixcli.mjs');
 if(process.platform!=='win32')assert.notEqual((await stat(a)).ino,(await stat(b)).ino);
 await rm(bootstrap,{recursive:true});await rm(path.join(scratch,'host-a'),{recursive:true});
 assert.equal(cli(b,['version']).version,version);
 const png=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.write('IHDR',12);png.writeUInt32BE(750,16);png.writeUInt32BE(1475,20);
 const image=path.join(scratch,'图片.png');await writeFile(image,png);
 const result=cli(b,['image.inspect','--file',image]);assert.equal(result.width,750);assert.equal(result.height,1475);
 assert.equal(cli(b,['skill','status','--agent','host-b','--destination',path.join(scratch,'host-b'),'--json']).current,true);
 console.log(JSON.stringify({ok:true,version,packedFiles:packed.files.length,isolation:'bootstrap and host-a removed; host-b version, image.inspect and receipt verified',historicalUpdater:'0.1.0 retains the same explicit Skill destination and target-owned runtime contract; this smoke tests candidate isolation'}));
}finally{await rm(scratch,{recursive:true,force:true});}
