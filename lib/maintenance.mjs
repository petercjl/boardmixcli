import {readFile,writeFile,mkdir,readdir,lstat,cp,rename,rm,mkdtemp,chmod} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {homedir,tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

export const root=fileURLToPath(new URL('../',import.meta.url));
export const meta=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const capabilityManifest=JSON.parse(await readFile(path.join(root,'capabilities.json'),'utf8'));
const components=['bin','lib','plugin','scripts','package.json','capabilities.json','CONTRACT.md','README.md','INSTALL.md','UPDATE.md','LICENSE'];
const receiptName='.boardmixcli-receipt.json';
const fail=(code,details)=>{throw Object.assign(Error(code),{details});};
const json=async p=>JSON.parse(await readFile(p,'utf8'));
async function exists(p){try{return await lstat(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export function parse(args,allowed){
 const result={};
 for(let i=0;i<args.length;i++){
  const k=args[i]; if(!Object.hasOwn(allowed,k)||Object.hasOwn(result,k))fail('INVALID_ARGUMENT',{argument:k});
  if(allowed[k]==='boolean')result[k]=true;
  else {const v=args[++i];if(!v||v.startsWith('--'))fail('MISSING_ARGUMENT',{argument:k});result[k]=v;}
 }return result;
}
function targetOf(o){
 if(!o['--agent']||! /^[a-z][a-z0-9-]{0,63}$/.test(o['--agent']))fail('INVALID_AGENT');
 if(!o['--destination']||!path.isAbsolute(o['--destination']))fail('DESTINATION_REQUIRED',{recovery:'Resolve the current Agent exact Skill directory and pass --destination absolute-path.'});
 const t=path.resolve(o['--destination']);
 const runtimeSelf=path.resolve(root)===path.join(t,'.runtime');
 if(t===path.parse(t).root||t===homedir()||t===path.resolve(root)||(!runtimeSelf&&root.startsWith(t+path.sep))||t.startsWith(root+path.sep))fail('UNSAFE_DESTINATION');
 return t;
}
async function tree(dir,prefix=''){
 const out={};
 for(const e of await readdir(dir,{withFileTypes:true})){
  const rel=prefix+e.name,p=path.join(dir,e.name);
  if(e.isSymbolicLink())fail('SYMLINK_UNSUPPORTED',{path:p});
  if(e.isDirectory())Object.assign(out,await tree(p,rel+'/'));
  else if(e.isFile())out[rel]=createHash('sha256').update(await readFile(p)).digest('hex');
 }return out;
}
async function expected(){
 const out=await tree(path.join(root,'skills/boardmixcli'));
 for(const name of components){
  const p=path.join(root,name),s=await lstat(p);
  if(s.isDirectory()){for(const [k,v] of Object.entries(await tree(p)))if(!k.includes('.bak'))out['.runtime/'+name+'/'+k]=v;}
  else out['.runtime/'+name]=createHash('sha256').update(await readFile(p)).digest('hex');
 }
 // The isolated runtime also carries its own canonical Skill for lifecycle commands.
 for(const [k,v] of Object.entries(await tree(path.join(root,'skills/boardmixcli'))))out['.runtime/skills/boardmixcli/'+k]=v;
 return out;
}
export async function status(o){
 const target=targetOf(o),s=await exists(target);
 const base={name:'boardmixcli',package:meta.name,version:meta.version,target,agent:o['--agent'],installed:!!s,managed:false,current:false,edited:[],verification:{verified:false,algorithm:'sha256'},recovery:{action:'skill install with the same explicit target'},hostDiscovery:'pending-host-verification'};
 if(!s)return base;
 if(!s.isDirectory()||s.isSymbolicLink())fail('UNMANAGED_TARGET',{target});
 const r=await json(path.join(target,receiptName)).catch(()=>null);
 if(!r||r.package!==meta.name||r.agent!==o['--agent']||!r.hashes||r.target!==target)return base;
 base.managed=true;const actual=await tree(target);delete actual[receiptName];
 const wanted=await expected();
 // UI metadata is host-owned after first installation; preserve it across reconciliation.
 const hostOwned=k=>k.startsWith('agents/');
 base.edited=Object.keys(actual).filter(k=>!hostOwned(k)&&(!r.hashes[k]||actual[k]!==r.hashes[k]));
 const exact=Object.entries(wanted).every(([k,h])=>hostOwned(k)||actual[k]===h);
 base.current=r.version===meta.version&&exact&&base.edited.length===0;
 base.verification={verified:base.current,algorithm:'sha256',installedVersion:r.version};
 base.recovery={action:base.edited.length?'Preserve local edits and resolve ownership before updating.':base.current?'none':'skill update with this explicit target'};
 return base;
}
export async function install(o,{renameTarget=rename}={}){
 const target=targetOf(o),prior=await status(o);
 if(prior.installed&&!prior.managed)fail('UNMANAGED_TARGET',{target});
 if(prior.edited.length)fail('EDITED_TARGET',{target,edited:prior.edited});
 if(prior.current)return {...prior,changed:false};
 await mkdir(path.dirname(target),{recursive:true});
 const stage=await mkdtemp(path.join(path.dirname(target),'.boardmixcli-stage-'));
 let backup;
 try{
  for(const e of await readdir(path.join(root,'skills/boardmixcli')))await cp(path.join(root,'skills/boardmixcli',e),path.join(stage,e),{recursive:true,errorOnExist:true,force:false});
  const runtime=path.join(stage,'.runtime');await mkdir(runtime);
  for(const name of components)await cp(path.join(root,name),path.join(runtime,name),{recursive:true,filter:p=>!p.includes('.bak'),force:false,errorOnExist:true});
  await cp(path.join(root,'skills/boardmixcli'),path.join(runtime,'skills/boardmixcli'),{recursive:true});
  if(prior.installed&&await exists(path.join(target,'agents'))){await rm(path.join(stage,'agents'),{recursive:true,force:true});await cp(path.join(target,'agents'),path.join(stage,'agents'),{recursive:true});}
  const hashes=await tree(stage);
  await writeFile(path.join(stage,receiptName),JSON.stringify({package:meta.name,version:meta.version,agent:o['--agent'],target,hashes,sourceVersion:meta.version},null,2)+'\n',{flag:'wx',mode:0o600});
  let inPlace=false;
  if(prior.installed){
   backup=target+'.backup-'+randomUUID();
   try{await renameTarget(target,backup);}
   catch(e){
    if(!['EBUSY','EPERM','EACCES'].includes(e.code))throw e;
    await cp(target,backup,{recursive:true,force:false,errorOnExist:true});
    inPlace=true;
   }
  }
  if(inPlace){
   // Locked-directory update: snapshot first, copy complete resources, commit receipt last.
   try{
    for(const e of await readdir(stage))if(e!==receiptName)await cp(path.join(stage,e),path.join(target,e),{recursive:true,force:true});
    await cp(path.join(stage,receiptName),path.join(target,receiptName),{force:true});
   }catch(e){fail('SKILL_SYNC_FAILED',{target,backup,phase:'in-place-sync',recovery:'Restore the complete preserved backup after releasing host file locks.'});}
  }else try{await rename(stage,target);}catch(e){if(backup)await rename(backup,target);throw e;}
  const result=await status(o);if(!result.current)fail('INSTALL_VERIFICATION_FAILED',{target,backup});
  return {...result,changed:true,...backup?{backup}:{}};
 }finally{await rm(stage,{recursive:true,force:true});}
}
const newerVersion=(candidate,current)=>{const a=candidate.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)$/),b=current.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)/);if(!a||!b)return false;for(let i=1;i<4;i++){if(Number(a[i])!==Number(b[i]))return Number(a[i])>Number(b[i]);}return false;};
const cacheDir=()=>process.env.BOARDMIXCLI_CACHE_DIR||path.join(homedir(),'.cache','boardmixcli');
export async function checkUpdate({automatic=false}={}){
 if(process.env.BOARDMIXCLI_UPDATE_CHECK==='0')return {enabled:false};
 const p=path.join(cacheDir(),'update.json');
 const cached=await json(p).catch(()=>null);
 if(automatic&&cached&&Date.now()-cached.checkedAt<24*3600e3)return {...cached,cached:true};
 let result;
 try{
  const r=await fetch('https://registry.npmjs.org/@petercjl%2fboardmixcli/latest',{signal:AbortSignal.timeout(automatic?1200:10000)});
  if(!r.ok)throw Error('REGISTRY_'+r.status);
  const published=await r.json();result={checkedAt:Date.now(),version:meta.version,latest:published.version,available:newerVersion(published.version,meta.version)};
 }catch(e){result={checkedAt:Date.now(),version:meta.version,available:false,error:e.message,recovery:'Retry update check after network recovery.'};}
 try{
  await mkdir(cacheDir(),{recursive:true});
  const prior=await exists(p);
  if(!prior)await writeFile(p,JSON.stringify({...result,owner:meta.name}),{flag:'wx',mode:0o600});
  else if(!prior.isSymbolicLink()&&cached?.owner===meta.name){
   const next=p+'.'+randomUUID();await writeFile(next,JSON.stringify({...result,owner:meta.name}),{flag:'wx',mode:0o600});await rename(next,p);
  }
 }catch{}
 if(automatic&&result.available)process.stderr.write(`boardmixcli: ${result.latest} available; ask your Agent to update CLI and its selected Skill.\n`);
 return result;
}
async function run(cmd,args){return new Promise((resolve,reject)=>{const c=spawn(cmd,args,{stdio:['ignore','pipe','pipe'],shell:false});let out='',err='';c.stdout.on('data',x=>out+=x);c.stderr.on('data',x=>err+=x);c.on('error',reject);c.on('exit',code=>code===0?resolve(out):reject(Object.assign(Error('UPDATE_COMMAND_FAILED'),{details:{phase:'candidate-install',code,stderr:err.slice(-2000)}})));});}
export async function updateInstall(o){
 const before=await status(o);if(before.installed&&(!before.managed||before.edited.length))fail('TARGET_PROTECTED',before);
 if(!o['--yes'])fail('CONFIRMATION_REQUIRED');
 // Stage into a private managed prefix. Replace neither the npm package nor selected Skill on a download failure.
 const latest=await checkUpdate();if(latest.error||!latest.latest)fail('UPDATE_CHECK_FAILED',latest);
 if(latest.latest!==meta.version&&!newerVersion(latest.latest,meta.version))return {...await install(o),packageChanged:false,installedAhead:true,registryVersion:latest.latest};
 const stage=await mkdtemp(path.join(tmpdir(),'boardmixcli-update-'));
 const npmCli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 try{
  if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(latest.latest))fail('INVALID_REGISTRY_VERSION');
  const npmArgs=['install','--prefix',stage,'--ignore-scripts','--no-audit','--no-fund',meta.name+'@'+latest.latest];
  if(process.platform==='win32'){
   if(!await exists(npmCli))fail('NPM_RUNTIME_UNAVAILABLE',{recovery:'Use npm-managed execution or configure npm_execpath to npm-cli.js.'});
   await run(process.execPath,[npmCli,...npmArgs]);
  }else await run('npm',npmArgs);
  const candidate=path.join(stage,'node_modules/@petercjl/boardmixcli/bin/boardmixcli.mjs');
  const result=JSON.parse(await run(process.execPath,[candidate,'skill','update','--agent',o['--agent'],'--destination',o['--destination'],'--json']));
  if(!result.current)fail('SKILL_SYNC_FAILED',result);
  return {...result,entry:path.join(o['--destination'],'.runtime/bin/boardmixcli.mjs'),packageChanged:meta.version!==latest.latest,recovery:{action:'Use the selected Skill target-owned entry; refresh host discovery.'}};
 }finally{await rm(stage,{recursive:true,force:true});}
}
export async function maintenance(command,args){
 if(command==='doctor'){
  parse(args,{'--json':'boolean'});
  return {ok:Number(process.versions.node.split('.')[0])>=22,package:meta.name,version:meta.version,node:process.version,platform:process.platform,adapterBuild:'index-DjSD2oPg.js',service:{connected:false,required:'Run browser.ensure for managed Chrome startup and login, then browser.connect; inspect status --session FILE.'},skill:{source:path.join(root,'skills/boardmixcli'),registration:'host-owned'}};
 }
 const action=args.shift();
 if(command==='skill'){
  if(action==='source'){parse(args,{'--json':'boolean'});return {name:'boardmixcli',package:meta.name,version:meta.version,source:path.join(root,'skills/boardmixcli'),maintenanceContract:capabilityManifest.maintenanceContract,commandContracts:capabilityManifest.commandContracts};}
  if(!['status','install','update'].includes(action))fail('UNKNOWN_COMMAND');
  if(args.includes('--help')){parse(args,{'--help':'boolean','--json':'boolean'});return {command:'skill '+action,...capabilityManifest.commandContracts['skill '+action]};}
  const o=parse(args,{'--agent':'string','--destination':'string','--json':'boolean'});
  return action==='status'?status(o):install(o);
 }
 if(command==='update'){
  if(action==='check'){parse(args,{'--json':'boolean'});return checkUpdate();}
  if(action==='install')return updateInstall(parse(args,{'--agent':'string','--destination':'string','--yes':'boolean','--json':'boolean'}));
 }fail('UNKNOWN_COMMAND');
}
