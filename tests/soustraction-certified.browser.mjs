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
async function clickAndAnswer(page,frame,{method='addBottom',count=4}={}){
 await frame.locator('input[name="borrowMethod"][value="'+method+'"]').evaluate(input=>input.closest('label').click());
 await frame.locator('#classicCountPicker .classic-count-btn[data-count="'+count+'"]').click();
 await page.locator('.mathas-sub-proof:not([hidden]) .mathas-sub-answer').waitFor({timeout:20000});
}
async function solve(page,answers){
 for(const value of answers){
  const box=page.locator('.mathas-sub-proof:not([hidden]) .mathas-sub-answer');
  await box.fill(value);
  await page.locator('.mathas-sub-proof:not([hidden]) button.primary').first().click();
 }
 await page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:30000});
}
test('Chromium scolaire certifié: 4 soustractions -> preuve, XP, consentement et projection', {timeout:120000},async()=>{
 const ctx=await setup(),errors=[];
 try{
  const {page,frame}=await ctx.page();
  page.on('pageerror',e=>errors.push(e.message));
  await clickAndAnswer(page,frame,{method:'takeTop',count:4});
  assert.equal(ctx.fixture.issued[0]?.method,'takeTop','méthode conservée dans le défi serveur');
  assert.equal(await frame.locator('#calculationsPair .calc-box:visible').count(),0,
   'le jeu libre ne doit pas lancer un score non certifié');
  const questions=ctx.fixture.issued[0].questions;
  await solve(page,questions.map(q=>String(BigInt(q.a)-BigInt(q.b))));
  assert.equal(ctx.fixture.checks.length,1);
  assert.deepEqual(ctx.fixture.checks[0],{mode:'classic',method:'takeTop',correct:4,attempts:4});
  assert.equal(ctx.fixture.received.some(x=>x.action==='game-record'),false);
  assert.equal(ctx.fixture.shared,0,'aucun partage sans consentement');
  await page.locator('.mathas-projection-offer:not([hidden]) button.yes').waitFor({timeout:12000});
  await page.locator('.mathas-projection-offer:not([hidden]) button.yes').click();
  await page.waitForFunction(()=>document.querySelector('#ce-identity')?.textContent?.includes('Connecté'),null,{timeout:20000});
  // Le mock est réellement invoqué après le geste Oui.
  await page.waitForFunction(()=>document.querySelector('.mathas-projection-offer')?.hidden===true,null,{timeout:15000});
  assert.equal(ctx.fixture.shared,1);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
});
test('Chromium scolaire: 3 vies, exactement trois erreurs et zéro score client', {timeout:120000},async()=>{
 const ctx=await setup({viewport:{width:390,height:740}});
 try{
  const {page,frame}=await ctx.page();
  assert.equal(await frame.locator('#mathasSubThreeLives').count(),1);
  assert.equal(await frame.locator('#hardLevelGrid .mathas-sub-hard-three').count(),3);
  await frame.locator('#mathasSubThreeLives').click();
  await page.locator('.mathas-sub-proof:not([hidden]) .mathas-sub-answer').waitFor({timeout:20000});
  for(let i=0;i<3;i++){
   await page.locator('.mathas-sub-proof:not([hidden]) .mathas-sub-answer').fill('0');
   await page.locator('.mathas-sub-proof:not([hidden]) button.primary').first().click();
  }
  await page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:20000});
  assert.deepEqual(ctx.fixture.checks[0],{mode:'three-lives',method:'addBottom',correct:0,attempts:3});
  assert.equal(ctx.fixture.received.some(x=>x.action==='game-record'),false);
  assert.equal(ctx.fixture.shared,0);
 }finally{await ctx.close()}
});
test('Chromium scolaire: interruption puis reprise même élève, preuve soumise une fois', {timeout:120000},async()=>{
 const ctx=await setup();
 try{
  const first=await ctx.page();
  await clickAndAnswer(first.page,first.frame);
  const q=ctx.fixture.issued[0].questions;
  for(let i=0;i<2;i++){
   await first.page.locator('.mathas-sub-proof:not([hidden]) .mathas-sub-answer')
    .fill(String(BigInt(q[i].a)-BigInt(q[i].b)));
   await first.page.locator('.mathas-sub-proof:not([hidden]) button.primary').first().click();
  }
  assert.equal(ctx.fixture.checks.length,0);
  await first.page.close();
  const second=await ctx.page();
  await clickAndAnswer(second.page,second.frame);
  assert.equal(ctx.fixture.issued.length,1,'reprise locale, aucun nouveau défi requis');
  for(let i=2;i<4;i++){
   await second.page.locator('.mathas-sub-proof:not([hidden]) .mathas-sub-answer')
    .fill(String(BigInt(q[i].a)-BigInt(q[i].b)));
   await second.page.locator('.mathas-sub-proof:not([hidden]) button.primary').first().click();
  }
  await second.page.getByRole('heading',{name:'Série vérifiée ✓'}).waitFor({timeout:25000});
  assert.equal(ctx.fixture.checks.length,1,'une seule preuve vérifiée');
  assert.equal(ctx.fixture.checks[0].correct,4);
 }finally{await ctx.close()}
});
