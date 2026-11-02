import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {modal,inputConversion,solveConstruction,enterMaster} from './helpers/abaque-browser-driver.mjs';
import {build,moves,classic,pilotClass} from './fixtures/abaque-events.mjs';
const manifest=process.env.ABAQUE_LOCAL_MANIFEST;
if(!/^\/tmp\/mathas-abaque-local\.[a-zA-Z0-9]+\/local\.json$/.test(manifest||''))throw Error('local_auth_fixture_required');
const config=JSON.parse(readFileSync(manifest,'utf8'));
if(!config.localOnly||config.host!=='127.0.0.1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(config.api))throw Error('local_auth_fixture_required');
const pool=new pg.Pool({host:config.host,port:config.port,database:config.database,user:config.user,password:config.password,max:4});
const sdk=()=>createClient(config.api,config.anon,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=createClient(config.api,config.service,{auth:{persistSession:false,autoRefreshToken:false}});
const endpoint=config.api+'/functions/v1/connect-abaque';
let browser;
before(async()=>{
 for(let attempt=0;attempt<40;attempt++){
  try{const r=await fetch(endpoint,{method:'POST',body:'{}'});if(r.status===401)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('actual_local_edge_did_not_start');
});
after(async()=>{await browser?.close();await pool.end();});
async function anonymous(name){
 const client=sdk(),{data,error}=await client.auth.signInAnonymously();assert.equal(error,null,'création Auth locale fictive');
 const studentId=randomUUID();
 await pool.query('insert into connect_students(id,display_name) values($1,$2)',[studentId,name]);
 await pool.query('insert into connect_abaque_pilot_students(student_id) values($1)',[studentId]);
 await pool.query("insert into connect_devices(auth_user_id,student_id,state) values($1,$2,'pending')",[data.user.id,studentId]);
 await pool.query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),pilotClass,studentId]);
 return {client,subject:data.user.id,studentId,session:data.session};
}
async function request(identity,action,fields={}){
 const response=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+identity.session.access_token,apikey:config.anon,'content-type':'application/json'},
  body:JSON.stringify({action,appKey:'abaque-longueurs',classId:pilotClass,...fields})});
 return {status:response.status,data:await response.json()};
}
async function seed(identity,event){
 const loaded=await request(identity,'load');assert.equal(loaded.status,200,loaded.data.error||'chargement réel local');
 const result=await request(identity,'record',{expectedStudentId:identity.studentId,revision:loaded.data.revision,resetEpoch:loaded.data.resetEpoch,event:{...event,expectedResetEpoch:loaded.data.resetEpoch}});
 assert.equal(result.status,200,result.data.error||'enregistrement réel local');return result.data;
}
async function manager(){
 const email='abaque-local-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('hex');
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null,'création professeur local fictif');
 const client=sdk(),signed=await client.auth.signInWithPassword({email,password});assert.equal(signed.error,null,'connexion professeur local fictif');
 const subject=signed.data.user.id;
 await pool.query('insert into connect_teachers(auth_user_id) values($1)',[subject]);
 await pool.query('insert into connect_class_permissions(teacher_id,class_id,can_manage) values($1,$2,true)',[subject,pilotClass]);
 return {client,subject,session:signed.data.session};
}
async function browserPage(identity,{teacher=false}={}){
 browser??=await chromium.launch({...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(15000);
 const external=[],errors=[];let offline=false,dropAck=false,heldLoad=null;
 await page.addInitScript(({key,session})=>{if(session)localStorage.setItem(key,JSON.stringify(session));else localStorage.removeItem(key);},{key:teacher?'mathas-connect-professor-auth-v1':'sb-awmhpfofacaglewammxt-auth-token',session:identity?.session??null});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url.startsWith(config.static+'/')||url.startsWith(config.api+'/'))return route.continue();
  if(url==='https://esm.sh/@supabase/supabase-js@2.95.0')return route.fulfill({status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:readFileSync(config.lab+'/browser-sdk.mjs')});
  if(url==='https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-abaque'){
   if(offline)return route.abort();
   const response=await route.fetch({url:endpoint});
   if(heldLoad&&route.request().method()==='POST'&&route.request().postDataJSON()?.action==='load'){
    const held=heldLoad;heldLoad=null;held.arrive();await held.promise;
   }
   if(dropAck&&route.request().postDataJSON()?.action==='record'){dropAck=false;return route.abort();}
   return route.fulfill({response});
  }
  external.push(url);return route.abort();
 });
 return {page,context,external,errors,offline:value=>{offline=value},dropNextAck:()=>{dropAck=true},
  holdNextLoad(){
   let release,arrive;
   const promise=new Promise(resolve=>{release=resolve}),arrived=new Promise(resolve=>{arrive=resolve});
   heldLoad={promise,arrive};
   return {release,async wait(){let timer;try{await Promise.race([arrived,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('local_load_not_received')),12000)})]);}finally{clearTimeout(timer);}}};
  }};
}
const game=config.static+'/apps/abaque-longueurs/?connect=1&class='+pilotClass;
async function pending(page){return page.evaluate(()=>{
 const key=Object.keys(localStorage).find(key=>key.startsWith('mathas.abaque.connect.'));
 return key?JSON.parse(localStorage.getItem(key)).pending.length:0;
});}

