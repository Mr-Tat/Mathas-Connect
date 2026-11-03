// Recette DOM sur le vrai HUB avec une identité et des XP simulés.
// Aucune connexion à un compte réel ni écriture Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
   const data=await readFile(file);
   res.writeHead(200,{'content-type':({
    '.html':'text/html; charset=utf-8','.mjs':'text/javascript',
    '.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml',
    '.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream'}).end(data);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('HUB : les cinq jalons contrôlent la personnalisation, sans colorer les initiales',async()=>{
 const {server,url}=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1300,height:820}});
  let level=1,alias='Élodie.M';const writes=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
   status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
   body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"111",is_anonymous:true}}}})}}}'
  }));
  await page.route('**/*.supabase.co/**',async r=>{
   const u=r.request().url();
   if(u.includes('/connect-lab-catalog')){
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,apps:[]})});
    return
   }
   if(!u.includes('/connect-api'))throw Error('Unexpected request '+u);
   const b=r.request().postDataJSON();let result;
   if(b.action==='student-me'){
    result={ok:true,status:'approved',classId:CLASS,displayName:'Élodie.M',publicAlias:alias,
     unlockLevel:level,avatar:{kind:'letter',value:'É',color:'transparent'},
     xp:{active:true,level,total:level*50,next:level*50+50,apps:[]},
     progress:{apps:[],totalTrophies:0}};
   }else if(b.action==='student-avatar'){
    writes.push(b);
    result={ok:true,avatar:{kind:b.kind,value:b.value,color:b.color}};
   }else if(b.action==='student-profile-alias'){
    writes.push(b);
    alias=b.alias||'Élodie.M';
    result={ok:true,publicAlias:alias};
   }else throw Error('Unexpected action '+b.action);
   await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  for(const stage of [1,2,3,5,6,9,10,14,15,19,20]){
   level=stage;alias='Élodie.M';
   await page.goto(url+'/hub.html?class='+CLASS,{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(n=>document.getElementById('identity-level-number')?.textContent===String(n),stage,{timeout:15000});
   assert.equal(await page.locator('#identity-avatar').textContent(),'É');
   assert.equal(await page.locator('#identity-avatar').evaluate(el=>getComputedStyle(el).backgroundColor),
    'rgba(0, 0, 0, 0)','initiale sans couleur de fond au niveau '+stage);
   await page.locator('#identity-action').click();
   await page.locator('#edit-avatar').click();
   await page.locator('#avatar-dialog:not([hidden])').waitFor({state:'visible'});
   const tabs=page.locator('#hub-avatar-tabs button');
   assert.equal(await tabs.count(),4);
   assert.equal(await tabs.nth(1).isDisabled(),stage<3,'animal niv.3');
   assert.equal(await tabs.nth(2).isDisabled(),stage<15,'objet niv.15');
   assert.equal(await tabs.nth(3).isDisabled(),stage<20,'smiley niv.20');
   assert.equal(await page.locator('#avatar-colors button[title="Couleur ocean"]').isDisabled(),stage<6,'fond niv.6');
   assert.equal(await page.locator('#profile-alias-panel').isHidden(),stage<10,'pseudo niv.10');
   if(stage===3){
    await tabs.nth(1).click();
    await page.locator('#avatar-choices button').first().click();
    await page.locator('#avatar-save').click();
    await page.waitForFunction(()=>document.getElementById('identity-avatar')?.textContent==='🦊',null,{timeout:8000});
    assert.equal(await page.locator('#identity-avatar').textContent(),'🦊');
    assert.equal(writes.at(-1).color,'transparent');
    assert.equal(writes.at(-1).kind,'animal');
   }
   if(stage===20){
    for(const tabIndex of [1,2,3]){
     await tabs.nth(tabIndex).click();
     assert.equal(await page.locator('#avatar-choices button').count(),24);
     assert.equal(await page.locator('#avatar-choices').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),12);
     const rows=await page.locator('#avatar-choices button').evaluateAll(buttons=>buttons.map(el=>Math.round(el.getBoundingClientRect().top)));
     assert.equal(new Set(rows).size,2,'exactly two desktop rows of 12');
    }
    assert.equal(await page.locator('#avatar-colors button').count(),20);
    assert.equal(await page.locator('#avatar-colors').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),10);
    const rows=await page.locator('#avatar-colors button').evaluateAll(buttons=>buttons.map(el=>Math.round(el.getBoundingClientRect().top)));
    assert.equal(new Set(rows).size,2,'exactly two desktop rows of 10 colors');
   }
   if(stage===10){
    await page.locator('#profile-alias-input').fill('Capitaine');
    await page.locator('#profile-alias-save').click();
    await page.waitForFunction(()=>document.getElementById('identity-title')?.textContent==='Capitaine',null,{timeout:8000});
    assert.equal(await page.locator('#identity-title').textContent(),'Capitaine');
    assert.equal(writes.at(-1).action,'student-profile-alias');
    assert.equal(writes.at(-1).alias,'Capitaine');
   }
  }
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(ok=>server.close(ok))}
});
