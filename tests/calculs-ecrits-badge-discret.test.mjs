import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const games = [
  'apps/objective-record/engines/addition-simple/game-original.html',
  'apps/objective-record/engines/addition-multiple/index.html',
  'apps/soustraction-simple/game-original.html',
  'apps/multiplication-simple/game-original.html'
];
for (const game of games) {
  test(`badge de correction discret — ${game}`, () => {
    const html = readFileSync(new URL(`../${game}`, import.meta.url), 'utf8');
    assert.match(html, /badge\.textContent=missed\?'×':'✓'/);
    assert.match(html, /mathas-calc-ok-badge\.mathas-calc-missed-badge\{width:25px;min-width:25px;height:25px/);
    assert.match(html, /Calcul corrigé après une erreur/);
    assert.doesNotMatch(html, /badge\.textContent=missed\?'Raté'/);
    assert.match(html, /font:900 26px\/1 system-ui/); // Grand V inchangé
  });
}
