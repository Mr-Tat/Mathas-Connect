import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const klass='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
const other='71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json'};
const authStub=`
let session=new URLSearchParams(location.search).has('anonymous')?null:{
 user:{id:'teacher-fictif',is_anonymous:false},access_token:'TEST_TOKEN_NON_REEL'
};
const listeners=[];
window.__projectionSignOut=()=>{
 session=null;
 for(const listener of listeners)listener('SIGNED_OUT',null);
};
export function createClient(){
 return {auth:{
  getSession:async()=>({data:{session},error:null}),
  onAuthStateChange:(callback)=>{listeners.push(callback);return {data:{subscription:{unsubscribe(){}}}}}
 }};
}
`;
async function serve(){
 const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const target=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
   const bytes=await readFile(target);
   res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream','cache-control':'no-store'});
   res.end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('Projection : accès professeur, données anonymes, masquage et consommation bornée (Chromium)',{timeout:120000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 let dashboardCalls=0,overviewCalls=0;
 const errors=[],unmocked=[];
 try{
  const page=await browser.newPage({viewport:{width:1024,height:720}});
  page.on('pageerror',error=>errors.push(error.message));
  const routeMock=async route=>{
   const u=route.request().url();
   if(u.startsWith(url))return route.continue();
   if(u.startsWith('https://esm.sh/'))return route.fulfill({
    status:200,contentType:'application/javascript',
    headers:{'access-control-allow-origin':'*'},body:authStub});
   if(u.includes('.supabase.co/functions/v1/')){
    const body=JSON.parse(route.request().postData()||'{}');
    let result;
    if(body.action==='teacher-dashboard'){
     dashboardCalls++;
     result={ok:true,classes:[{id:klass,name:'Observation'},{id:other,name:'Phase 1'}]};
    }else if(body.action==='teacher-overview'){
     overviewCalls++;
     assert.equal(body.classId,klass,'seule la classe demandée est transmise');
     result={ok:true,students:[
      {id:'fake1',displayName:'NOM_CONFIDENTIEL_1',apps:[{appKey:'addition-ecrite-simple',
       state:{recent:[{at:new Date().toISOString(),score:4}]}}]},
      {id:'fake2',displayName:'NOM_CONFIDENTIEL_2',apps:[]}
     ]};
    }else throw Error('Action imprévue : '+body.action);
    return route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
   }
   unmocked.push(u);return route.abort();
  };
  await page.route('**/*',routeMock);
  await page.goto(url+'/projection.html?space=observation',{waitUntil:'domcontentloaded'});
  await page.locator('#controls').waitFor({state:'visible',timeout:20000});
  assert.equal(await page.locator('#class-choice').inputValue(),klass,'classe du lien professeur présélectionnée');
  assert.equal(await page.locator('#board').isHidden(),true,'aucune projection avant clic');
  assert.equal(dashboardCalls,1,'une lecture des classes seulement');
  assert.equal(overviewCalls,0,'aucune lecture de résultats automatique');
  await page.locator('#load').click();
  await page.locator('#board').waitFor({state:'visible'});
  assert.equal(await page.locator('#total').textContent(),'2');
  assert.equal(await page.locator('#participants').textContent(),'1');
  assert.equal(await page.locator('#today').textContent(),'1');
  const text=await page.locator('body').textContent();
  assert.doesNotMatch(text,/NOM_CONFIDENTIEL|fake1|fake2/,'aucune identité dans le DOM projeté');
  assert.doesNotMatch(text,/Soustraction secrète|Soustraction écrite/,'Soustraction masquée');
  assert.equal(overviewCalls,1);
  await page.locator('#hide').click();
  assert.equal(await page.locator('#board').isHidden(),true);
  assert.equal(await page.locator('#total').textContent(),'');
  assert.equal(overviewCalls,1,'masquage sans réseau');
  await page.locator('#load').click();
  await page.locator('#board').waitFor({state:'visible'});
  await page.evaluate(()=>window.__projectionSignOut());
  assert.equal(await page.locator('#board').isHidden(),true,'déconnexion efface les chiffres');
  assert.equal(await page.locator('#controls').isHidden(),true,'plus de commandes après déconnexion');
  assert.equal(await page.locator('#total').textContent(),'');
  assert.equal(await page.locator('#login-needed').isVisible(),true);
  await page.close();

  const anonymous=await browser.newPage({viewport:{width:390,height:740}});
  anonymous.on('pageerror',error=>errors.push(error.message));
  await anonymous.route('**/*',routeMock);
  const callsBefore=dashboardCalls,overviewBefore=overviewCalls;
  await anonymous.goto(url+'/projection.html?space=observation&anonymous=1',{waitUntil:'domcontentloaded'});
  await anonymous.locator('#login-needed').waitFor({state:'visible'});
  assert.equal(await anonymous.locator('#controls').isHidden(),true);
  assert.equal(await anonymous.locator('#board').isHidden(),true);
  assert.equal(dashboardCalls,callsBefore,'une session anonyme ne lit pas le tableau professeur');
  assert.equal(overviewCalls,overviewBefore,'une session anonyme ne lit pas les élèves');
  await anonymous.close();
  assert.deepEqual(errors,[],'aucune erreur JavaScript');
  assert.deepEqual(unmocked,[],'aucune requête externe imprévue');
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
});

test('Projection : 320 à 1024 pixels, aucun débordement et changement de classe sans requête', {timeout:120000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:740}});
  const errors=[];let overviewCalls=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const target=route.request().url();
   if(target.startsWith(url))return route.continue();
   if(target.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:authStub});
   if(target.includes('.supabase.co/functions/v1/')){
    const data=JSON.parse(route.request().postData()||'{}');
    if(data.action==='teacher-overview')overviewCalls++;
    const result=data.action==='teacher-dashboard'?
     {ok:true,classes:[{id:klass,name:'Observation'},{id:other,name:'Phase 1'}]}:
     {ok:true,students:[
      {displayName:'PRIVE',apps:[{appKey:'addition-ecrite-simple',state:{recent:[{at:new Date().toISOString()}]}},
       {appKey:'multiplication-ecrite-simple',state:{recent:[{at:new Date().toISOString()}]}}]},
      {displayName:'PRIVE 2',apps:[]}
     ]};
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
   }
   return route.abort();
  });
  await page.goto(url+'/projection.html?space=observation',{waitUntil:'domcontentloaded'});
  await page.locator('#controls').waitFor({state:'visible'});
  await page.locator('#load').click();
  await page.locator('#board').waitFor({state:'visible'});
  for(const width of [320,360,390,768,1024]){
   await page.setViewportSize({width,height:740});
   const layout=await page.evaluate(()=>{
    const rect=selector=>{
     const r=document.querySelector(selector).getBoundingClientRect();
     return {left:r.left,right:r.right,width:r.width};
    };
    return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,
     board:rect('#board'),selector:rect('#class-choice'),cards:rect('.cards'),rows:[...document.querySelectorAll('.app-row')].map(el=>{
      const r=el.getBoundingClientRect();return {left:r.left,right:r.right};
     })};
   });
   assert.ok(layout.pageWidth<=width+2,'horizontal scroll at '+width+': '+JSON.stringify(layout));
   for(const target of [layout.board,layout.selector,layout.cards,...layout.rows]){
    assert.ok(target.left>=-2&&target.right<=width+2,
     'element outside '+width+': '+JSON.stringify(layout));
   }
  }
  assert.equal(overviewCalls,1,'viewport resize makes no extra Supabase call');
  await page.locator('#class-choice').selectOption(other);
  assert.equal(await page.locator('#board').isHidden(),true,'changing classes clears the projected numbers');
  assert.equal(await page.locator('#total').textContent(),'');
  assert.equal(overviewCalls,1,'changing classes makes no automatic data request');
  assert.deepEqual(errors,[],'no browser script errors');
  await page.close();
 }finally{
  await browser.close();await new Promise(done=>server.close(done));
 }
});

