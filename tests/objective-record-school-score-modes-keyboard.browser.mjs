// Chromium: physically enter WRONG first digits into the native Mort subite
// interface. No fabricated native event or browser-declared score is accepted.
// These are entirely mock/fictitious school profiles, no production writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const CLASS='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
const PUPIL='11111111-1111-4111-8111-111111111111';
const AUTH='22222222-2222-4222-8222-222222222222';
const SID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REWARDS={version:3,mastery:{'4':[false,false,false],'10':[false,false,false],
 '20':[false,false,false]},sudden:[false,false,false],hardAwards:{
 bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{const bytes=await readFile(file);const type=({'.html':'text/html; charset=utf-8',
    '.mjs':'text/javascript','.js':'text/javascript','.png':'image/png',
    '.webp':'image/webp','.css':'text/css'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(bytes);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
for(const item of [
 {slug:'addition-simple',app:'addition-ecrite-simple',width:3,
  addends:['123','456'],digits:['0','7','5']},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',width:5,
  addends:['11111','22222','33333'],digits:['0','6','6','6','6']}
]){
 test('Vrai clavier de Mort subite '+item.slug+' : première erreur -> 0 point / reçu sans fraude',async()=>{
  const {server,url}=await serve();let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   const requests=[],errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.route('**/supabase-js@2.95.0*',route=>route.fulfill({
    status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+AUTH+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:true}},error:null})}}}'
   }));
   await page.route('**/*.supabase.co/**',async route=>{
    const body=route.request().postDataJSON()??{};requests.push(body);
    let response;
    if(route.request().url().includes('/connect-api')){
     response={ok:true,status:'approved',classId:CLASS};
    }else if(route.request().url().includes('/connect-results')){
     if(body.action==='game-record')throw Error('UNTRUSTED_SCORE_WRITE');
     response=body.action==='student-load'?
      {ok:true,revision:0,resetEpoch:0,state:{rewards:REWARDS},storageSubject:PUPIL}:
      {ok:true,appXp:0,total:0,level:1};
    }else if(route.request().url().includes('/connect-objective-record-school')){
     if(body.action==='start-mode-v1'){
      assert.equal(body.level,1);assert.equal(body.mode,'sudden');assert.equal(body.appKey,item.app);
      response={ok:true,sessionId:SID,mode:'sudden',level:1,questions:
       Array.from({length:64},(_,i)=>({id:'q'+(i+1),op:'add',addends:item.addends})),
       expiresAt:'2099-01-01T00:00:00Z'};
     }else if(body.action==='finish-mode-v1'){
      assert.equal(body.sessionId,SID);
      assert.equal(body.answers.length,1,'one wrong first answer must end sudden');
      assert.equal(body.answers[0].id,'q1');
      assert.deepEqual(body.answers[0].digits,item.digits);
      assert.deepEqual(body.answers[0].carries,Array(item.width).fill(''));
      response={ok:true,revision:1,resetEpoch:0,duplicate:false,proofVerified:true,
       verifiedScore:0,xp:{appXp:0,delta:0,total:0,level:1}};
     }else throw Error('UNEXPECTED_SCHOOL_ACTION '+body.action);
    }else throw Error('UNKNOWN_ENDPOINT '+route.request().url());
    await route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
   });
   await page.goto(url+'/apps/objective-record/eleve.html?class='+CLASS+'&app='+item.slug,
    {waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,null,{timeout:45000});
   const game=page.frameLocator('#gameFrame').frameLocator('#game');
   await game.locator('#menuScreen:not(.hidden)').waitFor({state:'visible',timeout:30000});
   // The learner sets one shared visible level; the native sudden select is hidden.
   await game.locator('#trainingMaxDigits').selectOption(String(item.width));
   assert.equal(await game.locator('#suddenMaxDigits').inputValue(),String(item.width));
   await game.locator('#startSudden').click();
   await game.locator('#gameScreen:not(.hidden)').waitFor({state:'visible',timeout:25000});
   assert.equal(requests.filter(x=>x.action==='start-mode-v1').length,1);
   for(let c=0;c<item.digits.length;c++){
    const input=game.locator('.answer-input[data-calc="0"][data-col="'+c+'"]');
    await input.focus();await page.keyboard.press(item.digits[c]);
    assert.equal(await input.inputValue(),item.digits[c]);
   }
   // Validate the typed first attempt through the native keyboard handler.
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('vérifié'),
    null,{timeout:25000});
   assert.equal(requests.filter(x=>x.action==='finish-mode-v1').length,1);
   assert.equal(requests.filter(x=>x.action==='game-record').length,0);
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
 });
}
