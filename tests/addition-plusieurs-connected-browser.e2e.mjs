import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {playFourAdditions} from './addition-plusieurs-real-play-helper.mjs';

// Browser integration test: the reviewed direct-link pilot code is enabled.
// The mocked HTTP responses are confined to THIS isolated test context.
// No writes, deploys or auth sessions to the real Supabase project.
const base='http://127.0.0.1:8765';
const classroom='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pupil='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const basePath='/apps/addition-plusieurs/';
const states=new Map(), calls=[];
let profileApproved=true;
const initial=()=>({revision:0,resetEpoch:0,state:null,appXp:0,total:0});
function backend(pupilId){if(!states.has(pupilId))states.set(pupilId,initial());return states.get(pupilId)}
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 const errors=[];
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/apps/addition-plusieurs/connect-pilot.mjs',async route=>{
   const res=await route.fetch();
   const body=await res.text();
   assert.ok(body.includes('export const CONNECT_WRITE_READY=true;'),'direct-link pilot must be enabled');
   await route.fulfill({response:res,body,contentType:'text/javascript'});
 });
 await context.route('https://esm.sh/@supabase/supabase-js@2.95.0',async route=>{
   await route.fulfill({status:200,contentType:'text/javascript',body:`
     export function createClient(){return {auth:{getSession:async()=>({data:{session:{
       access_token:'TEST-TOKEN',user:{id:'${pupil}',is_anonymous:true}
     }}})}}}
   `});
 });
 await context.route('https://awmhpfofacaglewammxt.supabase.co/functions/v1/**',async route=>{
   const req=route.request(),payload=JSON.parse(req.postData()||'{}');
   const st=backend(pupil);
   calls.push({url:req.url(),action:payload.action,eventId:payload.eventId,
    revision:payload.expectedRevision,epoch:payload.expectedResetEpoch,points:payload.points});
   const respond=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   if(req.headers().authorization!=='Bearer TEST-TOKEN')throw Error('missing_authenticated_token');
   if(payload.classId!==classroom)throw Error('wrong_class');
   if(payload.action==='student-me')return respond({ok:true,status:profileApproved?'approved':'unregistered',classId:classroom,displayName:'Élève test'});
   if(payload.appKey!=='addition-ecrite-multiple')throw Error('wrong_game_key');
   if(payload.action==='student-load')return respond({ok:true,revision:st.revision,resetEpoch:st.resetEpoch,state:st.state});
   if(payload.action==='student-xp')return respond({ok:true,appXp:st.appXp,total:st.total,level:1,next:50});
   if(payload.action!=='game-record')throw Error('unexpected_action '+payload.action);
   assert.equal(payload.points,0,'XP must be computed by the server');
   assert.equal(payload.mode,'classic');
   assert.equal(payload.level,1);
   assert.equal(payload.score,4);
   assert.equal(payload.total,4);
   assert.equal(payload.expectedRevision,st.revision);
   assert.equal(payload.expectedResetEpoch,st.resetEpoch);
   const old=st.appXp;
   st.state??={classic:[{},{},{}],sudden:[null,null,null],hard:[null,null,null]};
   st.state.classic[0][4]=4;
   st.state.rewards=payload.rewards??st.state.rewards??null;
   st.revision++;
   st.appXp=22;st.total=22;
   return respond({ok:true,revision:st.revision,resetEpoch:st.resetEpoch,
     xp:{appXp:st.appXp,total:st.total,delta:st.appXp-old,level:1,next:50}});
 });
 const launch=async()=>{
  await page.goto(base+basePath+'?class='+classroom,{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('iframe#game');
  await frame.locator('body').waitFor({timeout:20000});
  await page.waitForFunction(()=>document.getElementById('game')?.contentWindow?.__mathasGameStorageScope?.startsWith('connect.'),null,{timeout:20000});
  assert.equal(await frame.locator('body').evaluate(()=>window.__mathasGameStorageScope),
   'connect.'+classroom+'.'+pupil);
  return frame;
 };
 const nativeTrophies={
   version:3,mastery:{4:[true,false,false],10:[false,false,false],20:[false,false,false]},
   sudden:[false,false,false],
   hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
   scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false
 };
 const frame=await launch();
 await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='0 XP');
 // Trigger genuine engine completion callback; not an arithmetic click-through.
 // Actual four written additions, all carries and answers entered by keyboard.
 await playFourAdditions({frame,page});
 await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='22 XP',{timeout:15000});
 assert.equal(backend(pupil).appXp,22);
 assert.equal(backend(pupil).revision,1);
 assert.equal(backend(pupil).state.rewards?.mastery?.[4]?.[0],true,
  'real original gameplay must award a bronze mastery milestone');

 assert.equal(calls.filter(c=>c.action==='game-record').length,1);
 // A repeated completion may update history but MUST NOT grant extra XP.
 await frame.locator('body').evaluate(()=>window.__setLastWork({label:'Calculs · Niveau 1',score:'4/4',rulerUsed:false}));
 await page.waitForFunction(()=>document.getElementById('audit')?.textContent==='Événements : 2');
 await page.waitForFunction(()=>document.getElementById('result')?.textContent?.includes('22 XP'));
 assert.equal(backend(pupil).total,22);
 await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='22 XP');
 // Reload: the AUTHORIZED student-load rehydrates native records before rendering.
 const fresh=await launch();
 await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='22 XP');
 const classic=await fresh.locator('body').evaluate(()=>JSON.parse(localStorage.getItem('addition2_classic_v1')||'{}'));
 assert.equal(classic.levels?.['1']?.['4'],4);
 const recovered=await fresh.locator('body').evaluate(()=>
   JSON.parse(localStorage.getItem('mathas_trophies_v3_addition-plusieurs')||'null'));
 assert.equal(recovered?.mastery?.[4]?.[0],true);
 assert.deepEqual(recovered,backend(pupil).state.rewards);

 // Reproduce real teacher reset after old device has local evidence that
 // the original engine could otherwise use to regenerate a withdrawn trophy.
 await fresh.locator('body').evaluate((_element,old)=>{
   localStorage.setItem('addition2_last_work',JSON.stringify({label:'Calculs · Niveau 1',score:'4/4'}));
   localStorage.setItem('mathas_points_v1_addition-plusieurs',JSON.stringify({version:1,bestOne:{points:900}}));
   localStorage.setItem('mathas_trophies_v2_addition-plusieurs',JSON.stringify(old));
 },nativeTrophies);
 const state=backend(pupil);
 state.revision++;state.resetEpoch=1;state.state=null; // fixture teacher restart
 const restarted=await launch();
 const resetProof=await restarted.locator('body').evaluate(()=>({
   oldWork:localStorage.getItem('addition2_last_work'),
   oldPoints:localStorage.getItem('mathas_points_v1_addition-plusieurs'),
   legacyTrophy:localStorage.getItem('mathas_trophies_v2_addition-plusieurs'),
   classic:JSON.parse(localStorage.getItem('addition2_classic_v1')||'{}'),
   trophy:JSON.parse(localStorage.getItem('mathas_trophies_v3_addition-plusieurs')||'null')
 }));
 assert.equal(resetProof.oldWork,null);
 assert.equal(resetProof.oldPoints,null);
 assert.equal(resetProof.legacyTrophy,null);
 assert.deepEqual(resetProof.classic,{levels:{}});
 assert.ok(resetProof.trophy==null||
   !resetProof.trophy.mastery?.[4]?.some(Boolean),'old trophy cannot reappear after teacher reset');
 await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='22 XP');
 assert.equal(calls.filter(c=>c.action==='game-record').length,2);
 assert.ok(!errors.length,'Browser JS errors: '+errors.join(' | '));

 // A revoked/unapproved profile must never silently fall back to an
 // unsaved game or leave a blank screen with an uncaught exception.
 profileApproved=false;
 const refused=await context.newPage(),refusedErrors=[];
 refused.on('pageerror',e=>refusedErrors.push(e.message));
 const previousRecords=calls.filter(c=>c.action==='game-record').length;
 await refused.goto(base+basePath+'?class='+classroom,{waitUntil:'domcontentloaded'});
 await refused.waitForFunction(()=>document.getElementById('result')?.textContent?.includes('Connexion Connect impossible ou non autorisée.'),null,{timeout:15000});
 assert.equal(await refused.locator('#mode-note').innerText(),
  'Connexion indisponible — aucun résultat enregistré');
 assert.equal(await refused.locator('iframe#game').evaluate(el=>Boolean(el.srcdoc)),false,
  'game must not start under an unapproved class profile');
 assert.equal(calls.filter(c=>c.action==='game-record').length,previousRecords);
 assert.deepEqual(refusedErrors,[],'auth denial must be reported in UI rather than crashing JS');
 await refused.close();
 console.log('PASS real Chromium: approved Supabase session, native event -> Edge HTTP -> server-authoritative 22 XP -> progress bar -> hydrated reload; repeat awards no extra XP');
}finally{await browser.close()}
