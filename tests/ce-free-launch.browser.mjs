// Recette de démarrage des moteurs réels SANS session Connect.
// Cette suite utilise un serveur HTTP local pour les fichiers statiques ; elle
// simule l'indisponibilité des services extérieurs, et non l'absence du fichier
// HTML (qui exige un premier chargement Internet sans service worker).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname,extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const klass='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.css':'text/css'};
const apps=[
 {name:'multiplication',slug:'multiplication-simple'},
 {name:'soustraction',slug:'soustraction-simple'}
];
async function serve(){
 const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const path=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!path.startsWith(root+'/')){res.writeHead(403).end();return}
  try{
   const file=await readFile(path);
   res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'});
   res.end(file);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
async function openGame(browser,url,app,{withClass=false,explicitFree=false,requireConnect=false}={}){
 const page=await browser.newPage({viewport:{width:1024,height:800}});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(explicitFree)await page.addInitScript(()=>{
  localStorage.setItem('mathas.connect.mode-libre.v1','1');
 });
 await page.route('**/*',route=>{
  if(route.request().url().startsWith(url+'/'))return route.continue();
  external.push(route.request().url());
  return route.abort('internetdisconnected');
 });
 const params=new URLSearchParams();
 if(withClass)params.set('class',klass);
 if(requireConnect)params.set('requireConnect','1');
 const path='/apps/'+app.slug+'/' + (params.size?'?'+params.toString():'');
 await page.goto(url+path,{waitUntil:'domcontentloaded'});
 return {page,errors,external};
}
test('Multiplication et Soustraction : vrai menu et exercice guidé sans compte Connect', {timeout:120000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 try{
  for(const app of apps){
   for(const scenario of [
    {name:'sans classe',withClass:false,explicitFree:false},
    {name:'classe et libre explicite',withClass:true,explicitFree:true},
    {name:'classe et SDK inaccessible',withClass:true,explicitFree:false}
   ]){
    const {page,errors,external}=await openGame(browser,url,app,scenario);
    try{
     const frame=page.frameLocator('iframe');
     await frame.locator('#menuScreen').waitFor({state:'visible',timeout:16000});
     await frame.locator(app.slug==='multiplication-simple'?'#startTraining':'#trainingChoiceBtn').click();
     await frame.locator('#gameScreen').waitFor({state:'visible',timeout:16000});
     assert.ok(await frame.locator('#calculationsPair .calc-box').count()>0,app.name+' '+scenario.name+' : aucun calcul');
     await frame.locator('#menuBtn').click();
     await frame.locator('#menuScreen').waitFor({state:'visible'});
     const selector=frame.locator('.classic-count-btn[data-count="4"]');
     assert.ok(await selector.count()>0,app.name+' '+scenario.name+' : série Classique manquante');
     await selector.click();
     await frame.locator('#gameScreen').waitFor({state:'visible',timeout:16000});
     assert.deepEqual(errors,[],app.name+' '+scenario.name+' : '+errors.join('; '));
     if(scenario.explicitFree)assert.equal(external.some(x=>x.includes('supabase')),false,
      app.name+' : le mode libre ne doit même pas chercher une session Connect');
    }finally{await page.close()}
   }
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
test('Un lancement scolaire officiel exige toujours Connect et ne donne jamais de faux XP', {timeout:120000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 try{
  for(const app of apps){
   const {page}=await openGame(browser,url,app,{withClass:true,requireConnect:true});
   try{
    await page.locator('#loading #message').waitFor({timeout:16000});
    await page.waitForFunction(()=>document.querySelector('#loading #message')?.textContent?.includes('Connect'),null,{timeout:16000});
    assert.equal(await page.locator('iframe').count(),0,app.name+' : aucun moteur libre sous requireConnect');
    // Un clic VOLONTAIRE ouvre un autre parcours local, sans certification ni
    // écriture Connect. L'URL scolaire n'est jamais rétrogradée en silence.
    await page.getByRole('button',{name:/Jouer librement \(sans XP Connect\)/}).click();
    await page.frameLocator('iframe').locator('#menuScreen').waitFor({state:'visible',timeout:16000});
    assert.equal(new URL(page.url()).searchParams.get('requireConnect'),null);
    assert.equal(new URL(page.url()).searchParams.get('libre'),'1');
    assert.equal(new URL(page.url()).searchParams.get('class'),klass);
    assert.equal(await page.evaluate(()=>localStorage.getItem('mathas.connect.mode-libre.v1')),null,
      app.name+' : ne pas déconnecter silencieusement les autres apps');
    assert.equal(await page.locator('#ce-xp-meter').count(),0,app.name+' : aucune jauge scolaire en libre');
    const frame=page.frameLocator('iframe');
    await frame.locator(app.slug==='multiplication-simple'?'#startTraining':'#trainingChoiceBtn').click();
    await frame.locator('#gameScreen').waitFor({state:'visible'});
    await frame.locator('#menuBtn').click();
    await frame.locator('.classic-count-btn[data-count="4"]').click();
    await frame.locator('#gameScreen').waitFor({state:'visible'});
   }finally{await page.close()}
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