test('Projection : un résultat réseau retardé ne réaffiche jamais des chiffres masqués', {timeout:120000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox']});
 let respond,started=0;const waitReply=new Promise(resolve=>{respond=resolve});
 try{
  const page=await browser.newPage({viewport:{width:390,height:740}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const target=route.request().url();
   if(target.startsWith(url))return route.continue();
   if(target.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:authStub});
   if(target.includes('.supabase.co/functions/v1/')){
    const data=JSON.parse(route.request().postData()||'{}');
    if(data.action==='teacher-overview'){
     started++;
     await waitReply;
    }
    const result=data.action==='teacher-dashboard'?
     {ok:true,classes:[{id:klass,name:'Observation'}]}:
     {ok:true,students:[{displayName:'DONNEE-PRIVEE',apps:[{appKey:'addition-ecrite-simple',
      state:{recent:[{at:new Date().toISOString()}]}}]}]};
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
   }
   return route.abort();
  });
  await page.goto(url+'/projection.html?space=observation',{waitUntil:'domcontentloaded'});
  await page.locator('#controls').waitFor({state:'visible'});
  await page.locator('#load').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Chargement'));
  assert.equal(started,1);
  await page.locator('#hide').click();
  respond();
  await page.waitForFunction(()=>document.querySelector('#load')?.disabled===false);
  assert.equal(await page.locator('#board').isHidden(),true,'a late response must not redraw hidden data');
  assert.equal(await page.locator('#total').textContent(),'');
  assert.doesNotMatch(await page.locator('body').textContent(),/DONNEE-PRIVEE/);
  assert.deepEqual(errors,[]);
  await page.close();
 }finally{respond();await browser.close();await new Promise(done=>server.close(done))}
});
