import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const p=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
for(const f of ['capabilities.json','skills/boardmixcli/manifest.json']){
 const x=JSON.parse(await readFile(path.join(root,f),'utf8'));
 if(x.version!==p.version||x.package!==p.name)throw Error('VERSION_DRIFT: '+f);
}
for(const f of ['INSTALL.md','UPDATE.md','CONTRACT.md','skills/boardmixcli/SKILL.md'])if(!(await readFile(path.join(root,f),'utf8')).trim())throw Error('MISSING_RESOURCE: '+f);
console.error('Package and Skill identity verified: '+p.name+'@'+p.version);
