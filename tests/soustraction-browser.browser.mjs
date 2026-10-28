import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const klass='22222222-2222-4222-8222-222222222222';
const student='33333333-3333-4333-8333-333333333333';
const types={'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png','.css':'text/css'};
const session={user:{id:student,is_anonymous:true},access_token:'TEST_ONLY_ACCESS_TOKEN'};
const browserStub='export function createClient(){return {auth:{getSession:async()=>({data:{session:'+JSON.stringify(session)+'}})}}}';
async function serve(){
 const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(root+'/')){res.writeHead(403).end();return}
  try{const bytes=await readFile(target);res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes)}
  catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('Chromium réel : lanceur libre et moteur autonome s’affichent', {timeout:120000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:768}});
  await page.goto(url+'/apps/soustraction-simple/',{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('iframe');
  await frame.locator('#menuScreen').waitFor({timeout:30000});
  assert.equal(await frame.locator('input[name="borrowMethod"]').count(),2);
  assert.equal(await frame.locator('button#masterModeReset').count(),1);
  assert.equal(await page.locator('header#ce-toolbar').count(),1);
  assert.ok((await frame.locator('body').textContent()).includes('Soustraction'));
  await page.close();
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
test('Chromium réel : Connect -> fin de partie -> trophée -> file -> serveur factice', {timeout:120000},async()=>{
 const {server,url}=await serve(),received=[],unmocked=[];
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1024,height:768}});
  const page=await context.newPage();
  await page.route('**/*',async route=>{
   const uri=route.request().url();
   if(uri.startsWith(url))return route.continue();
   if(uri.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:browserStub});
   if(uri.startsWith('https://mr-tat.github.io/Mathas-Connect/apps/soustraction-simple/')){
    const target=resolve(root,'apps/soustraction-simple',uri.split('/').pop());
    const bytes=await readFile(target);
    return route.fulfill({status:200,contentType:types[extname(target)]||'application/octet-stream',headers:{'access-control-allow-origin':'*'},body:bytes});
   }
   if(uri.includes('.supabase.co/functions/v1/')){
    const data=JSON.parse(route.request().postData()||'{}');
    const reply=body=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
    if(data.action==='student-load')return reply({ok:true,state:null,revision:received.length,resetEpoch:0});
    if(data.action==='student-me')return reply({ok:true,status:'approved',classId:klass,displayName:'Élève test'});
    if(data.action==='student-xp')return reply({ok:true,appXp:received.length*22,total:received.length*22,level:1,next:50,milestones:[],currentMilestones:[],parcours:1,repeatXp:false,max:474});
    if(data.action==='game-record'){
     received.push(data);
     return reply({ok:true,revision:received.length,resetEpoch:0,duplicate:false,xp:{appXp:received.length*22,total:received.length*22,level:1,previousLevel:1,next:50,delta:22}});
    }
    throw new Error('Action Connect non simulée : '+data.action);
   }
   unmocked.push(uri);
   await route.abort();
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/apps/soustraction-simple/?class='+klass,{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('iframe');
  await frame.locator('#menuScreen').waitFor({timeout:30000});
  assert.match(await page.locator('#ce-identity').textContent(),/Élève test/);
  await frame.locator('input[name="borrowMethod"][value="takeTop"]').evaluate(input=>input.closest('label').click());
  await frame.locator('body').evaluate(()=>window.__setLastWork({label:'Mort subite · Niveau 1',score:'5',rulerUsed:false}));
  await page.waitForFunction(()=>document.querySelector('#ce-sync')?.textContent?.includes('Synchronisé'),{timeout:20000});
  assert.equal(received.length,1,'une seule partie envoyée');
  assert.equal(received[0].appKey,'soustraction-ecrite-simple');
  assert.equal(received[0].method,'takeTop');
  assert.equal(received[0].mode,'sudden');
  assert.equal(received[0].score,5);
  assert.ok(received[0].rewards?.version===3,'trophées natifs envoyés dans la même requête');
  await frame.locator('input[name="borrowMethod"][value="addBottom"]').evaluate(input=>input.closest('label').click());
  await frame.locator('body').evaluate(()=>window.__setLastWork({label:'Calculs · Niveau 1',score:'4/4',rulerUsed:false}));
  await page.waitForFunction(()=>document.querySelector('#ce-sync')?.textContent?.includes('Synchronisé'),{timeout:20000});
  await page.waitForTimeout(500);
  assert.equal(received.length,2,'deuxième partie séparée enregistrée');
  assert.equal(received[1].mode,'classic');
  assert.equal(received[1].score,4);
  assert.ok(received[1].rewards?.version===3);
  assert.deepEqual(unmocked,[],'aucune requête non simulée');
  assert.deepEqual(errors,[],'aucune erreur JavaScript');
  await page.close();
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test('Chromium petit PC et GSM : en-tête Connect, lien HUB, XP et jeu restent dans la fenêtre', {timeout:120000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 try{
  for(const width of [320,360,390,768,1024]){
   const page=await browser.newPage({viewport:{width,height:740},reducedMotion:'reduce'});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const uri=route.request().url();
    if(uri.startsWith(url))return route.continue();
    if(uri.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:browserStub});
    if(uri.startsWith('https://mr-tat.github.io/Mathas-Connect/apps/soustraction-simple/')){
      const bytes=await readFile(resolve(root,'apps/soustraction-simple',uri.split('/').pop()));
      return route.fulfill({status:200,contentType:types[extname(uri)]||'application/octet-stream',headers:{'access-control-allow-origin':'*'},body:bytes});
    }
    if(uri.includes('.supabase.co/functions/v1/')){
      const data=JSON.parse(route.request().postData()||'{}');
      const response=data.action==='student-load'?{ok:true,state:null,revision:0,resetEpoch:0}:
                     data.action==='student-me'?{ok:true,status:'approved',classId:klass,displayName:'Élève test'}:
                     data.action==='student-xp'?{ok:true,appXp:22,total:22,level:1,delta:0,milestones:[],currentMilestones:[],parcours:1,repeatXp:false,max:474}:
                     {ok:false,error:'unexpected_action'};
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
    }
    return route.abort();
   });
   await page.goto(url+'/apps/soustraction-simple/?class='+klass,{waitUntil:'domcontentloaded'});
   await page.frameLocator('iframe').locator('#menuScreen').waitFor({timeout:25000});
   const geom=await page.evaluate(()=>{
      const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return {viewport:innerWidth,bodyScroll:document.documentElement.scrollWidth,
       toolbar:rect('#ce-toolbar'),iframe:rect('iframe'),
       global:rect('#ce-global-info'),app:rect('#ce-application-info'),
       hub:rect('#ce-hub-link'),xp:rect('#ce-xp-meter'),button:rect('#xp-toolbar-button'),
       sync:rect('#ce-sync')};
   });
   assert.ok(geom.bodyScroll<=width+2,'largeur '+width+' : débordement horizontal '+JSON.stringify(geom));
   for(const id of ['toolbar','iframe','hub','xp','button']){
     assert.ok(geom[id].left>=-2&&geom[id].right<=width+2,
       'largeur '+width+' : '+id+' hors écran '+JSON.stringify(geom));
   }
   assert.ok(geom.global.bottom<=geom.app.top+1||geom.app.bottom<=geom.global.top+1||
       geom.global.right<=geom.app.left+1||geom.app.right<=geom.global.left+1,
       'largeur '+width+' : colonnes Connect se chevauchent '+JSON.stringify(geom));
   assert.ok(geom.iframe.top>=geom.toolbar.bottom-1,'largeur '+width+' : jeu derrière barre Connect '+JSON.stringify(geom));
   assert.deepEqual(errors,[],'largeur '+width+' : erreurs JS');
   await page.close();
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
