// Browser integration with REAL native keydown and focus, not direct calls to
// MathasCertifiedAttempt or fabricated MathasLabV2Update terminal events.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const TEST_CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const CLASS=process.env.MATHAS_SCHOOL_KEYBOARD_CLASS||TEST_CLASS;
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
  try{const bytes=await readFile(file);const type=({'.html':'text/html; charset=utf-8',
    '.mjs':'text/javascript','.js':'text/javascript','.png':'image/png',
    '.webp':'image/webp','.css':'text/css'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(bytes);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
const examples=[
 {slug:'addition-simple',app:'addition-ecrite-simple',start:'start-proof-v2',finish:'finish-proof-v2',
  width:3,questions:[
   {id:'q1',op:'add',a:123,b:456},
   {id:'q2',op:'add',a:589,b:632},
   {id:'q3',op:'add',a:500,b:503},
   {id:'q4',op:'add',a:500,b:900}
  ]},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',start:'start-proof-multi-v1',finish:'finish-proof-multi-v1',
  width:5,questions:[
   {id:'q1',op:'add',addends:[12345,67890,11111]},
   {id:'q2',op:'add',addends:[99999,99999,99999]},
   {id:'q3',op:'add',addends:[65002,10003,21004]},
   {id:'q4',op:'add',addends:[12345,23456,34567]}
  ]}
];
const numbers=q=>q.addends??[q.a,q.b];
const carry=(nums,c)=>{
 const base=10**c,n=Math.floor(nums.reduce((total,x)=>total+(x%base),0)/base);
 return n?String(n):'';
};
for(const item of examples){
 test('Chromium, vrai clavier : '+item.slug+' 4 opérations et reports natifs -> un seul reçu XP',async()=>{
  const {server,url}=await serve();let browser;
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   const requests=[],errors=[];let xp=0;
   page.on('pageerror',err=>errors.push(err.message));
   page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text())});
   await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
    status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+AUTH+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:true}},error:null})}}}'
   }));
   await page.route('**/*.supabase.co/**',async r=>{
    const b=r.request().postDataJSON()??{};requests.push(b);
    let reply;
    if(r.request().url().includes('/connect-api'))reply={ok:true,status:'approved',classId:CLASS};
    else if(r.request().url().includes('/connect-results')){
     reply=b.action==='student-load'
      ?{ok:true,revision:xp?1:0,resetEpoch:0,state:{rewards:REWARDS},storageSubject:PUPIL}
      :{ok:true,appXp:xp,total:xp,level:1};
    }else if(r.request().url().includes('/connect-projection-v2')){
     if(b.action!=='student-score-history')throw Error('unexpected score action '+b.action);
     reply={ok:true,events:[],bestThree:[],todayBest:null,boardBest:0};
    }else if(r.request().url().includes('/connect-objective-record-')){
     assert.ok(r.request().url().includes(CLASS===TEST_CLASS?'connect-objective-record-test':'connect-objective-record-school'),
      'the authenticated host must use only the matching proof endpoint');
     if(b.action===item.start){
      assert.equal(b.level,1);assert.equal(b.total,4);
      reply={ok:true,sessionId:SID,questions:item.questions,revision:0,resetEpoch:0,
       level:1,total:4,expiresAt:'2090-12-31T23:59:59Z'};
     }else if(b.action===item.finish){
      assert.equal(b.sessionId,SID);
      assert.equal(b.answers.length,4);
      for(let i=0;i<4;i++){
       const nums=numbers(item.questions[i]),sum=nums.reduce((s,n)=>s+n,0);
       const first=b.answers[i];assert.equal(first.id,item.questions[i].id);
       assert.deepEqual(first.digits,String(sum).split('').reverse(),
        'key events must capture actual written answer digits');
       assert.deepEqual(first.carries,Array.from({length:item.width},(_,c)=>c?carry(nums,c):''),
        'key events must capture actual written carries, including >1');
      }
      xp=22;reply={ok:true,revision:1,resetEpoch:0,proofVerified:true,verifiedScore:4,
       xp:{appXp:22,total:22,level:1,delta:22}};
     }else throw Error('unexpected edge action '+b.action);
    }else throw Error('unexpected route '+r.request().url());
    await r.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(reply)});
   });
   await page.goto(url+'/apps/objective-record/eleve.html?class='+CLASS+'&app='+item.slug,
    {waitUntil:'domcontentloaded',timeout:25000});
   try{await page.waitForFunction(()=>!document.getElementById('certify').disabled,null,{timeout:9000});}
   catch(error){
    const diag=await page.evaluate(()=>({title:document.title,
     status:document.getElementById('status')?.textContent,
     certifyDisabled:document.getElementById('certify')?.disabled,
     module:document.querySelector('script[type="module"]')?.getAttribute('src')}));
    throw Error('Student app bootstrap failed '+JSON.stringify({errors,diag})+' '+error);
   }
   // Les deux additions lancent leurs épreuves depuis le vrai menu pédagogique.
   const nativeLaunch=page.frameLocator('#gameFrame').frameLocator('#game');
   await nativeLaunch.locator('.classic-count-btn[data-count="4"]').click();
   const game=page.frameLocator('#gameFrame').frameLocator('#game');
   await game.locator('#gameScreen:not(.hidden)').waitFor({state:'visible',timeout:30000});
   // Permettre de changer « dizaines d'abord » pendant une partie, pour les
   // deux additions : un seul état sur l'accueil, le calcul et HARD.
   const inGame=game.locator('#mathasTensFirstDuringGame-normal');
   await inGame.waitFor({state:'visible',timeout:12000});
   await inGame.check();
   const enabled=await page.evaluate(()=>{
    const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
    const d=w.document;
    return {home:d.getElementById('tensFirstToggle').checked,
     running:d.getElementById('mathasTensFirstDuringGame-normal').checked,
     hard:d.getElementById('mathasTensFirstDuringGame-hard')?.checked,
     stored:w.__mathasTensFirst,
     hint:d.getElementById('instructionText').textContent};
   });
   assert.equal(enabled.home,true,'l’accueil doit suivre le choix pendant le calcul');
   assert.equal(enabled.running,true);
   assert.equal(enabled.hard,true,'le choix doit aussi être synchronisé avec HARD');
   assert.equal(enabled.stored,true,'le moteur doit réagir immédiatement');
   assert.match(enabled.hint,/écris d’abord/i);
   await inGame.uncheck();
   const disabled=await page.evaluate(()=>{
    const w=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
    const d=w.document;
    return {home:d.getElementById('tensFirstToggle').checked,
     hard:d.getElementById('mathasTensFirstDuringGame-hard')?.checked,
     stored:w.__mathasTensFirst,
     hint:d.getElementById('instructionText').textContent};
   });
   assert.equal(disabled.home,false);
   assert.equal(disabled.hard,false);
   assert.equal(disabled.stored,false);
   assert.match(disabled.hint,/écris ensuite/i);

   // Le mode normal n'affiche pas l'ambre sur une case de retenue.
   const disabledCarry=game.locator('.carry-input[data-calc="1"][data-carry-col="1"]');
   await disabledCarry.focus();
   assert.equal(await game.locator('.answer-input[data-calc="1"][data-col="0"]')
    .evaluate(el=>el.classList.contains('mathas-amber-followup')),false);
   await inGame.check();

   for(let batch=0;batch<2;batch++){
    for(let slot=0;slot<2;slot++){
     const q=item.questions[2*batch+slot],nums=numbers(q);
     const digits=String(nums.reduce((s,n)=>s+n,0)).split('').reverse();
     const overflow=digits.length>item.width;
     if(carry(nums,1)){
      const carry1=game.locator('.carry-input[data-calc="'+slot+'"][data-carry-col="1"]');
      const following=game.locator('.answer-input[data-calc="'+slot+'"][data-col="0"]');
      await carry1.focus();
      assert.equal(await following.evaluate(el=>el.classList.contains('mathas-amber-followup')),
       true,'la case d’unité suivante est discrètement ambre');
      await following.focus();
      assert.equal(await following.evaluate(el=>el.classList.contains('mathas-amber-followup')),false,
       'l’ambre disparaît dès que la case devient active');
     }
     for(let c=0;c<digits.length;c++){
      if(overflow&&c===item.width)continue; // Report extérieur déjà saisi avant.
      if(overflow&&c===item.width-1){
       const leading=game.locator('.answer-input[data-calc="'+slot+'"][data-col="'+item.width+'"]');
       const follower=game.locator('.answer-input[data-calc="'+slot+'"][data-col="'+(item.width-1)+'"]');
       // Après la colonne précédente, la case du millier / cent-millier
       // doit s'activer seule AVANT les unités de cette colonne.
       await game.locator('.answer-input[data-calc="'+slot+'"][data-col="'+item.width+'"].active-entry')
        .waitFor({state:'visible',timeout:4000});
       assert.equal(await follower.evaluate(el=>el.classList.contains('mathas-amber-followup')),
        true,'le prochain chiffre d’unité est ambre pendant le report extérieur');
       await page.keyboard.press(digits[item.width]);
       assert.equal(await leading.inputValue(),digits[item.width],
        'la retenue extérieure doit être écrite avant les unités');
       await game.locator('.answer-input[data-calc="'+slot+'"][data-col="'+(item.width-1)+'"].active-entry')
        .waitFor({state:'visible',timeout:4000});
       assert.equal(await follower.evaluate(el=>el.classList.contains('mathas-amber-followup')),false);
      }
      const input=game.locator('.answer-input[data-calc="'+slot+'"][data-col="'+c+'"]');
      await input.focus();
      await page.keyboard.press(digits[c]);
      assert.equal(await input.inputValue(),digits[c],
       'actual keyboard digit did not reach native answer');
     }
     for(let c=1;c<item.width;c++){
      const digit=carry(nums,c);
      if(!digit)continue;
      const input=game.locator('.carry-input[data-calc="'+slot+'"][data-carry-col="'+c+'"]');
      await input.focus();await page.keyboard.press(digit);
      assert.equal(await input.inputValue(),digit,
       'actual keyboard carry did not reach native value');
     }
    }
    // Native engine automatically checks when both calculations are complete.
    if(batch===0){
     await game.locator('#primaryBtn').filter({hasText:'Passer aux 2 calculs suivants'})
      .waitFor({state:'visible',timeout:13000});
     await game.locator('#primaryBtn').click();
     await game.locator('.calc-label').first().filter({hasText:'Calcul 3'})
      .waitFor({state:'visible',timeout:13000});
    }
   }
   await page.waitForFunction(()=>document.getElementById('status')?.textContent.includes('XP Connect'),
    null,{timeout:25000});
   assert.equal(xp,22);
   assert.equal(requests.filter(x=>x.action===item.finish).length,1);
   assert.equal(requests.filter(x=>x.action==='game-record').length,0);
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
 });
}
