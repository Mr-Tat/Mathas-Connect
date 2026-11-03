import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const code=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const PUPIL='11111111-1111-4111-8111-111111111111';
const AUTH='22222222-2222-4222-8222-222222222222';
const REWARDS={version:3,mastery:{'4':[false,false,false],'10':[false,false,false],
 '20':[false,false,false]},sudden:[false,false,false],hardAwards:{bronze:[false,false,false],
 silver:[false,false,false],gold:[false,false,false]},scoreOne:{bronze:false,
 silver:false,gold:false},unlockedGold:false};
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{
   const bytes=await readFile(file);
   const type=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript',
     '.js':'text/javascript','.png':'image/png','.webp':'image/webp',
     '.css':'text/css'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('Server: both TEST endpoints close client-declared score bypass for additions',()=>{
 const host=code('apps/objective-record/eleve.mjs');
 const testEdge=code('supabase/functions/connect-objective-record-test/index.ts');
 const resultsEdge=code('supabase/functions/connect-results/index.ts');
 assert.match(host,/SERVER_PROOF_ADDITIONS=new Set\(\['addition-ecrite-simple','addition-ecrite-multiple'\]\)/);
 assert.match(host,/nativeRecordAllowed\(activeApp\)/);
 assert.match(host,/isWritableTestApp\(appKey\)&&!SERVER_PROOF_ADDITIONS.has\(appKey\)/);
 assert.match(testEdge,/const APPS=new Set\(\['soustraction-ecrite-simple','multiplication-ecrite-simple'\]\)/);
 assert.match(resultsEdge,/proofOnlyAddClasses=new Set\(/);
 for(const id of ['4bf3400d-a315-4ea4-a2f3-afaca24dc9b9',
  '8fe170fa-9e8f-4e80-885a-b0ba68026f64',
  '71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e',
  '1b021ed9-4846-4203-9c7b-4b5fa8d7adab',
  '0d8ba828-59cc-468b-a4b8-7b2a1af10b88',
  'a9195199-0a28-4e86-99ce-47b36dd6e646'])assert.ok(resultsEdge.includes(id),id);
 assert.match(resultsEdge,/b\.action==='game-record'&&proofOnlyAddClasses\.has\(b\.classId\)/);
 assert.match(resultsEdge,/b\.appKey===app\|\|b\.appKey===addMulti/);
 assert.match(resultsEdge,/return deny\('server_proof_required',403\)/);
  assert.ok(host.includes("SERVER_PROOF_ADDITIONS.has(activeApp)?'?connect=1"));
});
for(const item of [
 {slug:'addition-simple',appKey:'addition-ecrite-simple',startAction:'start-proof-v2',
  questions:Array.from({length:4},(_,i)=>({id:'q'+(i+1),op:'add',a:123+i,b:456+i}))},
 {slug:'addition-multiple',appKey:'addition-ecrite-multiple',startAction:'start-proof-multi-v1',
  questions:Array.from({length:4},(_,i)=>({id:'q'+(i+1),op:'add',addends:[12345+i,67890+i,11111+i]}))}
]){
 test('Chromium '+item.slug+': no XP from unproven games; certified start locks duplicate launch',async()=>{
  const {server,url}=await serve();let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1280,height:850}});
   const requests=[],errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
    status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"test",user:{id:"'+AUTH+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:true}},error:null})}}}'
   }));
   await page.route('**/*.supabase.co/**',async r=>{
    const b=r.request().postDataJSON()??{};requests.push(b);
    let data;
    if(r.request().url().includes('/connect-api'))data={ok:true,status:'approved',classId:CLASS};
    else if(r.request().url().includes('/connect-results')){
     if(b.action==='game-record')throw Error('UNVERIFIED_CREDIT '+JSON.stringify(b));
     data=b.action==='student-load'?
      {ok:true,revision:0,resetEpoch:0,state:{rewards:REWARDS},storageSubject:PUPIL}:
      {ok:true,appXp:0,total:0,level:1};
    }else if(r.request().url().includes('/connect-objective-record-test')){
     if(b.action!==item.startAction)throw Error('UNEXPECTED_PROOF_WRITE '+b.action);
     data={ok:true,sessionId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      questions:item.questions,revision:0,resetEpoch:0,level:1,total:4,
      expiresAt:'2090-12-31T23:59:59Z'};
    }else throw Error('unexpected '+r.request().url());
    await r.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
   });
   await page.goto(url+'/apps/objective-record/eleve.html?class='+CLASS+'&app='+item.slug,
    {waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,null,{timeout:35000});
   const displayed=await page.evaluate(()=>{
    const outer=document.getElementById('gameFrame').contentDocument;
    const inner=outer?.getElementById('game')?.contentWindow;
    return {display:getComputedStyle(outer.querySelector('header')).display,
     hasGame:!!inner?.document?.getElementById('menuScreen'),
     href:document.getElementById('gameFrame').getAttribute('src')};
   });
   assert.equal(displayed.display,'none');
   assert.equal(displayed.hasGame,true);
   assert.equal(new URL(displayed.href,url).searchParams.get('connect'),'1');
   // Even a fabricated terminal native event is not allowed to award XP.
   await page.evaluate(()=>{
    const inner=document.getElementById('gameFrame').contentDocument
      .getElementById('game').contentWindow;
    inner.MathasLabV2Update({phase:'ended',mode:'classic',score:4,level:1,total:4,completed:4});
    inner.MathasLabV2Update({phase:'ended',mode:'sudden',score:100,level:1,total:null});
    inner.MathasLabV2Update({phase:'ended',mode:'three-lives',score:100,level:1,total:null});
   });
   await page.waitForTimeout(900);
   assert.equal(requests.filter(b=>b.action==='game-record').length,0);
   await page.locator('#challenge-toggle').click();
   await page.locator('#certify').click();
   await page.waitForFunction(()=>{
    const inner=document.getElementById('gameFrame')?.contentDocument
      ?.getElementById('game')?.contentWindow;
    return inner?.document?.getElementById('gameScreen')?.classList.contains('hidden')===false;
   },null,{timeout:20000});
   await page.waitForTimeout(1000);
   assert.equal(await page.locator('#certify').isDisabled(),true);
   assert.equal(requests.filter(b=>b.action===item.startAction).length,1);
   assert.equal(requests.filter(b=>b.action==='game-record').length,0);
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
 });
}
