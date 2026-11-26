import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('La moitié : moteur autonome synchronisé',()=>{execFileSync(process.execPath,[fileURLToPath(new URL('../apps/DIV-Milieu-de-segment-1/tests/engine.cjs',import.meta.url))],{stdio:'pipe'});});
