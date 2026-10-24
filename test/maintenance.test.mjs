import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat,unlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {install,status,parse,meta,maintenance} from '../lib/maintenance.mjs';
test('arbitrary Agent install, read-only no-op, same-version missing repair and UI metadata preservation',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bm-lifecycle-')),target=path.join(dir,'skill');
 const o={'--agent':'future-agent','--destination':target};
 try{
  assert.equal((await status(o)).installed,false);
  assert.equal((await install(o)).current,true);
  const receipt=path.join(target,'.boardmixcli-receipt.json'),before=await stat(receipt);
  assert.equal((await install(o)).changed,false);assert.equal((await stat(receipt)).mtimeMs,before.mtimeMs);
  const ui=path.join(target,'agents/openai.yaml');await writeFile(ui,'custom host metadata\n');
  await unlink(path.join(target,'SKILL.md'));
  const repaired=await install(o);assert.equal(repaired.changed,true);assert.equal(repaired.current,true);assert.ok(repaired.backup);
  assert.equal(await readFile(ui,'utf8'),'custom host metadata\n');
  const installed=JSON.parse(await readFile(path.join(target,'manifest.json'),'utf8'));assert.equal(installed.version,meta.version);
  await writeFile(path.join(target,'SKILL.md'),'local user edits');
  await assert.rejects(install(o),/EDITED_TARGET/);assert.equal(await readFile(path.join(target,'SKILL.md'),'utf8'),'local user edits');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('strict parsing and unmanaged targets refuse before mutation; doctor remains read only',async()=>{
 assert.throws(()=>parse(['--destination','x','--destination','y'],{'--destination':'string'}),/INVALID_ARGUMENT/);
 assert.throws(()=>parse(['--destination'],{'--destination':'string'}),/MISSING_ARGUMENT/);
 assert.throws(()=>parse(['--mystery'],{}),/INVALID_ARGUMENT/);
 await assert.rejects(install({'--agent':'valid-agent'}),/DESTINATION_REQUIRED/);
 await assert.rejects(install({'--agent':'../bad','--destination':path.join(tmpdir(),'no-write')}),/INVALID_AGENT/);
 const dir=await mkdtemp(path.join(tmpdir(),'bm-protect-'));
 try{await writeFile(path.join(dir,'user.txt'),'preserve');await assert.rejects(install({'--agent':'any-agent','--destination':dir}),/UNMANAGED_TARGET/);assert.equal(await readFile(path.join(dir,'user.txt'),'utf8'),'preserve');}
 finally{await rm(dir,{recursive:true,force:true});}
 assert.equal((await maintenance('doctor',['--json'])).version,meta.version);
});
test('locked-directory update keeps a true backup and repairs missing resources',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'bm-locked-')),target=path.join(dir,'skill'),o={'--agent':'any-host','--destination':target};
 try{
  await install(o);await unlink(path.join(target,'SKILL.md'));
  const result=await install(o,{renameTarget:async()=>{throw Object.assign(Error('locked'),{code:'EBUSY'});}});
  assert.equal(result.current,true);assert.ok(result.backup);
  await assert.rejects(readFile(path.join(result.backup,'SKILL.md')),/ENOENT/);
  assert.ok(await readFile(path.join(target,'SKILL.md')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
