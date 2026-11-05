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
const sdk=(authorized)=>'export function createClient(){return {auth:{getSession:async()=>({data:{session:'+JSON.stringify(authorized?session:null)+'}}),signOut:async()=>({error:null})}}}';
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
 let allRequests=0;
 const base='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith(base))return route.continue();
   if(url.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'text/javascript',body:sdk(authorized)});
   if(url.includes('/functions/v1/connect-lab-catalog')){
     allRequests++;
     const body=JSON.parse(route.request().postData()||'{}');
     assert.equal(body.action,'all');
     return route.fulfill({status:authorized?200:403,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(authorized?{ok:true,apps}:{ok:false,error:'professor_required'})});
   }
   if(url.includes('/functions/v1/connect-api'))return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,status:'approved',classId:testClass,displayName:'Monsieur T',progress:{apps:[]}})});
   return route.abort();
 });
 return {browser,page,server,base,getRequests:()=>allRequests};
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
