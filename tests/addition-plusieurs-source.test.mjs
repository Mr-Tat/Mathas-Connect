// Audit source statique, sans connexion à Supabase ni modification des résultats.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../apps/addition-plusieurs/',import.meta.url);
const game = readFileSync(new URL('game-original.html',root),'utf8');
const launcher = readFileSync(new URL('index.html',root),'utf8');
const expected = ['addition2_classic_v1','addition2_sudden_v1','addition2_hard_sudden_v3','addition2_hard_three_v2','addition2_last_work','mathas_progression_addition_plusieurs_v1'];
for(const key of expected) assert.ok(game.includes(key), 'Missing native key: '+key);
assert.match(game, /"appId":"addition-plusieurs"/);
assert.match(game, /MathasAppConfig/);
const ends = (game.match(/window\.__setLastWork\s*&&\s*window\.__setLastWork/g)||[]).length;
assert.equal(ends,4,'Unexpected terminal event count: review mapping manually');
assert.match(launcher, /fetch\('\.\/game-original\.html'\)/);
assert.doesNotMatch(launcher, /connect-results|connect-api|game-record|SUPABASE/);
const audit = readFileSync(new URL('audit-bridge.js',root),'utf8');
assert.match(audit, /__setLastWork/);
assert.doesNotMatch(audit, /connect-results|connect-api|game-record|SUPABASE/);
console.log('PASS: source keys, four terminal-event calls, free-only staging wrapper. XP contract NOT tested.');

const originalIllustration=readFileSync(new URL('illustration.webp',root));
const catalogIllustration=readFileSync(new URL('../assets/miniatures/addition-ecrite-multiple.webp',root));
assert.deepEqual(catalogIllustration,originalIllustration,'Staged catalog thumbnail missing or differs from native illustration');
