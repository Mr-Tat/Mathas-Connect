import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const game of ['soustraction-simple', 'multiplication-simple']) {
  test(`badge de correction discret — ${game}`, () => {
    const html = readFileSync(new URL(`../apps/${game}/game-original.html`, import.meta.url), 'utf8');
    assert.match(html, /badge\.textContent=missed\?'×':'✓'/);
    assert.match(html, /mathas-calc-ok-badge\.mathas-calc-missed-badge\{width:25px;min-width:25px;height:25px/);
    assert.match(html, /Calcul corrigé après une erreur/);
    assert.doesNotMatch(html, /badge\.textContent=missed\?'Raté'/);
    assert.match(html, /font:900 26px\/1 system-ui/); // Grand V inchangé
  });
}
