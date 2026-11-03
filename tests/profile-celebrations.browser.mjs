// Auth et niveau fictifs, mais véritable HUB HTML/CSS/JS lancé dans Chromium.
// Test isolé : aucune écriture vers Supabase hébergé.
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
test('Célébrations : retour HUB, ACK inter-appareils, 5 paliers en ordre, report sans ACK',async()=>{
 const {server,url}=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:850}});
  let level=1,online=true;const seen=new Set(),acks=[],errors=[];
  async function page(){
   const p=await context.newPage();
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/supabase-js@2.95.0*',r=>r.fulfill({
    status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"111",is_anonymous:true}}}})}}}'
   }));
   await p.route('**/*.supabase.co/**',async r=>{
    const request=r.request();
    if(request.url().includes('/connect-lab-catalog')){
     await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,apps:[]})});
     return
    }
    if(!request.url().includes('/connect-api'))throw Error('Unexpected request '+request.url());
    const b=request.postDataJSON();let payload,status=200;
    if(b.action==='student-me'){
     payload={ok:true,status:'approved',classId:CLASS,displayName:'Eleve.D',publicAlias:'Eleve.D',
      unlockLevel:level,avatar:{kind:'letter',value:'E',color:'transparent'},
      xp:{active:true,total:level*50,level,next:level*50+50,apps:[]},
      progress:{apps:[],totalTrophies:0},
      pendingProfileRewards:[3,6,10,15,20].filter(n=>n<=level&&!seen.has(n))};
    }else if(b.action==='student-reward-celebrate'){
     acks.push({...b});if(!online){status=503;payload={ok:false,error:'celebration_unavailable'}}
     else if(b.level>level){status=403;payload={ok:false,error:'reward_locked'}}
     else {seen.add(b.level);payload={ok:true,celebratedLevel:b.level}}
    }else throw Error('Unexpected action '+b.action);
    await r.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
   });
   return p;
  }
  const urlHub=url+'/hub.html?class='+CLASS;
  let p=await page();
  await p.goto(urlHub,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.getElementById('identity-level-number')?.textContent==='1');
  assert.equal(await p.locator('#reward-celebration').isHidden(),true);
  await p.close();

  // Pas de célébration pendant le jeu ; dès retour sur le HUB à N3.
  level=3;p=await page();await p.goto(urlHub,{waitUntil:'domcontentloaded'});
  await p.locator('#reward-celebration:not([hidden])').waitFor({state:'visible'});
  assert.match(await p.locator('#reward-level').textContent(),/Niveau 3 atteint/);
  assert.match(await p.locator('#reward-detail-text').textContent(),/avatar animal/);
  const dims=await p.locator('#reward-celebration').evaluate(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height}});
  assert.equal(dims.width,1280);
  assert.equal(dims.height,850);
  assert.equal(await p.locator('#reward-milestones .reward-milestone').count(),5);
  assert.equal(acks.length,0,'never ACK on page load');
  await p.locator('#reward-later').click();
  assert.equal(await p.locator('#reward-celebration').isHidden(),true);
  assert.equal(acks.length,0,'later must not ACK');
  await p.close();

  // Sur un nouvel appareil l'animation revient tant qu'elle n'est pas vue.
  p=await page();await p.goto(urlHub,{waitUntil:'domcontentloaded'});
  await p.locator('#reward-celebration:not([hidden])').waitFor({state:'visible'});
  online=false;await p.locator('#reward-continue').click();
  await p.locator('#reward-feedback').getByText(/Connexion momentanément indisponible/).waitFor();
  assert.equal(await p.locator('#reward-celebration').isHidden(),false);
  assert.equal(seen.size,0,'a network error must not dismiss or acknowledge');
  online=true;await p.locator('#reward-continue').click();
  await p.locator('#reward-celebration').waitFor({state:'hidden'});
  assert.deepEqual([...seen],[3]);
  await p.close();

  // N6 : affiche uniquement le palier non encore célébré.
  level=6;p=await page();await p.goto(urlHub,{waitUntil:'domcontentloaded'});
  await p.locator('#reward-celebration:not([hidden])').waitFor({state:'visible'});
  assert.match(await p.locator('#reward-level').textContent(),/Niveau 6 atteint/);
  await p.locator('#reward-continue').click();
  await p.locator('#reward-celebration').waitFor({state:'hidden'});
  assert.deepEqual([...seen],[3,6]);
  await p.close();

  // Une grosse progression donne trois cartes successives et une seule ACK chacune.
  level=20;p=await page();await p.goto(urlHub,{waitUntil:'domcontentloaded'});
  for(const expected of [10,15,20]){
   await p.locator('#reward-celebration:not([hidden])').waitFor({state:'visible'});
   assert.match(await p.locator('#reward-level').textContent(),new RegExp('Niveau '+expected+' atteint'));
   await p.locator('#reward-continue').click();
   await p.waitForFunction(e=>document.getElementById('reward-level')?.textContent!==('Niveau '+e+' atteint !'),expected);
  }
  await p.locator('#reward-celebration').waitFor({state:'hidden'});
  assert.deepEqual([...seen],[3,6,10,15,20]);
  await p.close();

  // Actualisation / second appareil : pas de répétition.
  p=await page();await p.goto(urlHub,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>document.getElementById('identity-level-number')?.textContent==='20');
  assert.equal(await p.locator('#reward-celebration').isHidden(),true);
  await p.close();
  assert.deepEqual(acks.filter(x=>online&&x.level!==3).map(x=>x.level),[6,10,15,20]);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
