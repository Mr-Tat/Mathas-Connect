// Real GoTrue JWT + real Edge Runtime + PostgREST + PostgreSQL, synthetic data only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const {createClient}=await import(process.env.SUPABASE_SDK_MODULE||'@supabase/supabase-js');
const url=process.env.API_URL,anon=process.env.ANON_KEY,service=process.env.SERVICE_ROLE_KEY;
assert.match(url||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(anon&&service);
const client=key=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),admin=client(service),pupil=client(anon),outsider=client(anon),teacher=client(anon);
const check=(r,msg)=>{if(r.error)throw Error(msg+': '+r.error.message);return r.data};
const classId=process.env.MATHAS_MIXED_PILOT_CLASS_ID,studentId=randomUUID(),teacherStudent=randomUUID();
assert.match(classId||'',/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const student=check(await pupil.auth.signInAnonymously(),'pupil auth').session;
const other=check(await outsider.auth.signInAnonymously(),'outsider auth').session;
const teacherEmail='local-'+randomUUID()+'@example.test',teacherPassword='LocalOnly!'+randomUUID();
const prof=check(await teacher.auth.signUp({email:teacherEmail,password:teacherPassword}),'teacher auth').session;
assert.ok(student.user.is_anonymous&&!prof.user.is_anonymous);
check(await admin.from('connect_students').insert([{id:studentId,display_name:'Fictif Mélange'},{id:teacherStudent,display_name:'Monsieur T'}]),'profiles');
check(await admin.from('connect_classes').insert({id:classId,name:'Classe fictive Mélange'}),'class');
check(await admin.from('connect_enrollments').insert({id:randomUUID(),class_id:classId,student_id:studentId}),'membership');
check(await admin.from('connect_devices').insert({id:randomUUID(),auth_user_id:student.user.id,student_id:studentId,state:'approved'}),'approval');
check(await admin.from('connect_teachers').insert({auth_user_id:prof.user.id}),'teacher');
check(await admin.from('connect_teacher_players').insert({teacher_id:prof.user.id,student_id:teacherStudent}),'teacher player');
check(await admin.from('connect_class_permissions').insert({class_id:classId,teacher_id:prof.user.id,can_manage:true}),'permission');
check(await admin.from('connect_xp_credits').insert({student_id:studentId,app_key:'addition-ecrite-simple',xp_credited:22}),'old XP');
async function post(session,body={},endpoint='connect-results'){
 const response=await fetch(url+'/functions/v1/'+endpoint,{method:'POST',headers:{apikey:anon,...(session?{authorization:'Bearer '+session.access_token}:{}),'content-type':'application/json'},body:JSON.stringify({classId,appKey:'melange-calculs-ecrits',expectedStudentId:session?.user?.id===prof.user.id?teacherStudent:studentId,...body})});
 return {status:response.status,body:await response.json()};
}
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.ok,true);return r.body};
check(await admin.from('connect_apps').update({enabled:false}).eq('app_key','melange-calculs-ecrits'),'LOCAL reset catalogue fixture');
assert.equal((await post(null,{action:'student-load'})).status,401);
assert.equal((await post(student,{action:'student-load'})).body.error,'app_disabled');
check(await admin.from('connect_apps').update({enabled:true}).eq('app_key','melange-calculs-ecrits'),'LOCAL enable only');
assert.equal((await post(other,{action:'student-load'})).status,403);
const outsidePilot=await post(student,{action:'student-load',classId:randomUUID()});
assert.equal(outsidePilot.status,403);assert.equal(outsidePilot.body.error,'integration_not_open_for_class');
assert.equal(ok(await post(student,{action:'student-me'},'connect-api')).status,'approved');
assert.equal(ok(await post(prof,{action:'teacher-player'},'connect-api')).status,'approved');
const event={action:'game-record',schemaVersion:1,eventId:randomUUID(),mode:'classic',level:1,score:4,total:4,points:0,expectedRevision:0,expectedResetEpoch:0,
 operationsSelectedAtStart:['add','sub','mul'],operationsCompleted:['add','sub','mul','add'],firstTry:[true,true,true,true],aidUsed:false,masterMode:false};
