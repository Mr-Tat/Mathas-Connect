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
const rewards={version:3,
 mastery:{'4':[false,false,false],'10':[false,false,false],'20':[false,false,false]},
 sudden:[false,false,false],
 hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
async function webServer(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
   const b=await readFile(file),t=({'.html':'text/html; charset=utf-8','.js':'text/javascript',
    '.mjs':'text/javascript','.png':'image/png','.webp':'image/webp',
    '.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':t}).end(b)
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('Chromium Mélange : 3 opérations choisies, journal natif, XP officiel et consentement tableau',async()=>{
 const {server,url}=await webServer();
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1360,height:900}});
  const requests=[],errors=[];let xp=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
   status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
   body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"token",user:{id:"'+auth+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+auth+'",is_anonymous:true}},error:null})}}}'
  }));
  await page.route('**/*.supabase.co/**',async r=>{
   const body=r.request().postDataJSON()||{};requests.push(body);
   let response;
   if(r.request().url().includes('/connect-api')){
    response={ok:true,status:'approved',classId};
   }else if(r.request().url().includes('/connect-results')){
    if(body.action==='student-load'){
     response={ok:true,revision:xp?1:0,resetEpoch:0,state:{rewards},storageSubject:pupil};
    }else if(body.action==='student-xp'){
     response={ok:true,appXp:xp,total:xp,level:1};
    }else if(body.action==='game-record'){
     assert.equal(body.appKey,'melange-calculs-ecrits');
     assert.deepEqual(body.operationsSelectedAtStart,['add','sub','mul']);
     assert.deepEqual(body.operationsCompleted,['add','sub','mul','sub']);
     assert.deepEqual(body.firstTry,[true,true,false,true]);
     assert.equal(body.score,3);
     assert.equal(body.total,4);
     assert.equal(body.expectedStudentId,pupil);
     xp=18;
     response={ok:true,revision:1,resetEpoch:0,xp:{appXp:xp,total:xp,level:1,delta:18}};
    }else throw Error('unexpected connect-results action '+body.action);
   }else if(r.request().url().includes('/connect-projection-v2')){
    response={ok:true,consentRecorded:true};
   }else throw Error('unexpected backend '+r.request().url());
   await r.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
  });
  await page.goto(url+'/apps/objective-record/eleve.html?class='+classId+'&app=melange',
   {waitUntil:'domcontentloaded',timeout:26000});
  await page.waitForFunction(()=>{
   const o=document.getElementById('gameFrame')?.contentDocument;
   return !!o?.getElementById('game')?.contentWindow?.MathasLabV2Update;
  },null,{timeout:40000});
  await page.evaluate(()=>{
   const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
   const journal={mode:'classic',level:1,total:4,score:3,
    operationsSelectedAtStart:['add','sub','mul'],
    operationsCompleted:['add','sub','mul','sub'],
    firstTry:[true,true,false,true],aidUsed:false,masterMode:false};
   w.MathasLabV2Update({phase:'answering',mode:'classic',level:1,score:0,total:4,completed:0,hard:false});
   w.__mathasMixedTestFinished=journal;
   w.MathasLabV2Update({phase:'finished',mode:'classic',level:1,score:3,total:4,completed:4,hard:false});
  });
  await page.waitForFunction(()=>document.getElementById('status')?.textContent
   .includes('Partie enregistrée'),null,{timeout:26000});
  const credited=requests.filter(x=>x.action==='game-record');
  assert.equal(credited.length,1);
  assert.equal(xp,18);
  assert.equal(requests.filter(x=>x.action==='student-share-score').length,0);
  await page.locator('.mathas-projection-offer button.yes').waitFor({state:'visible'});
  const saved=page.waitForRequest(r=>r.url().includes('connect-projection-v2')&&r.postDataJSON()?.action==='student-share-score');
  await page.locator('.mathas-projection-offer button.yes').click();
  const posted=(await saved).postDataJSON();
  assert.equal(posted.eventId,credited[0].eventId);
  assert.equal(posted.appKey,'melange-calculs-ecrits');
  assert.equal(posted.classId,classId);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
