// Chromium isolé : parcours certifié de Soustraction avec réponses et ACK réels
// échangés par le navigateur ; Supabase externe et profils scolaires NON sollicités.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const klass='22222222-2222-4222-8222-222222222222';
const student='33333333-3333-4333-8333-333333333333';
const UUID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const types={'.html':'text/html; charset=utf-8','.webp':'image/webp','.png':'image/png',
 '.css':'text/css','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const session={user:{id:student,is_anonymous:true},access_token:'TEST_ONLY_ACCESS_TOKEN'};
const browserStub='export function createClient(){return {auth:{getSession:async()=>({data:{session:'+JSON.stringify(session)+'}})}}}';
const awards=()=>({
 version:3,mastery:{'4':[false,false,false],'10':[false,false,false],'20':[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false
});
async function serve(){
 const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(root+'/')){res.writeHead(403).end();return}
  try{const bytes=await readFile(target);
   res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream','cache-control':'no-store'});
   res.end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
function fixture(){
 let revision=0,state=null,shared=0;
 const received=[],checks=[],issued=[];
 const questions=(total,method,width)=>Array.from({length:total},(_,i)=>{
  const a=width===3?'743':width===5?'54231':width===7?'9876543':'9'.repeat(width);
  const b='1'.repeat(width-1);
  return {id:'q'+(i+1),op:'sub',a,b,method,width};
 });
 const reply=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',
  headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
 return {received,checks,issued,get shared(){return shared},get state(){return state},
  get revision(){return revision},
  async handle(route){
   const data=JSON.parse(route.request().postData()||'{}');
   received.push(data);
   if(data.action==='student-me')return reply(route,{ok:true,status:'approved',classId:klass,displayName:'Élève test'});
   if(data.action==='student-load')return reply(route,{ok:true,state,revision,resetEpoch:0});
   if(data.action==='student-xp')return reply(route,{
    ok:true,appXp:revision?22:0,total:revision?22:0,level:1,next:50,
    milestones:[],currentMilestones:[],parcours:1,repeatXp:false,max:474});
   if(data.action==='student-score-history'){
    const events=state?.recent||[];
    return reply(route,{ok:true,events,bestThree:events,todayBest:events[0]||null,boardBest:0});
   }
   if(data.action==='student-share-score'){
    assert.equal(data.eventId,UUID);
    assert.ok(state?.recent?.length,'consentement seulement après la preuve');
    shared++;
    return reply(route,{ok:true});
   }
   if(data.action==='start-classic-v1'||data.action==='start-extended-v1'){
    assert.ok(['addBottom','takeTop'].includes(data.method));
    assert.ok([1,2,3].includes(data.level));
    const classic=data.action==='start-classic-v1';
    const mode=classic?'classic':data.mode;
    const n=classic?data.total:120,width=mode.startsWith('hard-')?[10,12,16][data.level-1]:[3,5,7][data.level-1];
    const q=questions(n,data.method,width);
    const row={ok:true,sessionId:UUID,revision,resetEpoch:0,
     level:data.level,total:classic?n:undefined,limit:classic?undefined:120,
     mode,method:data.method,questions:q,expiresAt:'2099-12-31T23:59:59.000Z'};
    issued.push(row);return reply(route,row);
   }
   if(data.action==='finish-classic-v1'||data.action==='finish-extended-v1'){
    const issue=issued.at(-1);
    assert.equal(data.sessionId,issue?.sessionId);
    assert.equal(data.answers?.length>0,true);
    const correct=data.answers.filter((x,i)=>{
     const q=issue.questions[i];
     return x.id===q.id&&BigInt(x.answer)===BigInt(q.a)-BigInt(q.b);
    }).length;
    const limit=issue.mode.includes('three-lives')?3:issue.mode==='classic'?Infinity:1;
    const wrong=data.answers.length-correct;
    assert.ok(data.answers.length===issue.questions.length||wrong===limit,
     'la preuve doit être complète ou finir sur la dernière vie');
    checks.push({mode:issue.mode,method:issue.method,correct,attempts:data.answers.length});
    revision++;
    const points=correct*5;
    const event={eventId:UUID,mode:issue.mode,level:issue.level,score:correct,
     total:issue.mode==='classic'?issue.total:null,points,at:new Date().toISOString()};
    state={classic:[{'4':correct},{},{}],sudden:[0,0,0],
     threeLives:[0,0,0],hard:[0,0,0],hardThreeLives:[0,0,0],
     progress:{},rewards:awards(),recent:[event],bestPoints:points,
     todayBest:{day:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(new Date()),points}};
    return reply(route,{ok:true,duplicate:false,proofVerified:true,verifiedScore:correct,
     revision,resetEpoch:0,state,xp:{appXp:correct?22:0,total:correct?22:0,delta:correct?22:0,
       level:1,previousLevel:1,next:50}});
   }
   throw Error('Action non simulée : '+data.action);
  }
 };
}
async function setup({viewport={width:1024,height:768},fixtureData=fixture()}={}){
 const {server,url}=await serve();
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport,reducedMotion:'reduce'});
 const unexpected=[];
 await context.route('**/*',async route=>{
  const uri=route.request().url();
  if(uri.startsWith(url))return route.continue();
  if(uri.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',
    headers:{'access-control-allow-origin':'*'},body:browserStub});
  if(uri.startsWith('https://mr-tat.github.io/Mathas-Connect/apps/')){
   const path=new URL(uri).pathname.split('/').slice(-2);
   const target=resolve(root,'apps',path[0],path[1]);
   if(!target.startsWith(root+'/apps/')){unexpected.push(uri);return route.abort()}
   const bytes=await readFile(target);
   return route.fulfill({status:200,contentType:types[extname(target)]||'application/octet-stream',
    headers:{'access-control-allow-origin':'*'},body:bytes});
  }
  if(uri.includes('.supabase.co/functions/v1/'))return fixtureData.handle(route);
  unexpected.push(uri);return route.abort();
 });
 return {url,browser,context,server,fixture:fixtureData,unexpected,
  async page(){
   const page=await context.newPage();
   await page.goto(url+'/apps/soustraction-simple/?class='+klass,{waitUntil:'domcontentloaded'});
   const frame=page.frameLocator('iframe');
   await frame.locator('#menuScreen').waitFor({timeout:30000});
   await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.__mathasSubCertifiedRouter===true,
    null,{timeout:30000});
   return {page,frame};
  },
  async close(){await context.close();await browser.close();await new Promise(ok=>server.close(ok))}
 };
}

