import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const A='1b021ed9-4846-4203-9c7b-4b5fa8d7adab',B='0d8ba828-59cc-468b-a4b8-7b2a1af10b88';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json'};
const stub=String.raw`
let session={user:{id:'teacher-test',is_anonymous:false},access_token:'FAKE_JWT_NEVER_ACCEPTED_BY_PRODUCTION'};
const listeners=[];
window.__signOut=()=>{session=null;listeners.forEach(x=>x('SIGNED_OUT',null))};
export function createClient(){return {auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:callback=>{listeners.push(callback);return {data:{subscription:{unsubscribe(){}}}}}}}}
`;
async function serve(){
 const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const target=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(root+sep)){res.writeHead(403).end();return}
  try{const file=await readFile(target);res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream','cache-control':'no-store'}).end(file)}
  catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
function fakeStudent(i){
 return {id:'fake-student-'+i,name:'Élève '+(i+1),level:4,trophies:i%4,
  scores:[{appKey:'addition-ecrite-simple',bestScore:220-i*10},
  {appKey:'multiplication-ecrite-simple',bestScore:90-i*3}]};
}
test('V2 — 14 seuls puis 20 élèves interclasses, rotation 30s, Score/% isolés et reset (Chromium)',{timeout:125000},async()=>{
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const errors=[],unknown=[];let storedOptions=null,resetCalls=0,loads=0;
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const target=route.request().url();
   if(target.startsWith(url))return route.continue();
   if(target.startsWith('https://esm.sh/'))return route.fulfill({
    status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:stub
   });
   if(target.includes('.supabase.co/functions/v1/')){
    const input=JSON.parse(route.request().postData()||'{}');
    if(input.action==='teacher-dashboard')return route.fulfill({
     status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
     body:JSON.stringify({ok:true,classes:[{id:A,name:'Phase 2 A'},{id:B,name:'Phase 2 B'}]})
    });
    if(input.action==='teacher-load'){
     loads++;
     const classes=[{classId:A,name:'Phase 2 A',enrolled:14,options:storedOptions,students:Array.from({length:14},(_,i)=>fakeStudent(i)),
       scorePeriods:[],totals:[{appKey:'addition-ecrite-simple',bestSum:1800}],percentages:null}];
     if(input.comparisons?.includes(B))classes.push({classId:B,name:'Phase 2 B',enrolled:11,students:Array.from({length:11},(_,i)=>fakeStudent(i+14)),
       options:null,scorePeriods:[],totals:[{appKey:'addition-ecrite-simple',bestSum:1234}],percentages:null});
     return route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,classes})});
    }
    if(input.action==='teacher-save-options'){
     storedOptions=input.options;
     assert.equal(input.classId,A,'les réglages restent attachés à la classe principale');
     return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,options:storedOptions})});
    }
    if(input.action==='teacher-reset-score'){
     assert.equal(input.classId,A);assert.equal(input.appKey,'addition-ecrite-simple');
     assert.equal(input.password,'MOT-DE-PASSE-FICTIF');
     resetCalls++;
     return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,classId:A,appKey:input.appKey,scoreSince:'2026-10-31T20:00:00Z'})});
    }
    throw Error('Unexpected endpoint action '+input.action);
   }
   unknown.push(target);return route.abort();
  });
  page.on('dialog',d=>d.accept());
  await page.goto(url+'/projection-v2.html?space=phase2',{waitUntil:'domcontentloaded'});
  await page.locator('#load-real').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#load-real').disabled);
  assert.equal(await page.locator('#ranking-list .entry').count(),0,'aucun élève lu sans clic');
  await page.locator('#load-real').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ranking-list .entry').length===14);
  assert.equal(await page.locator('.ranking-col').count(),2);
  assert.equal(await page.locator('.ranking-col').nth(0).locator('.entry').count(),7);
  assert.equal(await page.locator('.ranking-col').nth(1).locator('.entry').count(),7);
  assert.equal(await page.locator('.entry.rank-8').count(),1);
  assert.equal(await page.locator('.entry.rank-1').count(),1);
  assert.ok(await page.locator('.entry.rank-1 .place').textContent());
  assert.equal(await page.locator('.entry.rank-8 .place').textContent(),'8');
  assert.notEqual(await page.locator('.entry.rank-1 .place').evaluate(el=>getComputedStyle(el).backgroundColor),
    await page.locator('.entry.rank-8 .place').evaluate(el=>getComputedStyle(el).backgroundColor));
  assert.match(await page.locator('.ranking-col').nth(1).evaluate(el=>getComputedStyle(el).borderLeftWidth),/5px/);
  assert.equal(await page.locator('#classes .classstat').count(),6,'Global + cinq applications');
  assert.match(await page.locator('#classes .global-success').textContent(),/Global.*— %/);
  assert.match(await page.locator('#time-left').textContent(),/30 s/);
  assert.equal(await page.locator('#comparison-results .compare-row').count(),0);
  assert.equal(await page.locator('#settings-left').count(),1);
  assert.equal(await page.locator('#open-settings').count(),0);
  await page.locator('#settings-left').click();
  await page.locator('#settings').waitFor({state:'visible'});
  assert.equal(await page.locator('#show-teacher').isChecked(),false,'Monsieur T décoché');
  await page.getByRole('checkbox',{name:'Phase 2 B · Comparer le score'}).check();
  await page.waitForFunction(()=>document.querySelectorAll('#ranking-list .entry').length===20);
  assert.equal(await page.locator('.ranking-col').nth(0).locator('.entry').count(),10);
  assert.equal(await page.locator('.ranking-col').nth(1).locator('.entry').count(),10);
  assert.ok((await page.locator('.class-mark').allTextContents()).includes('Phase 2 B'));
  assert.equal(await page.locator('#comparison-results .compare-row').count(),0,
    'Score des autres classes au centre, jamais à gauche');
  assert.doesNotMatch(await page.locator('#comparison-results').textContent(),/Réussite globale/,'score seul sans pourcentage');
  assert.deepEqual(storedOptions.comparisonDisplay,[{classId:B,score:true,percentage:false}]);
  await page.getByRole('checkbox',{name:'Phase 2 B · Comparer le pourcentage'}).check();
  await page.waitForFunction(()=>document.querySelector('#comparison-results')?.textContent?.includes('Réussite globale'));
  assert.deepEqual(storedOptions.comparisonDisplay,[{classId:B,score:true,percentage:true}]);
  assert.match(await page.locator('#comparison-results').textContent(),/— %/,'aucun % fictif');
  await page.getByRole('button',{name:'Réinitialiser uniquement le score de Addition écrite pour Phase 2 A'}).click();
  await page.locator('#reset-password').fill('MOT-DE-PASSE-FICTIF');
  await page.locator('#reset-apply').click();
  await page.waitForFunction(()=>!document.querySelector('#settings').open);
  assert.equal(resetCalls,1);
  await page.evaluate(()=>window.__signOut());
  assert.equal(await page.locator('#ranking-list .entry').count(),0,'déconnexion masque les résultats');
  assert.deepEqual(errors,[]);
  assert.deepEqual(unknown,[]);
  assert.ok(loads>=3);
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
