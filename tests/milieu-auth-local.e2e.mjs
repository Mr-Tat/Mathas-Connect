import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {chromium} from 'playwright';
import {PILOT_CLASS as cls} from '../supabase/functions/connect-milieu/access-policy.mjs';
import {questionSequence} from '../apps/DIV-Milieu-de-segment-1/connect/seeded-questions.mjs';
import {LEVELS} from '../apps/DIV-Milieu-de-segment-1/connect/reward-contract.mjs';
const manifest=process.env.ABAQUE_LOCAL_MANIFEST;
if(!/^\/tmp\/mathas-abaque-local\.[a-zA-Z0-9]+\/local\.json$/.test(manifest||''))throw Error('disposable_local_auth_required');
const c=JSON.parse(readFileSync(manifest,'utf8'));
if(!c.localOnly||c.host!=='127.0.0.1'||c.database!=='abaque_test'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(c.api)||!/^http:\/\/127\.0\.0\.1:\d+$/.test(c.static))throw Error('disposable_local_auth_required');
const pool=new pg.Pool({host:c.host,port:c.port,database:c.database,user:c.user,password:c.password,max:4});
const q=(s,v=[])=>pool.query(s,v);
const sdk=()=>createClient(c.api,c.anon,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=createClient(c.api,c.service,{auth:{persistSession:false,autoRefreshToken:false}});
const endpoint=c.api+'/functions/v1/connect-milieu';
const host='https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-milieu';
let browser;after(async()=>{await browser?.close();await pool.end()});
async function post(session,action,fields={}){
 const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',apikey:c.anon,...(session?{authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({action,classId:cls,appKey:'milieu-segment',...fields})});
 return {status:r.status,...await r.json()};
}
async function ok(session,action,fields={}){const r=await post(session,action,fields);assert.equal(r.ok,true,JSON.stringify(r));return r}
async function pupil(){
 const client=sdk(),{data,error}=await client.auth.signInAnonymously();assert.equal(error,null);
 const student=randomUUID();await q("insert into public.connect_students(id,display_name) values($1,'Fictif milieu local')",[student]);
 await q("insert into public.connect_devices(auth_user_id,student_id,state) values($1,$2,'pending')",[data.user.id,student]);
 await q("insert into public.connect_enrollments(id,class_id,student_id) values($1,$2,$3)",[randomUUID(),cls,student]);
 return {client,student,actor:data.user.id,session:data.session};
}
async function seed(p,k){
 const s=await ok(p.session,'load'),eventId=randomUUID(),b={eventId,expectedStudentId:p.student,resetEpoch:s.resetEpoch};
 const start=await ok(p.session,'begin',{...b,activity:k,mode:null}),next=questionSequence(k,start.seed);
 const proof={version:1,activity:k,mode:null,items:Array.from({length:LEVELS[k].n},()=>{const n=next();return {n,helps:[],attempts:[{stage:'calc',value:n/2}]}})};
 return ok(p.session,'record',{...b,proof});
}
test('La moitié : GoTrue, Deno, PostgREST et Chromium réels, uniquement base jetable',async()=>{
 for(let n=0;n<40;n++){try{if((await post(null,'load')).status===401)break}catch{}if(n===39)throw Error('local_edge_not_ready');await new Promise(r=>setTimeout(r,250))}
 const p=await pupil();
 assert.equal((await post(p.session,'load')).error,'app_class_not_open');
 await q('insert into public.connect_milieu_classes(class_id,enabled) values($1,true)',[cls]);
 assert.equal((await post(p.session,'load')).error,'approved_identity_required');
 await q("update public.connect_devices set state='approved' where auth_user_id=$1",[p.actor]);
 assert.equal((await post(p.session,'load')).error,'fictive_profile_required');
 await q('insert into public.connect_milieu_approved(student_id) values($1)',[p.student]);
 const loaded=await ok(p.session,'load');assert.equal(loaded.studentId,p.student);assert.equal(loaded.authSubject,p.actor);assert.equal(loaded.xp.max,280);
 assert.equal((await post(p.session,'load',{classId:randomUUID()})).error,'app_class_not_open');
 assert.equal((await post(p.session,'teacher-summary')).error,'professor_required');
 assert.ok((await p.client.rpc('connect_milieu_load_v2',{p_actor:p.actor,p_class:cls,p_teacher:false})).error,'RPC directe élève refusée');
 const email='milieu-local-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('hex');
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.equal(created.error,null);
 const teacherClient=sdk(),signed=await teacherClient.auth.signInWithPassword({email,password});assert.equal(signed.error,null);
 const t=signed.data,teacherStudent=randomUUID();
 await q('insert into public.connect_teachers(auth_user_id) values($1)',[t.user.id]);
 await q("insert into public.connect_students(id,display_name) values($1,'Monsieur T fictif local')",[teacherStudent]);
 await q('insert into public.connect_teacher_players(teacher_id,student_id) values($1,$2)',[t.user.id,teacherStudent]);
 await q('insert into public.connect_class_permissions(teacher_id,class_id,can_manage) values($1,$2,true)',[t.user.id,cls]);
 await q('insert into public.connect_milieu_approved(student_id) values($1)',[teacherStudent]);
 assert.equal((await ok(t.session,'load')).studentId,teacherStudent);
 assert.equal((await ok(t.session,'teacher-summary')).students.length,1);
 await ok(t.session,'teacher-cap-set',{maxActivity:1});
 assert.equal((await ok(p.session,'load')).maxActivity,1);
 await ok(t.session,'teacher-cap-set',{maxActivity:6});
 // Real SDK session stored as the app does, not a fake JWT.
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(session=>localStorage.setItem('sb-awmhpfofacaglewammxt-auth-token',JSON.stringify(session)),p.session);
 let lose=true,calls=0,shareCalls=0;
 await ctx.route('**/*',async route=>{
  const u=route.request().url();
  if(u.startsWith(c.static+'/')||u.startsWith(c.api+'/'))return route.continue();
  if(u==='https://esm.sh/@supabase/supabase-js@2.95.0')return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:readFileSync(c.lab+'/browser-sdk.mjs')});
  if(u===host){
   const body=route.request().postDataJSON(),r=await route.fetch({url:endpoint});
   if(body?.action==='record'){calls++;if(lose&&r.ok()){lose=false;return route.abort()}}
   if(body?.action==='share')shareCalls++;
   return route.fulfill({response:r});
  }
  external.push(u);return route.abort();
 });
 try{
  const game=c.static+'/apps/DIV-Milieu-de-segment-1/?hub=toutes&class='+cls;
  await page.goto(game);await page.getByRole('button',{name:'Parcours Connect · TEST'}).click();
  await page.locator('#connectAccount').waitFor();
  await page.locator('[data-start="even"]').click();
  for(let n=0;n<2;n++){
   const answers=await page.evaluate(()=>pageItems().map(q=>fmt(q.n/2)));
   for(let i=0;i<5;i++)await page.locator('input[data-field="answer"]:not([readonly])').nth(i).fill(answers[i]);
   await page.locator('#ok').click();await page.locator('#ok').click();
  }
  await page.locator('#officialRetry').waitFor();
  await page.waitForFunction(()=>document.getElementById('officialResultInfo')?.textContent.includes('non confirmé'));
  assert.equal((await ok(p.session,'load')).xp.appXp,14);assert.equal(calls,1);
  await page.reload();await page.locator('#officialRetry').click();
  await page.getByText(/XP confirmés/).waitFor();assert.equal(calls,2);assert.equal((await ok(p.session,'load')).xp.appXp,14);
  await page.locator('#officialBack').click();
  assert.equal(await page.locator('[data-start="odd"]').isEnabled(),false);
  await seed(p,'even');assert.equal((await ok(p.session,'load')).xp.appXp,20);
  await page.reload();await page.locator('#connectAccount').waitFor();
  assert.equal(await page.locator('[data-start="odd"]').isEnabled(),true);
  for(const k of ['odd','mix'])for(let n=0;n<2;n++)await seed(p,k);
  await page.reload();await page.locator('[data-start="gi1"]').click();
  for(let i=0;i<6;i++){
   await page.locator('#reveal').click();const n=await page.evaluate(()=>current().n);
   await page.locator('input[data-field="answer"]').fill(String(n/20).replace('.',','));await page.locator('#ok').click();
   const hit=await page.locator('#rulerHit').boundingBox(),mm=n/2;await page.mouse.move(hit.x+(5+mm*4)*hit.width/810,hit.y+hit.height/2);
   await page.locator('#lens [data-tick="'+mm+'"]').click();await page.locator('#ok').click();
  }
  await page.locator('dialog.milieu-share[open]').waitFor();
  await page.getByRole('button',{name:'Non',exact:true}).click();assert.equal(shareCalls,0);
  await page.locator('#officialBack').click();await page.getByRole('button',{name:'Score du jour : 12 pts',exact:true}).click();
  await page.getByRole('button',{name:'Oui',exact:true}).click();await page.getByText('✓ Score envoyé.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  assert.equal(shareCalls,1);assert.equal((await ok(p.session,'board',{expectedStudentId:p.student})).boardBest,12);
  assert.equal((await ok(p.session,'load')).xp.appXp,72);assert.equal((await ok(t.session,'load')).xp.appXp,0);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await q("update public.connect_devices set state='revoked' where auth_user_id=$1",[p.actor]);
  assert.equal((await post(p.session,'load')).error,'approved_identity_required');
 }finally{await ctx.close()}
});