test('Auth + Edge Deno + PostgreSQL réels : approbation, JWT, identité liée, RPC privées et appareil révoqué',async()=>{
 const pupil=await anonymous('Fictif Auth Abaque');
 const reference=await pupil.client.auth.getUser(pupil.session.access_token);
 assert.equal(reference.error,null);assert.equal(reference.data.user.id,pupil.subject);assert.equal(reference.data.user.is_anonymous,true);
 assert.equal((await request(pupil,'load')).status,403,'appareil en attente refusé');
 await pool.query("update connect_devices set state='approved' where auth_user_id=$1",[pupil.subject]);
 await pool.query('delete from connect_abaque_pilot_students where student_id=$1',[pupil.studentId]);
 assert.equal((await request(pupil,'load')).status,403,'l’appartenance à la classe ne remplace pas l’approbation fictive explicite');
 await pool.query('insert into connect_abaque_pilot_students(student_id) values($1)',[pupil.studentId]);
 const first=await seed(pupil,build(10));assert.equal(first.xp.delta,8);assert.equal(first.authSubject,pupil.subject);
 const forged=await request(pupil,'record',{expectedStudentId:pupil.studentId,revision:first.revision,resetEpoch:0,event:{...build(),xp:160}});
 assert.equal(forged.status,400);
 const wrong=await request(pupil,'record',{expectedStudentId:randomUUID(),revision:first.revision,resetEpoch:0,event:build()});assert.equal(wrong.status,409);
 const privateRpc=await pupil.client.rpc('connect_abaque_load_v1',{p_actor:pupil.subject,p_class:pilotClass,p_teacher:false});assert.ok(privateRpc.error,'JWT élève ne peut pas appeler la RPC privée directement');
 assert.equal((await request(pupil,'teacher-summary')).status,403);
 const invalid=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer local-invalid-token','content-type':'application/json'},body:JSON.stringify({action:'load',appKey:'abaque-longueurs',classId:pilotClass})});assert.equal(invalid.status,401);
 await pool.query("update connect_devices set state='revoked' where auth_user_id=$1",[pupil.subject]);
 assert.equal((await request(pupil,'load')).status,403,'révocation vérifiée dans la transaction');
});

