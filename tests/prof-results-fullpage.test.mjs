import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sticky=readFileSync(new URL('../results-overview-sticky.mjs',import.meta.url),'utf8');

test('résumé professeur : défilement vertical de la page et horizontal du tableau',()=>{
 assert.match(css,/\.results-overview-scroll\{height:auto;max-height:none\}/);
 assert.match(css,/\.results-overview-scroll\{max-width:100%;overflow-x:auto;overflow-y:hidden/);
 assert.doesNotMatch(css,/\.results-overview-scroll\{max-height:70vh/);
});
test('en-tête flottant fixé en haut et première colonne épinglée à gauche',()=>{
 assert.match(css,/\.results-overview-floating-head\{position:fixed;top:0/);
 assert.match(css,/\.results-overview-table tbody td:first-child\{position:sticky;left:0/);
 assert.match(sticky,/original\.top < 0/);
 assert.match(sticky,/area\.bottom > original\.height/);
 assert.match(sticky,/wrapper\.scrollLeft/);
 assert.match(sticky,/targetCells\[0\]\.style\.transform/);
});
test('le code ferme les observateurs au changement de vue et au détail élève',()=>{
 assert.match(app,/attachResultsOverviewSticky\(scroll,table\)/);
 assert.match(app,/if\(selected!=='results'\)detachResultsOverviewSticky\(\)/);
 assert.match(app,/function showOverviewDetail\(person,apps,focusedApp=false\)\{\s*detachResultsOverviewSticky\(\)/);
 assert.match(sticky,/observer\?\.disconnect\(\)/);
 assert.match(sticky,/floating\.remove\(\)/);
});
