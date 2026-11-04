import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const classId='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const pupil='11111111-1111-4111-8111-111111111111';
const auth='22222222-2222-4222-8222-222222222222';
const sessionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const questions=Array.from({length:4},(_,i)=>({id:'q'+(i+1),op:'add',
 addends:[12345+i,67890+i,11111+i]}));
const rewards={version:3,
 mastery:{'4':[false,false,false],'10':[false,false,false],'20':[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],
 silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{const b=await readFile(file);
   const type=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript',
    '.js':'text/javascript','.css':'text/css','.webp':'image/webp',
    '.png':'image/png'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(b);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('Chromium: native multiple engine renders server terms and submits only proof ACK',async()=>{
 const {server,url}=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1360,height:900}});
  const requests=[],errors=[];let xp=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
   status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
   body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"test",user:{id:"'+auth+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+auth+'",is_anonymous:true}},error:null})}}}'
  }));
  await page.route('**/*.supabase.co/**',async r=>{
   const b=r.request().postDataJSON()??{};requests.push(b);
   let data;
   if(r.request().url().includes('/connect-api'))data={ok:true,status:'approved',classId};
   else if(r.request().url().includes('/connect-results')){
    data=b.action==='student-load'
     ?{ok:true,revision:xp?1:0,resetEpoch:0,state:{rewards},storageSubject:pupil}
     :{ok:true,appXp:xp,total:xp,level:1};
   }else if(r.request().url().includes('/connect-projection-v2'))data={ok:true,consentRecorded:true};
   else if(r.request().url().includes('/connect-objective-record-test')){
    if(b.action==='start-proof-multi-v1'){
     assert.equal(b.level,1);assert.equal(b.total,4);
     data={ok:true,sessionId,questions,revision:0,resetEpoch:0,level:1,total:4,
      expiresAt:'2090-12-31T23:59:59Z'};
    }else if(b.action==='finish-proof-multi-v1'){
     assert.equal(b.sessionId,sessionId);
     assert.deepEqual(b.answers.map(x=>x.id),['q1','q2','q3','q4']);
     assert.equal(b.answers.length,4);
     assert.ok(b.answers.every(x=>x.digits.length>=5&&x.carries.length===5));
     xp=22;
     data={ok:true,revision:1,resetEpoch:0,proofVerified:true,
      verifiedScore:4,xp:{appXp:22,total:22,level:1,delta:22}};
    }else throw Error('unexpected action '+b.action);
   }else throw Error('unexpected request '+r.request().url());
   await r.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
  });
  await page.goto(url+'/apps/objective-record/eleve.html?class='+classId+'&app=addition-multiple',
   {waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>!document.getElementById('certify').disabled,null,{timeout:45000});
  // Les exercices se choisissent dans le menu natif, pas dans la barre Connect.
  const native=page.frameLocator('#gameFrame').frameLocator('#game');
  await native.locator('.classic-count-btn[data-count="4"]').click();
  try{
   await page.waitForFunction(()=>{
    const w=document.getElementById('gameFrame')?.contentDocument
      ?.getElementById('game')?.contentWindow;
    return w?.__mathasServerCertifiedMulti?.questions?.length===4
     &&w.document.getElementById('gameScreen')?.classList.contains('hidden')===false;
   },null,{timeout:35000});
  }catch(e){
   const debug=await page.evaluate(()=>{
    const outer=document.getElementById('gameFrame')?.contentDocument;
    const inner=outer?.getElementById('game')?.contentDocument;
    return {state:outer?.getElementById('state')?.textContent,
     menu:inner?.getElementById('menuScreen')?.className,
     game:inner?.getElementById('gameScreen')?.className,
     status:document.getElementById('status')?.textContent};
   });throw Error('multi-native-timeout '+JSON.stringify({debug,errors,actions:requests.map(x=>x.action)})+' '+e);
  }
  const rendered=await page.evaluate(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   return {questions:w.__mathasServerCertifiedMulti.questions,
    text:[...w.document.querySelectorAll('#calculationsPair .digit')].map(el=>el.textContent||'').join('')};
  });
  assert.deepEqual(rendered.questions,questions);
  assert.ok(rendered.text.includes('12345'));
  assert.ok(rendered.text.includes('67890'));
  // This synthetic completion validates the real browser-to-Edge contract; the
  // native pre-correction interception is separately tested by patch contract.
  await page.evaluate(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   for(const q of w.__mathasServerCertifiedMulti.questions){
    const sum=q.addends.reduce((s,n)=>s+n,0);
    const carries=[''];
    for(let j=1;j<5;j++){
     const unit=10**j,carry=Math.floor(q.addends.reduce((s,n)=>s+n%unit,0)/unit);
     carries.push(carry?String(carry):'');
    }
    w.MathasCertifiedMultipleAttempt({id:q.id,
     digits:String(sum).split('').reverse(),carries});
   }
   w.MathasLabV2Update({phase:'ended',mode:'classic',level:1,total:4,completed:4});
  });
  await page.waitForFunction(()=>document.getElementById('status')?.textContent
   .includes('Addition multiple vérifiée'),null,{timeout:25000});
  assert.equal(xp,22);
  assert.equal(requests.filter(x=>x.action==='finish-proof-multi-v1').length,1);
  assert.equal(requests.filter(x=>x.action==='game-record').length,0);
  assert.equal(requests.filter(x=>x.action==='student-share-score').length,0);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
