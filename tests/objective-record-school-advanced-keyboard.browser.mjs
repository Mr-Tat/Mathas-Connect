// Real Chromium + real native keyboard: school advanced proof endpoint is mocked.
// No real school/pupil account, no Supabase production data or XP.
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
 '20':[false,false,false]},sudden:[false,false,false],
 hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{
   const bytes=await readFile(file);
   const type=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript',
     '.css':'text/css','.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(bytes);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
const cases=[
 {slug:'addition-simple',app:'addition-ecrite-simple',mode:'sudden',
  width:3,terms:['123','45'],sum:'168',errors:1},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',mode:'sudden',
  width:5,terms:['12345','11111','22222'],sum:'45678',errors:1},
 {slug:'addition-simple',app:'addition-ecrite-simple',mode:'hard-sudden',
  width:10,terms:['1111111111','1111111111'],sum:'2222222222',errors:1},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',mode:'hard-sudden',
  width:9,terms:Array(6).fill('111111111'),sum:'666666666',errors:1},
 {slug:'addition-simple',app:'addition-ecrite-simple',mode:'three-lives',
  width:3,terms:['123','45'],sum:'168',errors:3},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',mode:'three-lives',
  width:5,terms:['12345','11111','22222'],sum:'45678',errors:3},
 {slug:'addition-simple',app:'addition-ecrite-simple',mode:'hard-three-lives',
  width:10,terms:['1111111111','1111111111'],sum:'2222222222',errors:3},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',mode:'hard-three-lives',
  width:9,terms:Array(6).fill('111111111'),sum:'666666666',errors:3}
];
for(const item of cases)test('Chromium genuine native advanced keyboard '+item.slug+' '+item.mode,async()=>{
 const {server,url}=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1380,height:890}}),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
   status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
   body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+AUTH+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:true}},error:null})}}}'
  }));
  const questions=Array.from({length:64},(_,i)=>({id:'q'+(i+1),op:'add',addends:item.terms}));
  await page.route('**/*.supabase.co/**',async r=>{
   const b=r.request().postDataJSON()??{};requests.push(b);
   let response;
   if(r.request().url().includes('/connect-api'))response={ok:true,status:'approved',classId:CLASS};
   else if(r.request().url().includes('/connect-results'))response=b.action==='student-load'
     ?{ok:true,revision:0,resetEpoch:0,state:{rewards:REWARDS},storageSubject:PUPIL}
     :{ok:true,appXp:0,total:0,level:1};
   else if(r.request().url().includes('/connect-objective-record-school')){
    assert.equal(b.appKey,item.app);
    if(b.action==='start-advanced-v1'){
     assert.equal(b.mode,item.mode);assert.equal(b.level,1);
     response={ok:true,sessionId:SID,appKey:item.app,mode:item.mode,level:1,
      maxQuestions:64,questions,revision:0,resetEpoch:0,expiresAt:'2099-01-01T00:00:00Z'};
    }else if(b.action==='finish-advanced-v1'){
     assert.equal(b.sessionId,SID);
     assert.equal(b.answers.length,item.errors);
     for(let i=0;i<item.errors;i++){
      assert.equal(b.answers[i].id,'q'+(i+1));
      assert.deepEqual(b.answers[i].digits,Array(item.sum.length).fill('0'),
       'native keyboard submitted different first digits');
      assert.deepEqual(b.answers[i].carries,Array(item.width).fill(''),
       'native keyboard submitted different first carries');
     }
     response={ok:true,proofVerified:true,verifiedScore:0,verifiedErrors:item.errors,questionsChecked:item.errors,
      mode:item.mode,duplicate:false,xp:{delta:0,appXp:0,total:0,level:1}};
    }else throw Error('unexpected certified school action '+b.action);
   }else throw Error('unexpected endpoint '+r.request().url());
   await r.fulfill({status:200,contentType:'application/json',
    headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)});
  });
  await page.goto(url+'/apps/objective-record/eleve.html?class='+CLASS+'&app='+item.slug,
   {waitUntil:'domcontentloaded',timeout:25000});
  const game=page.frameLocator('#gameFrame').frameLocator('#game');
  if(item.mode.startsWith('hard-')){
   await game.locator('#trainingMaxDigits').waitFor({state:'visible',timeout:35000});
   await game.locator('#trainingMaxDigits').selectOption('__hard__');
   await game.locator('#hardMenuScreen:not(.hidden)').waitFor({state:'visible',timeout:15000});
   await game.locator('.hard-start[data-level="1"][data-mode="'+
     (item.errors===3?'three-lives':'sudden')+'"]')
    .click();
   await game.locator('#hardGameScreen:not(.hidden)').waitFor({state:'visible',timeout:20000});
   for(let question=0;question<item.errors;question++){
    if(question>0){
     await game.locator('#hardPrimary').click();
     await game.locator('#hardSessionCounter')
      .filter({hasText:'Calcul '+(question+1)}).waitFor({timeout:15000});
    }
    for(let col=0;col<item.sum.length;col++){
     const input=game.locator('.hard-answer[data-col="'+col+'"]');
     await input.focus();await page.keyboard.press('0');
     assert.equal(await input.inputValue(),'0');
    }
    // HARD automatically verifies a fully filled operation. No second
    // click after the terminal result: projection consent then overlays it.
   }
  }else{
   await game.locator(item.errors===3?'#startThreeLives':'#startSudden').click();
   await game.locator('#gameScreen:not(.hidden)').waitFor({state:'visible',timeout:20000});
   for(let question=0;question<item.errors;question++){
    if(question===2){
     await game.locator('#primaryBtn').click();
     await game.locator('.calc-label').first().filter({hasText:'Calcul 3'})
      .waitFor({state:'visible',timeout:15000});
    }
    const slot=question%2;
    for(let col=0;col<item.sum.length;col++){
     const input=game.locator('.answer-input[data-calc="'+slot+'"][data-col="'+col+'"]');
     await input.focus();await page.keyboard.press('0');
     assert.equal(await input.inputValue(),'0');
    }
    await game.locator('#primaryBtn').click();
   }
  }
  await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('XP Connect vérifiés'),
   null,{timeout:25000});
  assert.equal(requests.filter(x=>x.action==='start-advanced-v1').length,1);
  assert.equal(requests.filter(x=>x.action==='finish-advanced-v1').length,1);
  assert.equal(requests.filter(x=>x.action==='game-record').length,0);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