const result=ok(await post(student,event));assert.equal(result.xp.delta,28);assert.equal(result.xp.total,50);
const duplicate=ok(await post(student,event));assert.equal(duplicate.duplicate,true);assert.equal(duplicate.xp.delta,0);
const loaded=ok(await post(student,{action:'student-load'}));assert.equal(loaded.state.classic[0][4],4);assert.equal(loaded.state.eligible.classic[0][4],4);
const matrix=ok(await post(prof,{action:'teacher-app-matrix-get'}));assert.equal(matrix.entries.filter(x=>x.app_key==='melange-calculs-ecrits').length,4);assert.ok(matrix.entries.filter(x=>x.app_key==='melange-calculs-ecrits').every(x=>!x.visible));
const detail=ok(await post(prof,{action:'teacher-detail',studentId}));assert.equal(detail.state.classic[0][4],4);assert.equal(detail.xp.appXp,28);
assert.equal((await post(student,{action:'teacher-parcours-restart',scope:'class',repeatXp:false})).status,403);
const reset=ok(await post(prof,{action:'teacher-parcours-restart',scope:'student',studentId,repeatXp:false}));assert.equal(reset.parcours,2);
assert.equal((await post(student,event)).body.error,'stale_reset_epoch');
const replay=ok(await post(student,{...event,eventId:randomUUID(),expectedRevision:2,expectedResetEpoch:1}));assert.equal(replay.xp.delta,0);assert.equal(replay.xp.total,50);
const forbidden=await pupil.rpc('connect_mixed_xp_sync_v1',{p_student:studentId,p_app:'melange-calculs-ecrits',p_force:false});assert.ok(forbidden.error,'no authenticated direct RPC');
const old=check(await admin.from('connect_xp_credits').select('xp_credited').eq('student_id',studentId).eq('app_key','addition-ecrite-simple').single(),'old XP retained');assert.equal(old.xp_credited,22);
console.log('PASS real local Auth+Edge+SQL: isolated pilot class, 401/403, approved pupil, teacher player, 28 XP ACK, duplicate0, professor results, reset epoch, no recollection, other game intact');
if(process.env.SDK_BROWSER_PATH){
 const {readFileSync}=await import('node:fs'),{chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
 const {playMixedClassic}=await import('./calculs-melanges-real-play-helper.mjs');
 const sdk=readFileSync(process.env.SDK_BROWSER_PATH,'utf8'),site=process.env.MATHAS_TEST_SITE||'http://127.0.0.1:8765',SDK_URL='https://esm.sh/@supabase/supabase-js@2.95.0';
 assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const errors=[];
 async function setup(context){
  // Chromium's local-network permission is scoped to this disposable loopback origin.
  await context.grantPermissions(['local-network-access'],{origin:site});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if([new URL(site).origin,new URL(url).origin].includes(u.origin))return route.continue();
   throw Error('No external request allowed in local auth recipe: '+u.origin);
  });
  await context.route(SDK_URL,route=>route.fulfill({status:200,contentType:'text/javascript',body:sdk}));
  await context.route('**/tests/.mixed-auth-only.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Local Auth only</title>'}));
 }
 try{
  const context=await browser.newContext();await setup(context);
  await context.addInitScript(()=>{let seed=5168789;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}});
  async function configureGame(context){
  await context.route('**/apps/calculs-melanges/connect-pilot.mjs',async route=>{const response=await route.fetch();const original=await response.text();assert.ok(original.includes('CONNECT_WRITE_READY=false;'));await route.fulfill({response,contentType:'text/javascript',body:original.replace('CONNECT_WRITE_READY=false;','CONNECT_WRITE_READY=true;')})});
  await context.route('**/apps/calculs-melanges/connect-host.mjs',async route=>{
   const response=await route.fetch(),lines=(await response.text()).split('\n');const i=lines.findIndex(x=>x.includes("throw Error('untrusted_connect_endpoint')"));assert.ok(i>=0);
   lines[i]=' if(baseUrl!=='+JSON.stringify(url)+'||apikey!=='+JSON.stringify(anon)+")throw Error('untrusted_connect_endpoint');";
   const original=lines.join('\n').replace(/export const CONNECT_URL='[^']+';/,'export const CONNECT_URL='+JSON.stringify(url)+';').replace(/export const CONNECT_PUBLISHABLE_KEY='[^']+';/,'export const CONNECT_PUBLISHABLE_KEY='+JSON.stringify(anon)+';');
   await route.fulfill({response,contentType:'text/javascript',body:original});
  });
  await context.route('**/apps/calculs-melanges/edge-transport.mjs',async route=>{
   const response=await route.fetch(),lines=(await response.text()).split('\n');const i=lines.findIndex(x=>x.includes("throw Error('invalid_transport')"));assert.ok(i>=0);
   lines[i]=' if(endpoint!=='+JSON.stringify(url+'/functions/v1/connect-results')+"||typeof getToken!=='function')throw Error('invalid_transport');";
   await route.fulfill({response,contentType:'text/javascript',body:lines.join('\n')});
  });
  }
  await configureGame(context);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error('browser console:',m.text())});page.on('requestfailed',r=>console.error('browser failed:',new URL(r.url()).pathname,r.failure()?.errorText));
  await page.goto(site+'/tests/.mixed-auth-only.html');
  const signed=await page.evaluate(async({url,anon,SDK_URL})=>{const {createClient}=await import(SDK_URL);const sb=createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});const r=await sb.auth.signInAnonymously();if(r.error)throw r.error;return r.data.user.id},{url,anon,SDK_URL});
  const browserStudent=randomUUID();
  check(await admin.from('connect_students').insert({id:browserStudent,display_name:'Élève Chromium Mélange'}),'browser profile');
  check(await admin.from('connect_enrollments').insert({id:randomUUID(),class_id:classId,student_id:browserStudent}),'browser membership');
  check(await admin.from('connect_devices').insert({id:randomUUID(),auth_user_id:signed,student_id:browserStudent,state:'approved'}),'browser approval');
  check(await admin.from('connect_xp_credits').insert({student_id:browserStudent,app_key:'addition-ecrite-simple',xp_credited:22}),'browser previous XP');
  async function openGame(){await page.goto(site+'/apps/calculs-melanges/?class='+classId);await page.waitForFunction(()=>document.getElementById('game')?.contentWindow?.__mathasGameStorageScope?.startsWith('connect.'),null,{timeout:15000});await page.waitForTimeout(300);return page.frames().find(f=>f.parentFrame())}
  check(await admin.from('connect_mixed_multiplier_locks').insert({class_id:classId,scope_key:'class',multipliers:[2,7]}),'mixed-only table minimums');
  let frame=await openGame();
  await frame.locator('.mult-chip[data-mult="3"]').click();
  await frame.locator('.mult-chip[data-mult="2"]').click();
  assert.ok(await frame.locator('.mult-chip[data-mult="2"]').evaluate(e=>e.classList.contains('active')));
  assert.ok(await frame.locator('.mult-chip[data-mult="7"]').evaluate(e=>e.classList.contains('active')));
  await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='22 XP');
  await context.setOffline(true);await playMixedClassic({frame,page,total:4});
  await page.waitForFunction(()=>document.getElementById('result')?.textContent?.includes('en attente (offline)'));
  const queueKey='mathas.calculs-melanges.connect.'+classId+'.'+signed+'.'+browserStudent+'.v1';
  const queued=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),queueKey);assert.equal(queued.length,1);assert.equal(queued[0].score,4);assert.equal(new Set(queued[0].operationsCompleted).size>=2,true);
  assert.equal(await page.locator('#xp-total').innerText(),'22 XP');
  assert.equal(check(await admin.from('connect_states').select('student_id').eq('student_id',browserStudent).eq('app_key','melange-calculs-ecrits'),'offline DB').length,0);
  await context.setOffline(false);await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='50 XP',null,{timeout:20000});
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]').length,queueKey),0);
  const saved=check(await admin.from('connect_states').select('revision,state_data').eq('student_id',browserStudent).eq('app_key','melange-calculs-ecrits').single(),'browser SQL');
  assert.equal(saved.revision,1);assert.equal(saved.state_data.rewards.mastery[4][0],true);
  await page.goto(site+'/tests/.mixed-auth-only.html');
  const refreshed=await page.evaluate(async({url,anon,SDK_URL})=>{const {createClient}=await import(SDK_URL);const sb=createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});const r=await sb.auth.refreshSession();if(r.error)throw r.error;return r.data.user.id},{url,anon,SDK_URL});
  assert.equal(refreshed,signed);
  frame=await openGame();assert.equal(await frame.evaluate(()=>JSON.parse(localStorage.getItem('mixcalc_classic_v1'))[1].score),4);
  // Actual professor password login and actual UI; only endpoint/compiled gate are changed in this lab copy.
  const tc=await browser.newContext();await setup(tc);await configureGame(tc);await tc.route(u=>u.pathname==='/app.js',async route=>{
   const response=await route.fetch(),source=await response.text();const config="const url='https://awmhpfofacaglewammxt.supabase.co', key='sb_publishable_oI2Pyl3kXzmLkK-CBnw9Nw_66a4fZgM';";assert.ok(source.includes(config));
   await route.fulfill({response,contentType:'text/javascript',body:source.replace(config,'const url='+JSON.stringify(url)+', key='+JSON.stringify(anon)+';').replace('const MIXED_TEACHER_READY=false;','const MIXED_TEACHER_READY=true;')});
  });
  const professor=await tc.newPage();professor.on('pageerror',e=>errors.push('teacher: '+e.message));await professor.goto(site+'/?portail=prof&profClass='+classId);
  await professor.locator('#login-form:visible').waitFor();await professor.locator('#email').fill(teacherEmail);await professor.locator('#password').fill(teacherPassword);await professor.locator('#login-form button[type=submit]').click();
  await professor.locator('.results-overview-table').waitFor({timeout:30000});
  assert.equal(await professor.evaluate(()=>Boolean(localStorage.getItem('mathas-connect-professor-auth-v1'))),true);
  await professor.reload();await professor.locator('.results-overview-table').waitFor({timeout:30000});
  await professor.getByRole('button',{name:'Voir les résultats de Élève Chromium Mélange dans Calculs écrits mélangés'}).click();
  const rows=await professor.locator('#results-student-content .result-table tr').allTextContents();assert.match(rows.join('|'),/4\/4/);assert.doesNotMatch(rows[0],/HARD 5/);
  await professor.waitForFunction(()=>document.querySelector('#results-student-content .mixed-xp')?.textContent?.includes('28 XP'));
  await professor.locator('#results-student-content .results-restart-button').click();const dialog=professor.locator('dialog.parcours-dialog');await dialog.waitFor();await dialog.locator('input[type=checkbox]').uncheck();await dialog.locator('input[required]').fill('Élève Chromium Mélange');await dialog.getByRole('button',{name:'Confirmer le nouveau parcours'}).click();await dialog.waitFor({state:'detached'});
  frame=await openGame();await page.waitForFunction(()=>document.getElementById('xp-total')?.textContent==='50 XP');assert.deepEqual(await frame.evaluate(()=>JSON.parse(localStorage.getItem('mixcalc_classic_v1'))),{});
  const after=check(await admin.from('connect_states').select('reset_epoch,state_data').eq('student_id',browserStudent).eq('app_key','melange-calculs-ecrits').single(),'UI reset');assert.equal(after.reset_epoch,1);assert.deepEqual(after.state_data,{});
  const playerPage=await tc.newPage();playerPage.on('pageerror',e=>errors.push('teacher player: '+e.message));
  await playerPage.goto(site+'/apps/calculs-melanges/?class='+classId+'&joueur=prof');
  await playerPage.waitForFunction(()=>document.getElementById('game')?.contentWindow?.__mathasGameStorageScope?.startsWith('connect.'),null,{timeout:15000});
  const playerFrame=playerPage.frames().find(f=>f.parentFrame());await playMixedClassic({frame:playerFrame,page:playerPage,total:4});
  await playerPage.waitForFunction(()=>document.getElementById('result')?.textContent?.startsWith('Connect :'),null,{timeout:15000});
  const teacherRecord=check(await admin.from('connect_states').select('state_data').eq('student_id',teacherStudent).eq('app_key','melange-calculs-ecrits').single(),'real Monsieur T result');assert.equal(teacherRecord.state_data.classic[0][4],4);
  const pupilAfter=check(await admin.from('connect_states').select('state_data').eq('student_id',browserStudent).eq('app_key','melange-calculs-ecrits').single(),'pupil unchanged by teacher player');assert.deepEqual(pupilAfter.state_data,{});
  console.log('PASS real Monsieur T game uses professor auth storage and separate server player, no pupil overwrite');
  // Same JWT/device, new pupil: match revision+epoch so only identity binding can stop the old proof.
  frame=await openGame();await context.setOffline(true);await playMixedClassic({frame,page,total:4});
  await page.waitForFunction(()=>document.getElementById('result')?.textContent?.includes('en attente (offline)'));
  const rebound=randomUUID(),oldVersion=check(await admin.from('connect_states').select('revision,reset_epoch').eq('student_id',browserStudent).eq('app_key','melange-calculs-ecrits').single(),'old binding version');
  check(await admin.from('connect_students').insert({id:rebound,display_name:'Fictif réaffecté même JWT'}),'rebound pupil');
  check(await admin.from('connect_enrollments').insert({id:randomUUID(),class_id:classId,student_id:rebound}),'rebound class');
  check(await admin.from('connect_states').insert({student_id:rebound,app_key:'melange-calculs-ecrits',schema_version:1,revision:oldVersion.revision,reset_epoch:oldVersion.reset_epoch,state_data:{}}),'matching version fixture');
  check(await admin.from('connect_devices').update({student_id:rebound}).eq('auth_user_id',signed),'same JWT reassignment');
  await context.setOffline(false);await page.waitForFunction(()=>document.getElementById('result')?.textContent?.includes('en attente (conflict)'));
  assert.equal(await frame.evaluate(()=>document.body.inert),true,'conflicting profile cannot continue playing');
  const reboundState=check(await admin.from('connect_states').select('revision,state_data').eq('student_id',rebound).eq('app_key','melange-calculs-ecrits').single(),'rebound untouched');assert.equal(reboundState.revision,oldVersion.revision);assert.deepEqual(reboundState.state_data,{});
  frame=await openGame();assert.equal(await frame.evaluate(()=>JSON.parse(localStorage.getItem('mixcalc_classic_v1'))[1]??null),null);
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]').length,queueKey),1,'old pupil proof remains under old binding');
  assert.equal((await frame.evaluate(()=>window.__mathasGameStorageScope)).endsWith('.'+rebound),true);
  console.log('PASS same JWT reassigned: stale offline proof rejected despite matching revision/epoch, no new-pupil record, separate cache and queue');
  // Capacity stress uses 100 explicitly synthetic journal copies, not 100 claimed real games.
  const blockRecords=async route=>{if(route.request().postDataJSON()?.action==='game-record')return route.abort('internetdisconnected');return route.continue()};
  await context.route(url+'/functions/v1/connect-results',blockRecords);
  const newQueueKey='mathas.calculs-melanges.connect.'+classId+'.'+signed+'.'+rebound+'.v1';
  await page.evaluate(({oldKey,key,pupil})=>{const proof=JSON.parse(localStorage.getItem(oldKey))[0];localStorage.setItem(key,JSON.stringify(Array.from({length:100},()=>({...proof,eventId:crypto.randomUUID(),expectedStudentId:pupil}))))},{oldKey:queueKey,key:newQueueKey,pupil:rebound});
  frame=await openGame();await page.waitForFunction(()=>document.getElementById('game')?.contentDocument?.body?.inert===true);
  assert.match(await page.locator('#result').innerText(),/File offline pleine/);
  await assert.rejects(frame.locator('.countBtn[data-count="4"]').click({timeout:800}),/Timeout/);
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).length,newQueueKey),100);
  await context.unroute(url+'/functions/v1/connect-results',blockRecords);
  await page.locator('#retry').click();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'[]').length===0,newQueueKey,{timeout:30000});
  assert.equal(await frame.evaluate(()=>document.body.inert),false);
  console.log('PASS queue100: real controls blocked, proofs preserved, explicit retry drains ACKs and unlocks game');
  assert.deepEqual(errors,[]);console.log('PASS real Chromium + native anonymous SDK + 4 mixed calculations offline → one real Edge/SQL ACK +28 XP and trophy → reload → actual professor login/results/reset → XP retained');
 }finally{await browser.close()}
}
