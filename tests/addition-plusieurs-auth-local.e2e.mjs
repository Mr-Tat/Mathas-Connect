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
checked(await admin.from('connect_students').insert({id:studentId,display_name:'Élève fictif'}),'student');
checked(await admin.from('connect_enrollments').insert({id:randomUUID(),class_id:classId,student_id:studentId}),'class');
checked(await admin.from('connect_devices').insert({id:randomUUID(),auth_user_id:student.user.id,student_id:studentId,state:'approved'}),'device');
checked(await admin.from('connect_teachers').insert({auth_user_id:teacher.user.id}),'teacher');
checked(await admin.from('connect_class_permissions').insert({class_id:classId,teacher_id:teacher.user.id,can_manage:true}),'teacher permission');
checked(await admin.from('connect_xp_credits').insert({student_id:studentId,app_key:oldApp,xp_credited:22}),'previous XP');
assert.equal(success(await post(student,'connect-api',{action:'student-me'}),'student identity').status,'approved');
const load=success(await post(student,'connect-results',{action:'student-load',appKey}),'first load');
assert.equal(load.revision,0);assert.equal(load.resetEpoch,0);
assert.equal((await post(outsider,'connect-results',{action:'student-load',appKey})).status,403);
const rewards={version:3,mastery:{4:[true,false,false],10:[false,false,false],20:[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
const event={action:'game-record',appKey,eventId,mode:'classic',level:1,score:4,total:4,
 points:0,expectedRevision:0,expectedResetEpoch:0,rewards};
const result=success(await post(student,'connect-results',event),'saved game');
assert.equal(result.revision,1);assert.equal(result.xp.delta,22);assert.equal(result.xp.total,44);
const duplicate=success(await post(student,'connect-results',event),'duplicate');
assert.equal(duplicate.duplicate,true);assert.equal(duplicate.xp.delta,0);
const state=success(await post(student,'connect-results',{action:'student-load',appKey}),'reload');
assert.equal(state.state.classic[0]['4'],4);
assert.equal(state.state.rewards.mastery['4'][0],true);
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
assert.equal(reset.resetEpoch,1);assert.deepEqual(reset.state,{});
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
checked(await admin.from('connect_classes').insert({
 id:classId,name:'Classe fictive addition',year_id:null
}),'browser professor class');
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
 // All three changes below are Playwright response overrides, NOT files
 // in the repository or Edge deployments. A future production URL cannot
 // accidentally receive our anonymous pupil's local request.
 await pupilContext.route('**/apps/addition-plusieurs/connect-pilot.mjs',async route=>{
  const res=await route.fetch(),original=await res.text();
  assert.equal(original.split('CONNECT_WRITE_READY=false').length,2);
  await route.fulfill({response:res,contentType:'text/javascript',
   body:original.replace('CONNECT_WRITE_READY=false','CONNECT_WRITE_READY=true')});
 });
 await pupilContext.route('**/apps/addition-plusieurs/edge-transport.mjs',async route=>{
  const res=await route.fetch(),original=await res.text();
  const lines=original.split('\n');
  const i=lines.findIndex(line=>line.includes("throw Error('invalid_transport')"));
  assert.ok(i>=0,'real Edge transport validation must exist');
  lines[i]=" if(endpoint!=="+JSON.stringify(url+'/functions/v1/connect-results')
   +"||typeof getToken!=='function'||typeof fetchImpl!=='function')throw Error('invalid_transport');";
  await route.fulfill({response:res,contentType:'text/javascript',body:lines.join('\n')});
 });
 await pupilContext.route('**/apps/addition-plusieurs/connect-host.mjs',async route=>{
  const res=await route.fetch(),original=await res.text();
  assert.ok(original.includes('https://awmhpfofacaglewammxt.supabase.co'));
  const parts=original.split('\n'),i=parts.findIndex(line=>line.includes("throw Error('untrusted_connect_endpoint')"));
  assert.ok(i>=0);
  parts[i]=" if(baseUrl!=="+JSON.stringify(url)+"||apikey!=="+JSON.stringify(anon)+")throw Error('untrusted_connect_endpoint');";
  let testVersion=parts.join('\n');
  testVersion=testVersion.replace(
   "export const CONNECT_URL='https://awmhpfofacaglewammxt.supabase.co';",
   'export const CONNECT_URL='+JSON.stringify(url)+';');
  testVersion=testVersion.replace(
   "export const CONNECT_PUBLISHABLE_KEY='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';",
   'export const CONNECT_PUBLISHABLE_KEY='+JSON.stringify(anon)+';');
  assert.ok(testVersion.includes('export const CONNECT_URL='+JSON.stringify(url)));
  assert.ok(testVersion.includes('export const CONNECT_PUBLISHABLE_KEY='+JSON.stringify(anon)));
  await route.fulfill({response:res,contentType:'text/javascript',body:testVersion});
 });
 const failedRequests=[];
 pupilPage.on('requestfailed',req=>failedRequests.push(req.url()+' '+(req.failure()?.errorText||'')));
 pupilPage.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push('console: '+message.text())});
 const openGame=async()=>{
  const response=await pupilPage.goto(site+'/apps/addition-plusieurs/?class='+classId,{waitUntil:'domcontentloaded'});
  try{
   await pupilPage.waitForFunction(()=>document.getElementById('game')?.contentWindow?.__mathasGameStorageScope?.startsWith('connect.'),null,{timeout:18000});
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
  return pupilPage.frameLocator('iframe#game');
 };
 // On a brand-new browser profile, Connect must refuse to start without
 // session. This also loads the real SDK, with empty browser storage.
 await pupilPage.goto(site+'/apps/addition-plusieurs/?class='+classId);
 await pupilPage.waitForFunction(()=>document.querySelector('#mode-note')?.textContent?.includes('Connexion indisponible'),null,{timeout:20000});
 assert.equal(await pupilPage.locator('iframe#game').evaluate(el=>Boolean(el.srcdoc)),false);
 // The fail-closed warning is expected while this profile is not signed in.
 // Count it as a successful denial rather than an unexpected JS error.
 assert.ok(errors.some(e=>e.includes('connect_session_missing')),
  'Missing browser session must be visibly and explicitly rejected');
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
 await pupilPage.waitForFunction(()=>document.querySelector('#xp-total')?.textContent==='22 XP',null,{timeout:15000});
 await playFourAdditions({frame,page:pupilPage});
 await pupilPage.waitForFunction(()=>document.querySelector('#xp-total')?.textContent==='44 XP',null,{timeout:30000});
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
 await pupilPage.waitForFunction(()=>document.querySelector('#xp-total')?.textContent==='44 XP',null,{timeout:15000});
 const native=await reloaded.locator('body').evaluate(()=>({
  classic:JSON.parse(localStorage.getItem('addition2_classic_v1')||'{}'),
  trophy:JSON.parse(localStorage.getItem('mathas_trophies_v3_addition-plusieurs')||'null')
 }));
 assert.equal(native.classic.levels['1']['4'],4);
 assert.equal(native.trophy.mastery['4'][0],true);

 // Real teacher portal, actual professor JWT, real Edge teacher-dashboard,
 // teacher-overview, history, and reset via visible confirmation controls.
 const teacherContext=await browser.newContext();
 await provideRealSdk(teacherContext);
 await teacherContext.route(urlToMatch=>urlToMatch.pathname==='/app.js',async route=>{
  const res=await route.fetch(),original=await res.text();
  const config="const url='https://awmhpfofacaglewammxt.supabase.co', key='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';";
  assert.ok(original.includes(config));
  assert.ok(original.includes('const ADD_MULTI_TEACHER_READY=false;'));
  const testVersion=original.replace(config,'const url='+JSON.stringify(url)+', key='+JSON.stringify(anon)+';')
   .replace('const ADD_MULTI_TEACHER_READY=false;','const ADD_MULTI_TEACHER_READY=true;');
  await route.fulfill({response:res,contentType:'text/javascript',body:testVersion});
 });
 const professor=await teacherContext.newPage();
 professor.on('pageerror',e=>errors.push('teacher: '+e.message));
 await professor.goto(site+'/?portail=prof&profClass='+classId,{waitUntil:'domcontentloaded'});
 await professor.locator('#login-form:visible').waitFor({timeout:20000});
 await professor.locator('#email').fill(teacherEmail);
 await professor.locator('#password').fill(teacherPassword);
 await professor.locator('#login-form button[type=submit]').click();
 await professor.locator('.results-overview-table').waitFor({timeout:30000});
 const savedTeacherAuth=await professor.evaluate(
  ()=>Boolean(localStorage.getItem('mathas-connect-professor-auth-v1')));
 assert.equal(savedTeacherAuth,true,'professor native SDK must persist separate session');
 await professor.reload({waitUntil:'domcontentloaded'});
 await professor.locator('.results-overview-table').waitFor({timeout:30000});
 const open=professor.getByRole('button',{
  name:'Voir les résultats de Élève Chromium dans Addition de plusieurs nombres'
 });
 await open.click();
 const rows=await professor.locator('#results-student-content .result-table tr').allTextContents();
 assert.match(rows.join(' | '),/4\/4/,'real professor DOM must show actual PostgreSQL result');
 await professor.locator('#results-student-content .results-restart-button').click();
 const dialog=professor.locator('dialog.parcours-dialog');
 await dialog.waitFor();
 await dialog.locator('input[type=checkbox]').uncheck();
 await dialog.locator('input[required]').fill('Élève Chromium');
 await dialog.getByRole('button',{name:'Confirmer le nouveau parcours'}).click();
 await dialog.waitFor({state:'detached',timeout:15000});
 const afterReset=await openGame();
 await pupilPage.waitForFunction(()=>document.querySelector('#xp-total')?.textContent==='44 XP',null,{timeout:15000});
 const cleared=await afterReset.locator('body').evaluate(()=>({
  classic:JSON.parse(localStorage.getItem('addition2_classic_v1')||'{}'),
  trophy:JSON.parse(localStorage.getItem('mathas_trophies_v3_addition-plusieurs')||'null')
 }));
 assert.deepEqual(cleared.classic,{levels:{}});
 assert.ok(cleared.trophy==null||!cleared.trophy.mastery?.['4']?.some(Boolean));
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