async function launchClassic(page,frame,{method='addBottom',count=4}={}){
 await frame.locator('input[name="borrowMethod"][value="'+method+'"]').evaluate(input=>input.closest('label').click());
 await frame.locator('#classicCountPicker .classic-count-btn[data-count="'+count+'"]').evaluate(el=>{
  const w=el.ownerDocument.defaultView;
  w.__mathasClassicClicks=[];
  w.addEventListener('click',event=>{
   const b=event.target?.closest?.('button');
   if(b?.id==='startClassic'||b?.matches?.('.classic-count-btn[data-count]'))
    w.__mathasClassicClicks.push({id:b.id||'',count:b.dataset.count||'',
      trusted:event.isTrusted,phase:event.eventPhase,active:b.classList.contains('active')});
  },true);
 });
 await frame.locator('#classicCountPicker .classic-count-btn[data-count="'+count+'"]').click();
 console.log('CERTIFIED CLASSIC',JSON.stringify({requested:count,
  clicks:await frame.locator('body').evaluate(()=>window.__mathasClassicClicks)}));
 await frame.locator('#gameScreen:not(.hidden) #calculationsPair .calc-box').first().waitFor({timeout:20000});
 assert.equal(await page.locator('.mathas-sub-proof:not([hidden])').count(),0,
  'Les exercices normaux restent dans les grilles originales, pas dans une interface parallèle');
}
async function fillCalc(frame,index,raw){
 await frame.locator('#calculationsPair').evaluate((pair,{index,raw})=>{
  const box=pair.querySelectorAll('.calc-box')[index];
  if(!box)throw Error('Calcul natif absent '+index);
  const fields=[...box.querySelectorAll('.answer-input')];
  const digits=String(raw).padStart(fields.length,'0').split('').reverse();
  if(digits.length!==fields.length)throw Error('Valeur à trop de chiffres');
  for(let col=0;col<fields.length;col++){
   const input=box.querySelector('.answer-input[data-col="'+col+'"]');
   if(!input)throw Error('Saisie native absente, colonne '+col);
   input.focus();
   const key=document.querySelector('#numpad .num-key[data-key="'+digits[col]+'"]');
   if(!key)throw Error('Touche native absente : '+digits[col]);
   key.click();
  }
 },{index,raw});
}
async function solvePair(frame,questions){
 for(let i=0;i<questions.length;i++)
  await fillCalc(frame,i,String(BigInt(questions[i].a)-BigInt(questions[i].b)));
 // Le moteur natif peut valider automatiquement la paire lors de la dernière
 // saisie ; ne pas cliquer derrière le reçu officiel déjà affiché.
 await frame.locator('#primaryBtn').evaluate(btn=>{
  // La dernière case peut déclencher automatiquement la certification.
  if(!btn.closest('#gameScreen')?.classList.contains('hidden')&&btn.textContent.includes('Valider'))btn.click();
 });
}
test('Chromium scolaire natif : 4 soustractions, XP, consentement et projection', {timeout:120000},async()=>{
 const ctx=await setup(),errors=[];
 try{
  const {page,frame}=await ctx.page();
  page.on('pageerror',e=>errors.push(e.message));
  await launchClassic(page,frame,{method:'takeTop',count:4});
  assert.equal(ctx.fixture.issued[0]?.method,'takeTop');
  assert.equal(ctx.fixture.issued[0]?.total,4);
  assert.equal(await frame.locator('#calculationsPair .calc-box:visible').count(),2);
  const q=ctx.fixture.issued[0].questions;
  await solvePair(frame,q.slice(0,2));
  await frame.locator('#primaryBtn').click();
  await solvePair(frame,q.slice(2,4));
  await page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:25000});
  assert.deepEqual(ctx.fixture.checks[0],{mode:'classic',method:'takeTop',correct:4,attempts:4});
  assert.equal(ctx.fixture.received.some(x=>x.action==='game-record'),false);
  assert.equal(ctx.fixture.shared,0);
  await page.locator('.mathas-projection-offer:not([hidden]) button.yes').click({timeout:16000});
  await page.waitForFunction(()=>document.querySelector('.mathas-projection-offer')?.hidden===true,null,{timeout:15000});
  assert.equal(ctx.fixture.shared,1);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
});
test('Chromium scolaire natif : 3 vies et trois erreurs', {timeout:120000},async()=>{
 const ctx=await setup({viewport:{width:390,height:740}});
 try{
  const {page,frame}=await ctx.page();
  await frame.locator('#mathasSousThreeLives').click();
  await frame.locator('#gameScreen:not(.hidden) #calculationsPair .calc-box').first().waitFor({timeout:20000});
  await fillCalc(frame,0,'0');
  await frame.locator('#primaryBtn').click();
  await fillCalc(frame,1,'0');
  await frame.locator('#primaryBtn').click();
  await frame.locator('#primaryBtn').click();
  await fillCalc(frame,0,'0');
  await frame.locator('#primaryBtn').click();
  await page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:25000});
  assert.deepEqual(ctx.fixture.checks[0],{mode:'three-lives',method:'addBottom',correct:0,attempts:3});
  assert.equal(ctx.fixture.received.some(x=>x.action==='game-record'),false);
 }finally{await ctx.close()}
});
test('Chromium scolaire natif : reprise du même calcul après interruption', {timeout:120000},async()=>{
 const ctx=await setup();
 try{
  const first=await ctx.page();
  await launchClassic(first.page,first.frame,{method:'takeTop'});
  const q=ctx.fixture.issued[0].questions;
  await fillCalc(first.frame,0,String(BigInt(q[0].a)-BigInt(q[0].b)));
  await first.frame.locator('#primaryBtn').click();
  await first.page.close();
  const second=await ctx.page();
  await launchClassic(second.page,second.frame,{method:'takeTop'});
  assert.equal(ctx.fixture.issued.length,1,'Une reprise réutilise les nombres serveur');
  await fillCalc(second.frame,1,String(BigInt(q[1].a)-BigInt(q[1].b)));
  await second.frame.locator('#primaryBtn').click();
  await second.frame.locator('#primaryBtn').click();
  await solvePair(second.frame,q.slice(2,4));
  try{
  await second.page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:13000});
 }catch(error){
  const state=await second.frame.locator('body').evaluate(body=>({
   phase:body.querySelector('#gameScreen')?.className,
   primary:body.querySelector('#primaryBtn')?.textContent,
   feedback:body.querySelector('#feedback')?.textContent,
   calculations:[...body.querySelectorAll('#calculationsPair .calc-box')].map(x=>({
    answers:[...x.querySelectorAll('.answer-input')].map(n=>n.value),
    statuses:[...x.querySelectorAll('.calc-status')].map(n=>n.textContent)
   }))
  }));
  const transcript=await second.page.evaluate(()=>{
   const key=Object.keys(localStorage).find(k=>k.startsWith('mathas.sub-certified.'));
   return key?JSON.parse(localStorage.getItem(key)):null;
  });
  throw Error('Reprise non terminée : '+JSON.stringify({
   issued:ctx.fixture.issued.length,checks:ctx.fixture.checks,events:ctx.fixture.received.slice(-5),
   state,answers:transcript?.answers,total:transcript?.total
  })+' '+error.message);
 }
  assert.equal(ctx.fixture.checks.length,1);
  assert.equal(ctx.fixture.checks[0].correct,4);
 }finally{await ctx.close()}
});


