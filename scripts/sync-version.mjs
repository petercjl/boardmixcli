// Release-only identity synchronization; prepack remains read-only.
import {readFile,writeFile,copyFile,stat,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
for(const name of ['capabilities.json','skills/boardmixcli/manifest.json']){
 const p=path.join(root,name);await stat(p);const x=JSON.parse(await readFile(p,'utf8'));
 if(x.version===pkg.version&&x.package===pkg.name)continue;
 const backup=path.join(root,'evidence','version-backups',randomUUID(),name);await mkdir(path.dirname(backup),{recursive:true});await copyFile(p,backup);x.version=pkg.version;x.package=pkg.name;
 await writeFile(p,JSON.stringify(x,null,2)+'\n');
}
