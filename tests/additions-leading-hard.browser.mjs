// Browser proof on the REAL unconnected native HARD engines.
// Only a deterministic Math.random stub and the visible UI: no fake score,
// no student identity, no Supabase network and no rewritten engine logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const examples=[
 {slug:'addition-simple',app:'addition-ecrite-simple',page:'essai-mode-score-3-vies.html'},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',page:'essai-objectif-record-3-vies.html'}
];
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
   const bytes=await readFile(file);
   const contentType=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript',
    '.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':contentType}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
for(const item of examples){
 test('HARD natif : retenue extérieure avant unités et surbrillance ambre · '+item.slug,async()=>{
  const {server,url}=await serve();let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1340,height:920}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url+'/apps/objective-record/engines/'+item.slug+'/'+item.page,
    {waitUntil:'domcontentloaded',timeout:28000});
   const game=page.frameLocator('#game');
   await game.locator('#menuScreen:not(.hidden)').waitFor({state:'visible',timeout:25000});
   await game.locator('#trainingMaxDigits option[value="__hard__"]').waitFor({state:'attached',timeout:12000});
   // Le moteur HARD local n'a pas besoin d'auth : activer le contrôle Connect
   // uniquement pour vérifier son rendu ambre sur l'iframe natif.
   const installed=await page.evaluate(async app=>{
    const frame=document.getElementById('game'),d=frame.contentDocument,w=frame.contentWindow;
    const {installTensFirstDuringGame}=await import('/apps/objective-record/in-game-tens-first.mjs');
    const ok=installTensFirstDuringGame(d,app);
    const home=d.getElementById('tensFirstToggle');
    home.checked=true;home.dispatchEvent(new w.Event('change',{bubbles:true}));
    // Chiffres 9 partout : deux nombres à chiffres max (simple), ou
    // plusieurs grands termes (multiple) => report au-delà du nombre.
    w.Math.random=()=>.999999;
    const select=d.getElementById('trainingMaxDigits');
    select.value='__hard__';select.dispatchEvent(new w.Event('change',{bubbles:true}));
    return ok;
   },item.app);
   assert.equal(installed,true);
   await game.locator('#hardMenuScreen:not(.hidden)').waitFor({state:'visible',timeout:15000});
   await game.locator('#hardLevelGrid .hard-start[data-level="1"][data-mode="training"]').click();
   await game.locator('#hardGameScreen:not(.hidden)').waitFor({state:'visible',timeout:15000});
   const carries=await game.locator('#hardGameScreen .hard-carry').evaluateAll(
    nodes=>nodes.map(n=>Number(n.dataset.col)));
   const last=Math.max(...carries),leading=last+1;
   assert.ok(last>=2,'une addition HARD doit comporter des colonnes de retenue');
   const lead=game.locator('.hard-answer[data-col="'+leading+'"]');
   const units=game.locator('.hard-answer[data-col="'+last+'"]');
   assert.equal(await lead.count(),1,'la somme doit dépasser la taille des nombres');
   assert.equal(await units.inputValue(),'');
   // Entrer les unités de la colonne précédente. HARD doit déplacer
   // automatiquement le curseur sur la nouvelle colonne de report.
   const previous=game.locator('.hard-answer[data-col="'+(last-1)+'"]');
   await previous.focus();await page.keyboard.press('0');
   await game.locator('.hard-answer[data-col="'+leading+'"].active-entry')
    .waitFor({state:'visible',timeout:5000});
   assert.equal(await units.evaluate(el=>el.classList.contains('mathas-amber-followup')),true);
   const amber=await units.evaluate(el=>getComputedStyle(el).backgroundColor);
   // Plusieurs palettes natives utilisent des variantes proches du même ambre ;
   // vérifier la teinte plutôt qu'une seule écriture CSS exacte.
   const rgb=amber.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
   // L'ambre historique du thème sombre peut être plus profond
   // (ex. rgba(182,131,50,.17)) : vérifier la dominante chaude.
   assert.ok(rgb&&Number(rgb[1])>=175&&Number(rgb[1])<=255
    &&Number(rgb[2])>=120&&Number(rgb[2])<=205
    &&Number(rgb[3])>=40&&Number(rgb[3])<=115
    &&Number(rgb[1])>Number(rgb[2])&&Number(rgb[2])>Number(rgb[3]),
    'ambre discret visible dans la case suivante : '+amber);
   await page.keyboard.press('1');
   assert.equal(await lead.inputValue(),'1','la retenue sortante est réellement saisie avant les unités');
   await game.locator('.hard-answer[data-col="'+last+'"].active-entry')
    .waitFor({state:'visible',timeout:5000});
   assert.equal(await units.evaluate(el=>el.classList.contains('mathas-amber-followup')),false);
   const classicCarry=game.locator('.hard-carry[data-col="1"]');
   const nextUnit=game.locator('.hard-answer[data-col="0"]');
   await classicCarry.focus();
   assert.equal(await nextUnit.evaluate(el=>el.classList.contains('mathas-amber-followup')),true,
    'le report ordinaire doit aussi annoncer sa case unité');
   await game.locator('#mathasTensFirstDuringGame-hard').uncheck();
   await classicCarry.focus();
   assert.equal(await nextUnit.evaluate(el=>el.classList.contains('mathas-amber-followup')),false,
    'sans dizaines d’abord, aucun halo ambre');
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(ok=>server.close(ok))}
 });
}
