import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const testClass='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const contentTypes={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const apps=[
 ['addition-ecrite-simple','Addition écrite','calculs_ecrits','published'],
 ['multiplication-ecrite-simple','Multiplication écrite','calculs_ecrits','published'],
 ['soustraction-ecrite-simple','Soustraction écrite','calculs_ecrits','test'],
 ['addition-ecrite-multiple','Addition de plusieurs nombres','calculs_ecrits','published'],
 ['melange-calculs-ecrits','Calculs écrits mélangés','calculs_ecrits','test'],
 ['abaque-longueurs','Abaque des longueurs','outil','test']
].map(([app_key,title,hub_section,stage],i)=>({app_key,title,hub_section,stage,all_order:10+i*10,display_order:10+i*10,enabled:true,visible:true,in_test:true,featured:false,launch_url:'https://mr-tat.github.io/Mathas-Connect/apps/'+app_key+'/',image_url:null}));
const session={user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:false},access_token:'FAKE_TEST_ONLY_TEACHER_JWT'};
const sdk=(authorized)=>'export function createClient(url,key,options){return {auth:{getSession:async()=>({data:{session:options?.auth?.storageKey?'+JSON.stringify(authorized?session:null)+':null}}),signOut:async()=>({error:null})}}}';
async function fixture(authorized){
 const server=createServer(async(req,res)=>{
   const uri=new URL(req.url,'http://localhost');
   const path=resolve(root,'.'+(uri.pathname.endsWith('/')?uri.pathname+'index.html':uri.pathname));
   if(path!==root&&!path.startsWith(root+'/')){res.writeHead(403).end();return}
   try{const data=await readFile(path);res.writeHead(200,{'content-type':contentTypes[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(data)}
   catch{res.writeHead(404).end()}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',error=>console.error('HUB_TOUTES_PAGEERROR',error.message));
 let allRequests=0;
 const approvals=[];const apiActions=[];let pending=true;
 const base='https://mr-tat.github.io/Mathas-Connect';
 await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith(base+'/')){
     const pathname=new URL(url).pathname.replace(/^\/Mathas-Connect/,'');
     const path=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
     if(path!==root&&!path.startsWith(root+'/'))return route.fulfill({status:403,body:'forbidden'});
     try{const data=await readFile(path);return route.fulfill({status:200,contentType:contentTypes[extname(path)]||'application/octet-stream',body:data})}
     catch{return route.fulfill({status:404,body:'not found'})}
   }
   if(url.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'text/javascript',body:sdk(authorized)});
   if(url.includes('/functions/v1/connect-lab-catalog')){
     allRequests++;
     const body=JSON.parse(route.request().postData()||'{}');
     assert.equal(body.action,'all');
     return route.fulfill({status:authorized?200:403,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(authorized?{ok:true,apps}:{ok:false,error:'professor_required'})});
   }
   if(url.includes('/functions/v1/connect-api')){
     const body=JSON.parse(route.request().postData()||'{}');
     apiActions.push(body.action);
     if(body.action==='teacher-review-join'){approvals.push(body);pending=false}
     const data=body.action==='teacher-dashboard'?{
       ok:true,classes:[{id:testClass}],students:[{id:'22222222-2222-4222-8222-222222222222',display_name:'Élève.A'}],
       requests:pending?[{id:'33333333-3333-4333-8333-333333333333',first_name:'Élève',last_initial:'A',verify_code:'7412'}]:[]
     }:{ok:true,status:'approved',classId:testClass,displayName:'Monsieur T',progress:{apps:[]}};
     return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
   }
   return route.abort();
 });
 return {browser,page,server,base,getRequests:()=>allRequests,getApprovals:()=>approvals,getApiActions:()=>apiActions};
}
async function close(f){await f.browser.close();await new Promise(done=>f.server.close(done))}
test('HUB Toutes: six vrais app_key dans Tests, sans carte en double ni modification des HUB scolaires', {timeout:60000},async()=>{
 const f=await fixture(true);
 try{
   await f.page.goto(f.base+'/hub.html?toutes=1&joueur=prof&class='+testClass+'&name=Toutes',{waitUntil:'domcontentloaded'});
   await f.page.locator('.level-title').first().waitFor({timeout:20000});
   await f.page.waitForFunction(()=>document.querySelectorAll('#levels .app-card').length===6);
   const sections=await f.page.locator('#levels .level-title').allTextContents();
   assert.match(sections[0],/Tests/);
   assert.equal(await f.page.locator('#levels .app-card').count(),6);
   assert.equal(await f.page.locator('#levels .level').first().getAttribute('aria-expanded'),null);
   assert.equal(await f.page.locator('#levels .level').first().locator('button.level-toggle').getAttribute('aria-expanded'),'true');
   assert.equal(await f.page.locator('.daily-section').isVisible(),false);
   const hrefs=await f.page.locator('#levels .app-card').evaluateAll(elements=>elements.map(a=>a.href));
   assert.equal(new Set(hrefs).size,6);
   for(const link of hrefs){assert.ok(link.includes('class='+testClass));assert.ok(!link.includes('joueur=prof'))}
   assert.equal(f.getRequests(),1);
 }finally{await close(f)}
});
test('Sans authentification professeur, aucun catalogue Tests ne se charge', {timeout:60000},async()=>{
 const f=await fixture(false);
 try{
   await f.page.goto(f.base+'/hub.html?toutes=1&joueur=prof&class='+testClass,{waitUntil:'domcontentloaded'});
   await f.page.waitForFunction(()=>document.querySelector('#dailyApps')?.textContent?.includes('Catalogue professeur indisponible'));
   assert.equal(await f.page.locator('#levels .app-card').count(),0);
   assert.equal(f.getRequests(),0);
 }finally{await close(f)}
});

test('Le HUB Toutes reste lisible sur un petit écran de téléphone', {timeout:60000},async()=>{
 const f=await fixture(true);
 try{
   await f.page.setViewportSize({width:390,height:844});
   await f.page.goto(f.base+'/hub.html?toutes=1&joueur=prof&class='+testClass+'&name=Toutes',{waitUntil:'domcontentloaded'});
   await f.page.waitForFunction(()=>document.querySelectorAll('#levels .app-card').length===6);
   assert.equal(await f.page.locator('#levels .level-title').first().textContent(),'🧪 Tests');
   const layout=await f.page.evaluate(()=>({
     viewport:innerWidth,
     documentWidth:document.documentElement.scrollWidth,
     firstCardWidth:document.querySelector('#levels .app-card')?.getBoundingClientRect().width,
     levelClass:document.querySelector('#levels .level')?.className,
     sectionDisplay:getComputedStyle(document.querySelector('#levels .level-content')).display,
     levelsDisplay:getComputedStyle(document.querySelector('#levels')).display
   }));
   assert.ok(layout.firstCardWidth>100,'carte lisible : '+JSON.stringify(layout));
   assert.ok(layout.documentWidth<=layout.viewport+4,'pas de débordement horizontal');
 }finally{await close(f)}
});

test('Le professeur choisit une fiche fictive, puis seule la connexion native Connect est proposée', {timeout:60000},async()=>{
 const f=await fixture(true);
 try{
   await f.page.goto(f.base+'/hub.html?toutes=1&joueur=prof&class='+testClass,{waitUntil:'domcontentloaded'});
   await f.page.locator('#toutes-connect-student:not([disabled])').waitFor({timeout:20000});
   assert.equal(await f.page.locator('#toutes-student-select option').first().textContent(),'Élève.A');
   assert.equal(await f.page.locator('#toutes-switch').isVisible(),false);
   assert.equal(await f.page.locator('#toutes-connect-student').textContent(),'Se connecter avec Élève.A');
   await f.page.locator('#toutes-connect-student').click();
   await f.page.waitForURL(/index\.html\?/);
   const url=new URL(f.page.url());
   assert.equal(url.searchParams.get('class'),testClass);
   assert.equal(url.searchParams.get('testFirst'),'Élève');
   assert.equal(url.searchParams.get('testInitial'),'A');
   assert.equal(url.searchParams.get('toutesReturn'),'1');
   assert.equal(url.searchParams.has('joueur'),false);
   assert.equal(f.getApprovals().length,0);
 }finally{await close(f)}
});
test('La demande native exige consentement, vérification du code et professeur authentifié', {timeout:60000},async()=>{
 const f=await fixture(true);
 try{
   f.page.on('dialog',d=>d.accept());
   await f.page.goto(f.base+'/hub.html?toutes=1&joueur=prof&class='+testClass,{waitUntil:'domcontentloaded'});
   await f.page.locator('#toutes-requests-open:not([disabled])').waitFor({timeout:20000});
   await f.page.locator('#toutes-requests-open').click();
   assert.match(await f.page.locator('#toutes-pending-requests').textContent(),/7412/);
   const approve=f.page.getByRole('button',{name:'Accepter la connexion'});
   assert.equal(await approve.isDisabled(),true);
   await f.page.locator('#toutes-fictive-confirm').check();
   assert.equal(await approve.isDisabled(),false);
   await approve.click();
   await f.page.waitForFunction(()=>document.querySelector('#toutes-pending-requests')?.textContent?.includes('Aucune demande'));
   const records=f.getApprovals();
   assert.equal(records.length,1);
   assert.deepEqual({action:records[0].action,classId:records[0].classId,approve:records[0].approve,existingStudentId:records[0].existingStudentId},
     {action:'teacher-review-join',classId:testClass,approve:true,existingStudentId:'22222222-2222-4222-8222-222222222222'});
 }finally{await close(f)}
});
test('Sans session professeur, ni profils fictifs ni contrôle des demandes ne sont accessibles', {timeout:60000},async()=>{
 const f=await fixture(false);
 try{
   await f.page.goto(f.base+'/hub.html?toutes=1&class='+testClass,{waitUntil:'domcontentloaded'});
   await f.page.waitForFunction(()=>document.querySelector('#toutes-auth-current')?.textContent==='Accès professeur nécessaire');
   assert.equal(await f.page.locator('#toutes-connect-student').isDisabled(),true);
   assert.equal(await f.page.locator('#toutes-requests-open').isVisible(),false);
   assert.equal(f.getApprovals().length,0);
 }finally{await close(f)}
});

test('Côté élève, seul le retour vers Monsieur T est proposé ; approbations cachées', {timeout:60000},async()=>{
 const f=await fixture(true);
 try{
   await f.page.goto(f.base+'/hub.html?toutes=1&class='+testClass+'&name=Toutes',{waitUntil:'domcontentloaded'});
   await f.page.locator('#toutes-switch:not([disabled])').waitFor({timeout:20000});
   assert.equal(await f.page.locator('#toutes-switch').textContent(),'Se connecter avec Monsieur T');
   assert.equal(await f.page.locator('#toutes-connect-student').isVisible(),false);
   assert.equal(await f.page.locator('#toutes-requests-open').isVisible(),false);
   assert.equal(await f.page.locator('#levels .app-card').count(),6);
   assert.equal(f.getApiActions().includes('teacher-dashboard'),false,'aucune lecture de code ou demande professeur sur la page élève');
   assert.equal(await f.page.locator('#toutes-pending-requests').textContent(),'');
   await f.page.locator('#toutes-switch').click();
   await f.page.waitForURL(/joueur=prof/);
   const u=new URL(f.page.url());
   assert.equal(u.searchParams.get('class'),testClass);
   assert.equal(u.searchParams.get('toutes'),'1');
   assert.equal(u.searchParams.get('joueur'),'prof');
 }finally{await close(f)}
});