test('Chromium + Auth/Edge réels : clavier, XP, trophées, réponse perdue/offline, autre appareil et réaffectation',async()=>{
 const pupil=await anonymous('Fictif Navigateur Abaque');
 await pool.query("update connect_devices set state='approved' where auth_user_id=$1",[pupil.subject]);
 for(const event of [build(10),build(10),moves(7),moves(7)])await seed(pupil,event);
 const h=await browserPage(pupil),{page}=h;
 try{
  await page.goto(game);await page.locator('html[data-abaque-connected]').waitFor();
  assert.match(await page.locator('.abaque-account-xp').textContent(),/28 \/ 160/);
  assert.equal(await page.locator('[data-mode="one"] .abaque-xp-remaining').textContent(),'Reste 20 XP');
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'menus Connect utilisables à 320 px');
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').isVisible(),true);
  await page.setViewportSize({width:1024,height:900});
  await enterMaster(page);await page.locator('[data-mode="one"]').click();await page.locator('#masterExit').click();await inputConversion(page);await modal(page,'Accueil');
  assert.equal((await request(pupil,'load')).data.xp.appXp,28,'aucun crédit pour la partie commencée en Master');
  assert.equal(await pending(page),0);
  await page.locator('[data-mode="one"]').click();await inputConversion(page);await modal(page,'Accueil');
  await page.waitForFunction(()=>document.querySelector('.abaque-account-xp')?.textContent.includes('48 / 160'));
  h.offline(true);await solveConstruction(page);
  await page.waitForFunction(()=>document.querySelector('#abaque-connect-panel').textContent.includes('Hors connexion'));
  assert.equal(await pending(page),1);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'false','pas de trophée connecté avant ACK serveur');
  await page.reload();await page.locator('html[data-abaque-connected]').waitFor();
  assert.equal(await pending(page),1,'résultat conservé au rechargement hors connexion');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0,'pas de projection XP extrapolée hors connexion');
  h.offline(false);h.dropNextAck();await page.locator('#abaque-connect-panel button').click();
  await page.waitForFunction(()=>document.querySelector('.abaque-account-xp')?.textContent.includes('54 / 160'));
  await page.waitForFunction(()=>{const key=Object.keys(localStorage).find(key=>key.startsWith('mathas.abaque.connect.'));return key&&JSON.parse(localStorage.getItem(key)).pending.length===0;});
  assert.equal(await pending(page),0);
  assert.equal(await page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'1 / 6');
  assert.equal((await request(pupil,'load')).data.xp.appXp,54,'complément unique malgré la réponse perdue');
  await seed(pupil,classic('three',10));await seed(pupil,classic('five',16));
  await page.locator('#abaque-connect-panel button').click();
  await page.waitForFunction(()=>document.querySelector('.abaque-account-xp')?.textContent.includes('100 / 160'));
  await page.locator('[data-variant="lives"]').click();
  for(let i=0;i<5;i++){await inputConversion(page);await modal(page,'Suivante');}
  for(let i=0;i<3;i++){await inputConversion(page,true);await modal(page,i===2?'Accueil':'Suivante');}
  await page.waitForFunction(()=>document.querySelector('.abaque-account-xp')?.textContent.includes('106 / 160'));
  assert.equal(await page.locator('[data-variant="sudden"] .abaque-xp-remaining').textContent(),'Reste 26 XP');
  assert.equal(await page.locator('#recordChoice .record-caption .abaque-xp-remaining').count(),0,'XP hors du cadre sombre');
  assert.equal(await page.locator('[data-variant="sudden"]').evaluate(button=>{
   const bounds=button.getBoundingClientRect(),inner=button.querySelector('.record-caption').getBoundingClientRect(),hint=button.querySelector('.abaque-xp-remaining').getBoundingClientRect(),cups=button.querySelector('.record-trophies').getBoundingClientRect();
   return hint.top>=inner.bottom&&hint.bottom<=bounds.bottom&&bounds.bottom-hint.bottom<22&&hint.left-bounds.left<18&&hint.right<cups.left&&bounds.right-cups.right<18&&cups.top>inner.bottom;
  }),true,'XP et coupes séparés en bas du bouton, hors du cadre sombre');
  await page.locator('[data-variant="sudden"]').click();
  for(let i=0;i<11;i++){await inputConversion(page);assert.equal(await page.locator('.record-trophies .earned').count(),0,'coupes Connect attendent la preuve validée serveur');await modal(page,'Suivante');}
  await inputConversion(page,true);await modal(page,'Accueil');
  await page.waitForFunction(()=>document.querySelector('.abaque-account-xp')?.textContent.includes('132 / 160'));
  const recorded=await request(pupil,'load');assert.equal(recorded.data.state.suddenBest,11);
  assert.deepEqual(recorded.data.trophies,['abaque:bronze','abaque:sudden-bronze','abaque:sudden-gold','abaque:sudden-silver'],'trois coupes réservées à Mort subite validées serveur');
  assert.equal(await page.locator('#personalTrophyCount').textContent(),'4 / 6');
  assert.equal(await page.locator('.record-trophies .earned').count(),3);
  const second=sdk(),auth=await second.auth.signInAnonymously();assert.equal(auth.error,null);
  await pool.query("insert into connect_devices(auth_user_id,student_id,state) values($1,$2,'approved')",[auth.data.user.id,pupil.studentId]);
  const another=await browserPage({session:auth.data.session});
  try{await another.page.goto(game);await another.page.locator('html[data-abaque-connected]').waitFor();assert.match(await another.page.locator('.abaque-account-xp').textContent(),/132 \/ 160/);assert.equal(await another.page.locator('#trophy-launchBtn').getAttribute('data-earned'),'true');assert.equal(await another.page.locator('#personalTrophyCount').textContent(),'4 / 6');assert.equal(await another.page.locator('#personalBest').textContent(),String(recorded.data.state.scoreRecords.allBest));assert.deepEqual(another.external,[]);assert.deepEqual(another.errors,[]);}finally{await another.context.close();}
  const replacement=randomUUID();await pool.query('insert into connect_students(id,display_name) values($1,$2)',[replacement,'Autre profil fictif']);
  await pool.query('insert into connect_abaque_pilot_students(student_id) values($1)',[replacement]);
  await pool.query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),pilotClass,replacement]);
  await pool.query('update connect_devices set student_id=$1 where auth_user_id=$2',[replacement,pupil.subject]);
  await page.locator('#abaque-connect-panel button').click();
  await page.waitForFunction(()=>document.querySelector('#abaque-connect-panel').textContent.includes('identity_binding_conflict'));
  assert.equal(await page.locator('.abaque-account-xp').textContent(),'');assert.equal(await page.locator('.shell').isVisible(),false);
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});

