import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('../bin/boardmixcli.mjs',import.meta.url));
test('live source and typed help form a successful machine consumer contract',()=>{
 const invoke=args=>JSON.parse(execFileSync(process.execPath,[entry,...args,'--json'],{encoding:'utf8'}));
 const source=invoke(['skill','source']);assert.equal(source.ok,true);assert.equal(source.maintenanceContract.schemaVersion,1);
 const help=invoke(['skill','status','--help']);assert.equal(help.options['--destination'].type,'string');
});
