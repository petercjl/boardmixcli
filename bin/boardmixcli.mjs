#!/usr/bin/env node
import {readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {startBridge} from '../lib/bridge.mjs';
import {operations,validate} from '../lib/protocol.mjs';
import {atomicCommand} from '../lib/commands.mjs';
import {maintenance,meta,parse,checkUpdate} from '../lib/maintenance.mjs';
const args=process.argv.slice(2), command=args.shift();
const output=x=>process.stdout.write(JSON.stringify(x,null,2)+'\n');
function flag(k){const i=args.indexOf(k);return i<0?undefined:args[i+1];}
async function absent(p){try{await stat(p);throw Error('TARGET_EXISTS: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}}
try {
  if(['skill','update','doctor'].includes(command))output(await maintenance(command,args));
  else if(['board.info','board.create','board.rename','board.open','board.close','image.list','image.inspect','image.import','object.selection','object.get','object.move','object.resize','view.fit'].includes(command)){await checkUpdate({automatic:true});output(await atomicCommand(command,args));}
  else if(command==='version'||command==='--version') {parse(args,{'--json':'boolean'});output({package:meta.name,version:meta.version});}
  else if(command==='capabilities') output(JSON.parse(await readFile(new URL('../capabilities.json',import.meta.url),'utf8')));
  else if(command==='serve') {
    const target=flag('--session');if(!target)throw Error('SESSION_PATH_REQUIRED');
    const session=path.resolve(target), boot=session+'.bootstrap.js';await absent(session);await absent(boot);
    const bridge=await startBridge();
    try{await writeFile(session,JSON.stringify({endpoint:bridge.endpoint,token:bridge.token}),{flag:'wx',mode:0o600});await writeFile(boot,bridge.bootstrap(),{flag:'wx',mode:0o600});}
    catch(e){bridge.server.close();throw e;}
    output({listening:bridge.endpoint,session,bootstrap:boot});
  } else if(['status','request'].includes(command)) {
    const target=flag('--session');if(!target)throw Error('SESSION_PATH_REQUIRED');
    const {endpoint,token}=JSON.parse(await readFile(target,'utf8'));
    if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint)||typeof token!=='string')throw Error('INVALID_SESSION');
    const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    let request;
    if(command==='request'){const file=flag('--input');if(!file)throw Error('INPUT_PATH_REQUIRED');request=validate(JSON.parse(await readFile(file,'utf8')));}
    const r=await fetch(endpoint+(command==='status'?'/status':'/request'),{method:request?'POST':'GET',headers,body:request?JSON.stringify(request):undefined,signal:AbortSignal.timeout(20000)});
    const result=await r.json();output(result);if(!r.ok||result.ok===false)process.exitCode=1;
  } else output({usage:['serve --session <new-private-session-file>','status --session <file>','request --session <file> --input <json-file>','board.info | board.create | board.rename | board.open | board.close','image.list | image.inspect | image.import','object.selection | object.get | object.move | object.resize','view.fit --ids <JSON-GUID-array>','version','capabilities'],stage:'atomic-command-prototype'});
} catch(error) {output({ok:false,error:error.message,...error.details?{details:error.details}:{}});process.exitCode=1;}