test('Professeur réel local : consentement avant lecture, progression et reset Abaque sans recollection',async()=>{
 const pupil=await anonymous('Fictif Résultats Abaque');await pool.query("update connect_devices set state='approved' where auth_user_id=$1",[pupil.subject]);
 await seed(pupil,build());
 const teacher=await manager(),h=await browserPage(teacher,{teacher:true}),{page}=h;
 try{
  await page.goto(config.static+'/apps/abaque-longueurs/professeur.html?class='+pilotClass);
  await page.locator('#load').click();assert.equal(await page.locator('#results tr').count(),0);
  await page.locator('#fictive-confirm').check();await page.locator('#load').click();
  const row=page.locator(`tr[data-student-id="${pupil.studentId}"]`);await row.waitFor();assert.match(await row.textContent(),/14 \/ 160/);assert.match(await row.textContent(),/Parcours : bronze/);
  page.once('dialog',dialog=>dialog.accept());await row.getByRole('button',{name:'Remettre à zéro'}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('réinitialisé'));
  const reset=await request(pupil,'load');assert.equal(reset.data.resetEpoch,1);assert.equal(reset.data.xp.appXp,14);assert.deepEqual(reset.data.trophies,['abaque:bronze']);
  const replay=await seed(pupil,build());assert.equal(replay.xp.delta,0);
  await page.locator('#fictive-confirm').uncheck();assert.equal(await page.locator('#results tr').count(),0);
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
 }finally{await h.context.close();}
});


test('Chromium + Auth réels : XP absents sans compte/approbation, hors ligne et après déconnexion avec réponse tardive',async()=>{
 const loggedOut=await browserPage(null);
 try{
  await loggedOut.page.goto(game);
  await loggedOut.page.waitForFunction(()=>document.querySelector('#abaque-connect-panel')?.textContent.includes('session_missing'));
  assert.equal(await loggedOut.page.locator('.abaque-xp-remaining:visible').count(),0);
  assert.deepEqual(loggedOut.errors,[]);
 }finally{await loggedOut.context.close();}
 const pupil=await anonymous('Fictif Visibilité XP');
 const refused=await browserPage(pupil);
 try{
  await refused.page.goto(game);
  await refused.page.waitForFunction(()=>document.querySelector('#abaque-connect-panel')?.textContent.includes('approved_identity_required'));
  assert.equal(await refused.page.locator('.abaque-xp-remaining:visible').count(),0);
 }finally{await refused.context.close();}
 await pool.query("update connect_devices set state='approved' where auth_user_id=$1",[pupil.subject]);
 const h=await browserPage(pupil),{page}=h;let delayed=null;
 try{
  await page.goto(config.static+'/apps/abaque-longueurs/');
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0,'pas de XP en mode démo même avec une session enregistrée');
  await page.goto(game);await page.locator('html[data-abaque-connected]').waitFor();
  assert.equal(await page.locator('#abaque-demo-controls').count(),0,'pas de simulateur dans la connexion réelle');
  assert.equal(await page.locator('.abaque-demo-xp').count(),0);
  assert.equal(await page.evaluate(()=>{try{window.MATHAS_PROGRESS.setDemoPreview({state:{},trophies:[]});return false;}catch(error){return error.message==='preview_not_available_in_connect';}}),true,'le profil fictif ne peut pas remplacer un état Connect');
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').textContent(),'Reste 20 XP');
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').isVisible(),true);
  assert.equal(await page.locator('#launchBtn>.abaque-xp-remaining').evaluate(el=>getComputedStyle(el).fontWeight),'400','mention discrète sans gras');
  await h.context.setOffline(true);
  await page.waitForFunction(()=>document.querySelector('#launchBtn>.abaque-xp-remaining')?.hidden===true);
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0,'masquage immédiat sans attendre une nouvelle partie');
  await h.context.setOffline(false);
  await page.waitForFunction(()=>document.querySelector('#launchBtn>.abaque-xp-remaining')?.hidden===false);
  delayed=h.holdNextLoad();await page.locator('#abaque-connect-panel button').click();await delayed.wait();
  const signOut=await page.evaluate(async({api,anon})=>{
   const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
   const client=createClient(api,anon,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'sb-awmhpfofacaglewammxt-auth-token'}});
   const {error}=await client.auth.signOut({scope:'local'});return error?.code??null;
  },{api:config.api,anon:config.anon});
  assert.equal(signOut,null);
  await page.waitForFunction(()=>document.querySelector('#abaque-connect-panel')?.textContent.includes('Session à reconnecter'));
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0);
  delayed.release();await page.waitForFunction(()=>!document.querySelector('#abaque-connect-panel button').disabled);
  assert.equal(await page.locator('.abaque-xp-remaining:visible').count(),0,'une réponse approuvée reçue après logout ne doit pas réafficher les XP');
  assert.deepEqual(h.external,[]);assert.deepEqual(h.errors,[]);
 }finally{delayed?.release();await h.context.close();}
});