async function launchHard(page,frame,mode='hard-sudden'){
 await frame.locator('#trainingMaxDigits').evaluate(select=>{
  // Dans l'interface élève, les paramètres de niveau sont masqués par la carte :
  // c'est la transition native vers HARD qui est testée, pas le <select> caché.
  const option=[...select.options].find(x=>x.value==='__hard__');
  if(!option)throw Error('Option HARD absente du moteur');
  select.value='__hard__';
  select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await frame.locator('#hardMenuScreen:not(.hidden)').waitFor({timeout:16000});
 const selector=mode==='hard-sudden'
  ?'#hardLevelGrid .hard-start[data-mode="sudden"][data-level="1"]'
  :'#hardLevelGrid .mathas-sub-hard-three[data-mode="three-lives"][data-level="1"]';
 await frame.locator(selector).waitFor({timeout:15000});
 await frame.locator(selector).click();
 await frame.locator('#hardGameScreen:not(.hidden) #hardOperation .hard-answer').first().waitFor({timeout:15000});
 assert.equal(await page.locator('.mathas-sub-proof:not([hidden])').count(),0,
  'Le mode HARD utilise la vraie grille d’emprunt du moteur');
}
async function wrongHardCalc(frame){
 const pad=frame.locator('#hardNumpad .hard-key[data-key="0"]');
 const count=await frame.locator('#hardOperation .hard-answer').count();
 assert.ok(count>=9&&count<=16,'Véritable calcul HARD avec au moins neuf chiffres');
 for(let i=0;i<count;i++)await pad.evaluate(button=>button.click());
}
test('Chromium scolaire natif : HARD mort subite vérifie une erreur serveur', {timeout:120000},async()=>{
 const ctx=await setup();
 try{
  const {page,frame}=await ctx.page();
  await launchHard(page,frame,'hard-sudden');
  await wrongHardCalc(frame);
  await page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:25000});
  assert.equal(ctx.fixture.checks[0]?.mode,'hard-sudden');
  assert.equal(ctx.fixture.checks[0]?.attempts,1);
  assert.equal(ctx.fixture.received.some(x=>x.action==='game-record'),false);
 }finally{await ctx.close()}
});
test('Chromium scolaire natif : HARD trois vies se terminent au troisième échec', {timeout:120000},async()=>{
 const ctx=await setup();
 try{
  const {page,frame}=await ctx.page();
  await launchHard(page,frame,'hard-three-lives');
  for(let i=0;i<3;i++){
   if(i>0)await frame.locator('#hardPrimary').click();
   await wrongHardCalc(frame);
  }
  await page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:25000});
  assert.equal(ctx.fixture.checks[0]?.mode,'hard-three-lives');
  assert.equal(ctx.fixture.checks[0]?.attempts,3);
  assert.equal(ctx.fixture.shared,0);
 }finally{await ctx.close()}
});
