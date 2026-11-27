import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

// A genuine LOCAL GoTrue session, Edge handler, PostgREST and PostgreSQL.
// Never connect to a hosted Supabase project or any real pupil.
const url=process.env.API_URL,anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY;
assert.ok(url?.startsWith('http://127.0.0.1:')&&anon&&service,'LOCAL loopback required');
const client=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=client(service),studentAuth=client(anon),outsiderAuth=client(anon),teacherAuth=client(anon);
const classId=randomUUID(),studentId=randomUUID(),eventId=randomUUID();
const appKey='addition-ecrite-multiple',oldApp='addition-ecrite-simple';
function checked(res,where){if(res.error)throw Error(where+': '+res.error.message);return res.data;}
async function post(session,endpoint,payload){
 const res=await fetch(url+'/functions/v1/'+endpoint,{method:'POST',
 headers:{apikey:anon,authorization:'Bearer '+session.access_token,'content-type':'application/json'},
 body:JSON.stringify({classId,...payload})});
 const data=await res.json();
 return {status:res.status,data};
}
function success(res,where){
 assert.equal(res.status,200,where+': '+JSON.stringify(res.data));
 assert.equal(res.data.ok,true,where+': '+JSON.stringify(res.data));
 return res.data;
}
const student=checked(await studentAuth.auth.signInAnonymously(),'student signup').session;
const outsider=checked(await outsiderAuth.auth.signInAnonymously(),'outsider signup').session;
const teacherEmail='local-'+randomUUID()+'@example.test',teacherPassword='LocalTest!SecurePass123';
const teacher=checked(await teacherAuth.auth.signUp({
 email:teacherEmail,password:teacherPassword
}),'teacher signup').session;
assert.ok(student?.user?.is_anonymous&&outsider?.access_token&&teacher?.access_token&&!teacher.user.is_anonymous);
checked(await admin.from('connect_classes').insert({id:classId,name:'Classe fictive addition',year_id:null}),'actual local class');
checked(await admin.from('connect_students').insert({id:studentId,display_name:'Élève fictif'}),'student');
checked(await admin.from('connect_enrollments').insert({id:randomUUID(),class_id:classId,student_id:studentId}),'class');
checked(await admin.from('connect_devices').insert({id:randomUUID(),auth_user_id:student.user.id,student_id:studentId,state:'approved'}),'device');
checked(await admin.from('connect_teachers').insert({auth_user_id:teacher.user.id}),'teacher');
checked(await admin.from('connect_class_permissions').insert({class_id:classId,teacher_id:teacher.user.id,can_manage:true}),'teacher permission');
checked(await admin.from('connect_xp_credits').insert({student_id:studentId,app_key:oldApp,xp_credited:22}),'previous XP');
assert.equal(success(await post(student,'connect-api',{action:'student-me'}),'student identity').status,'approved');
// Same approved anonymous identity, two active classes, no second account.
const otherClass=randomUUID(),foreignClass=randomUUID();
checked(await admin.from('connect_classes').insert({id:otherClass,name:'Seconde classe fictive',year_id:null}),'actual second class');
checked(await admin.from('connect_enrollments').insert({id:randomUUID(),class_id:otherClass,student_id:studentId}),'second membership');
for(const selectedClass of [classId,otherClass]){
 const choice=success(await post(student,'connect-api',{action:'student-join-status',classId:selectedClass}),'approved shortcut');
 assert.equal(choice.request.state,'already_approved');
 assert.equal(choice.request.classId,selectedClass,'respect the shortcut despite two active memberships');
 const identity=success(await post(student,'connect-api',{action:'student-me',classId:selectedClass,includeXp:true}),'shared profile');
 assert.equal(identity.status,'approved');assert.equal(identity.classId,selectedClass);
 const shared=success(await post(student,'connect-results',{action:'student-load',appKey,classId:selectedClass}),'shared app account');
 assert.equal(shared.storageSubject,studentId,'both classes resolve to the identical student');
}
const rejected=success(await post(student,'connect-api',{action:'student-me',classId:foreignClass}),'unregistered class');
assert.equal(rejected.status,'wrong_class');
const fallback=success(await post(student,'connect-api',{action:'student-join-status',classId:foreignClass}),'fallback account');
assert.equal(fallback.request.classId,classId,'unauthorized shortcut falls back to first enrolled class');
checked(await admin.from('connect_enrollments').delete().eq('student_id',studentId).eq('class_id',otherClass),'remove test membership');
console.log('PASS actual local Auth: one approved device and account in two classes, requested shortcut, outsiders rejected');
const load=success(await post(student,'connect-results',{action:'student-load',appKey}),'first load');
assert.equal(load.revision,0);assert.equal(load.resetEpoch,0);
assert.equal((await post(outsider,'connect-results',{action:'student-load',appKey})).status,403);
const rewards={version:3,mastery:{4:[true,false,false],10:[false,false,false],20:[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
const event={action:'game-record',appKey,eventId,mode:'classic',level:1,score:4,total:4,
 points:0,expectedRevision:0,expectedResetEpoch:0,rewards};
const rejectedEvent=await post(student,'connect-results',event);
assert.equal(rejectedEvent.status,403);assert.equal(rejectedEvent.data.error,'server_proof_required');
const proof=success(await post(student,'connect-objective-record-school',{action:'start-proof-multi-v1',appKey,level:1,total:4}),'issued proof');
assert.equal(proof.questions.length,4);
assert.equal((await post(outsider,'connect-objective-record-school',{action:'start-proof-multi-v1',appKey,level:1,total:4})).status,403);
assert.equal((await post(student,'connect-objective-record-school',{action:'start-proof-multi-v1',appKey,level:1,total:4,classId:foreignClass})).status,403);
const answers=proof.questions.map(q=>({id:q.id,digits:String(q.addends.reduce((sum,n)=>sum+n,0)).split('').reverse(),carries:['',...Array.from({length:4},(_,i)=>{const p=10**(i+1);const n=Math.floor(q.addends.reduce((sum,v)=>sum+v%p,0)/p);return n?String(n):''})]}));
const finish={action:'finish-proof-multi-v1',appKey,sessionId:proof.sessionId,answers};
const result=success(await post(student,'connect-objective-record-school',finish),'saved certified game');
assert.equal(result.proofVerified,true);assert.equal(result.verifiedScore,4);
assert.equal(result.revision,1);assert.equal(result.xp.delta,22);assert.equal(result.xp.total,44);
const duplicate=success(await post(student,'connect-objective-record-school',finish),'duplicate certified proof');
assert.equal(duplicate.duplicate,true);assert.equal(duplicate.xp.delta,0);
const state=success(await post(student,'connect-results',{action:'student-load',appKey}),'reload');
assert.equal(state.state.classic[0]['4'],4);
assert.equal(state.state.rewards.mastery['4'][0],true);
const history=success(await post(student,'connect-projection-v2',{action:'student-score-history',appKey}),'private certified score history');
assert.equal(history.todayBest.eventId,proof.sessionId);
assert.equal(history.boardTodayBest,0,'no implicit consent');
assert.ok(history.todayBest.points>0);
const share=success(await post(student,'connect-projection-v2',{action:'student-share-score',appKey,eventId:proof.sessionId}),'explicit consent');
assert.equal(share.consentRecorded,true);
assert.equal((await post(student,'connect-projection-v2',{action:'student-share-score',appKey,eventId:proof.sessionId})).status,409);
const published=success(await post(student,'connect-projection-v2',{action:'student-score-history',appKey}),'published history');
assert.equal(published.boardTodayBest,history.todayBest.points);
assert.equal((await post(outsider,'connect-projection-v2',{action:'student-score-history',appKey})).status,403);
const overview=success(await post(teacher,'connect-results',{action:'teacher-overview'}),'professor overview');
const profApp=overview.students.find(x=>x.id===studentId)?.apps.find(x=>x.appKey===appKey);
assert.equal(profApp?.state?.classic[0]['4'],4);
const detail=success(await post(teacher,'connect-results',{action:'teacher-detail',appKey,studentId}),'professor detail');
assert.equal(detail.state.rewards.mastery['4'][0],true);
const restart=success(await post(teacher,'connect-results',{
 action:'teacher-parcours-restart',appKey,studentId,scope:'student',repeatXp:false
}),'professor restart');
assert.equal(restart.parcours,2);
const reset=success(await post(student,'connect-results',{action:'student-load',appKey}),'after reset');
assert.equal(reset.resetEpoch,1);
assert.deepEqual(reset.state.rewards,rewards,'acquis permanents conservés au redémarrage');
assert.equal(reset.state.classic,undefined,'les scores repartent effectivement de zéro');
const profileAfterReset=success(await post(student,'connect-api',{action:'student-me',includeXp:true}),'profil avec trophées');
assert.equal(profileAfterReset.progress.totalTrophies,1,'le trophée reste unique');
const appProgress=profileAfterReset.progress.apps.find(a=>a.appKey===appKey);
assert.equal(appProgress.xpEarned,0,'XP de ce parcours remis à zéro');
assert.equal(appProgress.trophiesEarned,1,'trophée conservé dans cette app');
const xp=success(await post(student,'connect-results',{action:'student-xp',appKey}),'XP after reset');
assert.equal(xp.appXp,22);assert.equal(xp.total,44);
const previous=checked(await admin.from('connect_xp_credits').select('xp_credited')
 .eq('student_id',studentId).eq('app_key',oldApp).single(),'historical XP');
assert.equal(previous.xp_credited,22);
console.log('PASS genuine LOCAL Supabase Auth+Edge+PostgreSQL: 4/4, 22 XP, trophy, professor, reset, 44 global XP, outsider denied');


// Joined end-to-end recipe: real rendered V6 arithmetic + real local Auth,
// real Edge HTTP and PostgreSQL, and the real professor screen. The browser
// signs in through the real Supabase browser SDK and stores its own session.
// We do not fake, intercept or replace ANY request/response to Edge/Auth.
const {chromium}=await import('playwright');
const {readFileSync}=await import('node:fs');
const {playFourAdditions}=await import('./addition-plusieurs-real-play-helper.mjs');
const browserStudentId=randomUUID();
// The learner account MUST originate inside Chromium's real supabase-js SDK.
// Do not pre-create a browser JWT from Node or inject an auth session.
const site='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
const errors=[];
const SDK_URL='https://esm.sh/@supabase/supabase-js@2.95.0';
// This is the actual bundled @supabase/supabase-js@2.95.0 browser module.
// Only the CDN URL is redirected to LOCAL compiled package bytes, not mocked.
const realSdk=readFileSync(new URL('./sdk-browser.mjs',import.meta.url),'utf8');
assert.ok(realSdk.length>10000 && realSdk.includes('createClient'),
 'Real Supabase browser build is missing');
async function provideRealSdk(context){
 await context.route(SDK_URL,route=>route.fulfill({
  status:200,contentType:'text/javascript',
  headers:{'access-control-allow-origin':'*'},
  body:realSdk
 }));
}
try{
 const pupilContext=await browser.newContext();
 const pupilPage=await pupilContext.newPage();
 pupilPage.on('pageerror',e=>errors.push('pupil: '+e.message));
 await provideRealSdk(pupilContext);
 // Only change the candidate's HTTP destination and public local key.
 // Fail closed for ANY hosted Supabase URL, even if another module is added.
 await pupilContext.route('**/*.supabase.co/**',route=>route.abort());
 await pupilContext.route(u=>u.pathname.endsWith('/apps/objective-record/eleve.mjs'),async route=>{
  const res=await route.fetch(),original=await res.text();
  const base="const BASE='https://awmhpfofacaglewammxt.supabase.co';",key="const KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';";
  assert.ok(original.includes(base)&&original.includes(key));
  await route.fulfill({response:res,contentType:'text/javascript',body:original.replace(base,'const BASE='+JSON.stringify(url)+';').replace(key,'const KEY='+JSON.stringify(anon)+';')});
 });
 const gameUrl=site+'/apps/objective-record/eleve.html?app=addition-multiple&requireConnect=1&class='+classId;
 const failedRequests=[],httpErrors=[];
 pupilPage.on('response',res=>{if(res.status()>=400)httpErrors.push(res.status()+' '+res.url())});
 pupilPage.on('requestfailed',req=>failedRequests.push(req.url()+' '+(req.failure()?.errorText||'')));
 pupilPage.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push('console: '+message.text())});
 const openGame=async()=>{
  const response=await pupilPage.goto(gameUrl,{waitUntil:'domcontentloaded'});
  try{
   await pupilPage.frameLocator('#gameFrame').frameLocator('#game').locator('#menuScreen:not(.hidden) .classic-count-btn[data-count="4"]').waitFor({timeout:25000});
   await pupilPage.waitForFunction(()=>document.getElementById('app-xp')?.textContent!=='—',null,{timeout:15000});
  }catch(error){
   const info=await pupilPage.evaluate(()=>({
    url:location.href,title:document.title,
    result:document.getElementById('result')?.textContent,
    notice:document.getElementById('mode-note')?.textContent,
    iframe:document.getElementById('game')?.getAttribute('srcdoc')?.length||0,
    body:document.body?.textContent?.slice(0,500)
   })).catch(e=>({evaluationError:String(e)}));
   console.error('BROWSER START DIAGNOSTIC',JSON.stringify({
    status:response?.status(),info,errors,failedRequests
   }));
   throw error;
  }
  return pupilPage.frameLocator('#gameFrame').frameLocator('#game');
 };
 // On a brand-new browser profile, Connect must refuse to start without
 // session. This also loads the real SDK, with empty browser storage.
 await pupilPage.goto(gameUrl);
 await pupilPage.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Jeu non lancé'),null,{timeout:20000});
 assert.equal(await pupilPage.locator('#gameFrame').getAttribute('hidden'),'');
 errors.splice(0);
 // Change document before creating the SDK used for login: the previous
 // fail-closed game client must not overlap this dedicated auth client.
 await pupilPage.goto(site+'/tests/.addition-multiple-auth-only.html');
 const signed=await pupilPage.evaluate(async({endpoint,key,sdkUrl})=>{
   const {createClient}=await import(sdkUrl);
   const sb=createClient(endpoint,key,{auth:{
     persistSession:true,autoRefreshToken:true,detectSessionInUrl:false
   }});
   const {data,error}=await sb.auth.signInAnonymously();
   if(error)throw Error('native_anonymous_signin_failed:'+error.message);
   const session=(await sb.auth.getSession()).data.session;
   if(!session?.user?.is_anonymous||!session?.access_token)
     throw Error('native_session_missing');
   return {id:session.user.id,stored:Object.keys(localStorage).some(k=>k.includes('auth-token'))};
 },{endpoint:url,key:anon,sdkUrl:SDK_URL});
 assert.equal(signed.stored,true,'native browser SDK must persist the session');
 checked(await admin.from('connect_students').insert({
  id:browserStudentId,display_name:'Élève Chromium'
 }),'browser pupil');
 checked(await admin.from('connect_enrollments').insert({
  id:randomUUID(),class_id:classId,student_id:browserStudentId
 }),'browser pupil enrollment');
 checked(await admin.from('connect_devices').insert({
  id:randomUUID(),student_id:browserStudentId,auth_user_id:signed.id,state:'approved'
 }),'browser approved device');
 checked(await admin.from('connect_xp_credits').insert({
  student_id:browserStudentId,app_key:oldApp,xp_credited:22
 }),'browser historical XP');
 const frame=await openGame();
 await pupilPage.waitForFunction(()=>document.querySelector('#connect-xp-meter')?.title?.includes('22 XP au total'),null,{timeout:15000});
 // Real Chromium offline mode, not a fake Edge response. Four actual
 // written calculations must persist as ONE unsent local queue entry.
 await playFourAdditions({frame,page:pupilPage,afterStart:async()=>{
  await pupilContext.setOffline(true);
  assert.equal(await pupilPage.evaluate(()=>navigator.onLine),false,'Chromium is truly offline');
 }});
 const durableQueueKey='mathas.multiple-certified.v1.'+classId+'.'+browserStudentId;
 await pupilPage.waitForFunction(key=>JSON.parse(localStorage.getItem(key)||'null')?.answers?.length===4,durableQueueKey,{timeout:15000});
 const queuedBefore=await pupilPage.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),durableQueueKey);
 assert.equal(queuedBefore.total,4);
 assert.equal(queuedBefore.answers.length,4);
 assert.ok(queuedBefore.sessionId);
 assert.equal(Object.hasOwn(queuedBefore,'score'),false,'offline transcript cannot author its score');
 const beforeRecovery=checked(await admin.from('connect_states')
  .select('student_id').eq('student_id',browserStudentId).eq('app_key',appKey),
  'offline database unchanged');
 assert.equal(beforeRecovery.length,0,'no result credited before reconnect');
 assert.match(await pupilPage.locator('#connect-xp-meter').getAttribute('title'),/22 XP au total/,
  'XP must not be granted optimistically when offline');
 // Restore Wi-Fi without reloading. The genuine online event must cause
 // exactly one retry; no polling, no second completion and no pupil action.
 await pupilContext.setOffline(false);
 assert.equal(await pupilPage.evaluate(()=>navigator.onLine),true,'Chromium is back online');
 await pupilPage.waitForFunction(()=>document.querySelector('#connect-xp-meter')?.title?.includes('44 XP au total'),null,{timeout:30000});
 const queuedAfter=await pupilPage.evaluate(key=>localStorage.getItem(key),durableQueueKey);
 assert.equal(queuedAfter,null,'server acknowledgment must clear the durable queue');
 // The only acceptable browser console error during intentional Wi-Fi loss
 // is Chromium's own ERR_INTERNET_DISCONNECTED for the failed HTTP request.
 // Do not ignore JavaScript errors, auth problems or other failed resources.
 const offlineConsole=errors.splice(0);
 assert.deepEqual(offlineConsole.filter(message=>
  message!=='console: Failed to load resource: net::ERR_INTERNET_DISCONNECTED'),
  [],'only the intentional Chromium network-disconnection error may occur; HTTP: '+JSON.stringify(httpErrors));
 const stored=checked(await admin.from('connect_states')
  .select('revision,reset_epoch,state_data').eq('student_id',browserStudentId)
  .eq('app_key',appKey).single(),'browser actual PostgreSQL save');
 assert.equal(stored.revision,1,'native engine must send exactly one valid completion');
 assert.equal(stored.state_data.classic[0]['4'],4);
 assert.equal(stored.state_data.rewards.mastery['4'][0],true);
 const browserXp=checked(await admin.from('connect_xp_credits').select('xp_credited')
  .eq('student_id',browserStudentId).eq('app_key',appKey).single(),'browser real XP');
 assert.equal(browserXp.xp_credited,22);
 // The real SDK must refresh a token in-browser, persist it and then rehydrate
 // it after a full page reload without a shim or auth-specific test injection.
 // Close the active game document before refreshing through the native SDK.
 // This avoids two GoTrueClient instances sharing one storage key at once.
 await pupilPage.goto(site+'/tests/.addition-multiple-auth-only.html');
 const refreshed=await pupilPage.evaluate(async({endpoint,key,sdkUrl})=>{
  const {createClient}=await import(sdkUrl);
  const sb=createClient(endpoint,key,{auth:{
   persistSession:true,autoRefreshToken:true,detectSessionInUrl:false
  }});
  const {data,error}=await sb.auth.refreshSession();
  if(error)throw Error('native_refresh_failed:'+error.message);
  const current=(await sb.auth.getSession()).data.session;
  return {id:current?.user?.id,hasRefreshToken:Boolean(data?.session?.refresh_token)};
 },{endpoint:url,key:anon,sdkUrl:SDK_URL});
 assert.equal(refreshed.id,signed.id,'browser refresh must preserve student identity');
 assert.equal(refreshed.hasRefreshToken,true,'native refresh token expected');
 const reloaded=await openGame();
 await pupilPage.waitForFunction(()=>document.querySelector('#connect-xp-meter')?.title?.includes('44 XP au total'),null,{timeout:15000});
 const native=await pupilPage.evaluate(()=>({progress:window.MathasConnectOfficialSchoolProgress,trophy:window.MathasConnectOfficialTrophies}));
 assert.ok(native.progress,'official progression restored after reload');
 assert.equal(native.trophy?.rewards?.mastery?.['4']?.[0],true);
 const persisted=success(await post(student,'connect-results',{action:'student-load',appKey}),'independent API remains available');
 assert.equal(persisted.resetEpoch,1);


 // Real teacher portal, actual professor JWT, real Edge teacher-dashboard,
 // teacher-overview, history, and reset via visible confirmation controls.
 const teacherContext=await browser.newContext();
 await provideRealSdk(teacherContext);
 await teacherContext.route('**/*.supabase.co/**',route=>route.abort());
 await teacherContext.route(urlToMatch=>urlToMatch.pathname==='/app.js',async route=>{
  const res=await route.fetch(),original=await res.text();
  const config="const url='https://awmhpfofacaglewammxt.supabase.co', key='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';";
  assert.ok(original.includes(config));
  assert.ok(original.includes('const ADD_MULTI_TEACHER_READY=true;'));
  const testVersion=original.replace(config,'const url='+JSON.stringify(url)+', key='+JSON.stringify(anon)+';')
   .replace('const ADD_MULTI_TEACHER_READY=true;','const ADD_MULTI_TEACHER_READY=true;');
  await route.fulfill({response:res,contentType:'text/javascript',body:testVersion});
 });
 const professor=await teacherContext.newPage();
 professor.on('pageerror',e=>errors.push('teacher: '+e.message));
 await professor.goto(site+'/?portail=prof&profClass='+classId,{waitUntil:'domcontentloaded'});
 await professor.locator('#login-form:visible').waitFor({timeout:20000});
 await professor.locator('#email').fill(teacherEmail);
 await professor.locator('#password').fill(teacherPassword);
 await professor.locator('#login-form button[type=submit]').click();
 await professor.locator('table.results-overview-table:not(.results-overview-floating-table)').waitFor({timeout:30000});
 const savedTeacherAuth=await professor.evaluate(
  ()=>Boolean(localStorage.getItem('mathas-connect-professor-auth-v1')));
 assert.equal(savedTeacherAuth,true,'professor native SDK must persist separate session');
 await professor.reload({waitUntil:'domcontentloaded'});
 await professor.locator('table.results-overview-table:not(.results-overview-floating-table)').waitFor({timeout:30000});
 const open=professor.getByRole('button',{
  name:'Voir les résultats de Élève Chromium dans Addition de plusieurs nombres'
 });
 await open.click();
 const rows=await professor.locator('#results-student-content .result-table tr').allTextContents();
 assert.match(rows.join(' | '),/4\/4/,'real professor DOM must show actual PostgreSQL result');
 await professor.locator('#results-student-content .results-restart-button').click();
 // The live professor UI deliberately routes sensitive resets through
 // Authorisations; never bypass that step or invoke the dialog directly.
 await professor.locator('#teacher-authorizations:visible').waitFor();
 const roster=success(await post(teacher,'connect-api',{action:'teacher-dashboard'}),'real class roster for authorizations');
  assert.ok(roster.students.some(s=>s.id===browserStudentId),'browser pupil is in the authorized class roster');
  await professor.locator('#auth-restart:enabled').waitFor({timeout:20000}).catch(async error=>{throw Error('Authorization reset unavailable: '+JSON.stringify(await professor.evaluate(()=>({feedback:document.getElementById('auth-feedback')?.textContent,classId:document.getElementById('auth-class')?.value,studentId:document.getElementById('auth-student')?.value,scope:document.getElementById('auth-scope')?.value}))),{cause:error})});
 assert.equal(await professor.locator('#auth-app').inputValue(),appKey);
 assert.equal(await professor.locator('#auth-scope').inputValue(),'student');
 assert.equal(await professor.locator('#auth-student').inputValue(),browserStudentId);
 await professor.locator('#auth-restart').click();
 const dialog=professor.locator('dialog.parcours-dialog');
 await dialog.waitFor();
 await dialog.locator('input[type=checkbox]').uncheck();
 await dialog.locator('input[required]').fill('Élève Chromium');
 await dialog.getByRole('button',{name:'Confirmer le nouveau parcours'}).click();
 await dialog.waitFor({state:'detached',timeout:15000});
 const afterReset=await openGame();
 await pupilPage.waitForFunction(()=>document.querySelector('#connect-xp-meter')?.title?.includes('44 XP au total'),null,{timeout:15000});
 const cleared=await pupilPage.evaluate(()=>({progress:window.MathasConnectOfficialSchoolProgress,trophy:window.MathasConnectOfficialTrophies}));
 assert.ok(cleared.progress);
 assert.equal(cleared.trophy?.rewards?.mastery?.['4']?.[0],true,'official trophy stays after reset');
 const savedAfterReset=checked(await admin.from('connect_states').select('reset_epoch,state_data')
  .eq('student_id',browserStudentId).eq('app_key',appKey).single(),'browser reset on DB');
 assert.equal(savedAfterReset.reset_epoch,1);
 assert.deepEqual(savedAfterReset.state_data,{});
 const afterXp=checked(await admin.from('connect_xp_credits').select('xp_credited')
  .eq('student_id',browserStudentId).eq('app_key',appKey).single(),'real XP after teacher reset');
 assert.equal(afterXp.xp_credited,22);
 assert.deepEqual(errors,[],'Browser JavaScript errors');
 await teacherContext.close();
 await pupilContext.close();
 console.log('PASS NATIVE browser supabase-js: anonymous sign-in + persistent localStorage + refresh + reload + 4 real additions -> Edge PostgreSQL +22 XP/trophy -> actual professor password login + persisted session + reset -> XP kept');
}finally{
 await browser.close();
}
