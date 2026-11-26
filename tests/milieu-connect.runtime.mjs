import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createMilieuHandler} from '../supabase/functions/connect-milieu/handler.mjs';
import {questionSequence} from '../apps/DIV-Milieu-de-segment-1/connect/seeded-questions.mjs';
import {LEVELS} from '../apps/DIV-Milieu-de-segment-1/connect/reward-contract.mjs';
if(process.env.MILIEU_LOCAL!=='1'||process.env.PGHOST!=='127.0.0.1'||process.env.PGDATABASE!=='milieu_test')throw Error('disposable_local_database_required');
const pool=new pg.Pool({host:'127.0.0.1',port:55432,database:'milieu_test',user:'postgres',password:'local-test-only'});after(()=>pool.end());
const query=(s,a=[])=>pool.query(s,a);
const cls=randomUUID(),teacher=randomUUID(),actor=randomUUID(),student=randomUUID(),other=randomUUID(),otherActor=randomUUID();
const users=new Map([[teacher,false],[actor,true],[otherActor,true]]);
const auth={auth:{getUser:async token=>users.has(token)?{data:{user:{id:token,is_anonymous:users.get(token)}}}:{error:{message:'invalid'}}}};
const db={rpc:async(name,args)=>{try{const entries=Object.entries(args);const sql='select public.'+name+'('+entries.map(([k,v],i)=>k+' => $'+(i+1)).join(',')+') v';const values=entries.map(([k,v])=>['p_proof','p_judgement','p_state','p_targets'].includes(k)?JSON.stringify(v):v);return {data:(await query(sql,values)).rows[0].v}}catch(e){return {error:{message:e.message}}}}};
const handler=createMilieuHandler({auth,db,access:'pilot'});
async function post(action,body={},who=actor,h=handler){const response=await h(new Request('https://local.test',{method:'POST',headers:{authorization:'Bearer '+who,'content-type':'application/json'},body:JSON.stringify({action,ruleset:3,appKey:'milieu-segment',classId:cls,...body})}));return {status:response.status,...await response.json()}}
async function ok(action,body={},who=actor){const r=await post(action,body,who);assert.equal(r.ok,true,JSON.stringify(r));return r}
const proof=(activity,mode,seed,good=20)=>{const n=questionSequence(activity,seed),steps=['gi2','g3'].includes(activity)?['measure','calc','place']:activity.startsWith('g')?['calc','place']:['calc'];const items=[];for(let i=0;i<(mode?good:LEVELS[activity].n);i++){const v=n();items.push({n:v,helps:[],attempts:steps.map(stage=>stage==='measure'?{stage,tick:v,value:v}:stage==='calc'?{stage,value:v/2}:{stage,tick:v/2})})}if(mode)for(let i=0;i<(mode==='sudden'?1:3);i++){const v=n();items.push({n:v,helps:[],attempts:[{stage:'measure',tick:v,value:0}]})}return {version:1,activity,mode,items}};
async function run(activity,mode=null,who=actor,pupil=student){const current=await ok('load',{},who),eventId=randomUUID(),b={expectedStudentId:pupil,eventId,resetEpoch:current.resetEpoch};const started=await ok('begin',{...b,activity,mode},who);const result=proof(activity,mode,started.seed);return {b,result,ack:await ok('record',{...b,proof:result},who)}}
test('PostgreSQL réel + handler Edge injecté : identité, 280 XP, projection, idempotence, reset',async()=>{
 await query("insert into connect_apps(app_key,title,enabled,featured) values('milieu-segment','La moitié',true,false)");
 await query("insert into connect_classes(id,name) values($1,'Fictive')",[cls]);
 await query('insert into connect_milieu_classes(class_id,enabled) values($1,true)',[cls]);
 await query('insert into connect_class_permissions(teacher_id,class_id,can_manage) values($1,$2,true)',[teacher,cls]);
 for(const [p,a] of [[student,actor],[other,otherActor]]){await query("insert into connect_students(id,display_name) values($1,'Fictif')",[p]);await query('insert into connect_milieu_approved(student_id) values($1)',[p]);await query("insert into connect_devices(auth_user_id,student_id,state) values($1,$2,'approved')",[a,p]);await query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),cls,p])}
 assert.equal((await post('load',{},actor,createMilieuHandler({auth,db}))).error,'integration_closed');
 assert.equal((await post('load',{expectedStudentId:other})).error,'identity_binding_conflict');
 assert.equal((await post('teacher-summary')).error,'professor_required');
 assert.equal((await post('teacher-cap-set',{maxActivity:4})).error,'professor_required');
 assert.equal((await ok('teacher-cap-set',{maxActivity:4},teacher)).maxActivity,4);
 const capRun=await ok('load');assert.equal(capRun.maxActivity,4);assert.equal((await post('teacher-cap-set',{maxActivity:5},teacher)).error,'invalid_result');
 // A lowered cap is a new-run limit, not a forced cancellation or deletion.
 for(const k of ['even','odd','mix','gi1','gi2'])for(let i=0;i<LEVELS[k].p;i++)await run(k);
 assert.equal((await ok('load')).state.decimalUnlocked,true);
 assert.equal((await post('begin',{expectedStudentId:student,eventId:randomUUID(),resetEpoch:0,activity:'decimal1'})).error,'activity_locked');
 assert.equal((await ok('teacher-cap-set',{maxActivity:6},teacher)).maxActivity,6);
 assert.equal((await ok('begin',{expectedStudentId:student,eventId:randomUUID(),resetEpoch:0,activity:'decimal1'})).activity,'decimal1');
 for(const k of Object.keys(LEVELS))for(let i=0;i<LEVELS[k].p;i++)await run(k);
 let a=await run('gi2','sudden');assert.equal(a.ack.judgement.points,80);assert.equal(a.ack.xp.delta,48);
 let b=await run('g3','sudden');assert.equal(b.ack.judgement.points,120);assert.equal(b.ack.xp.appXp,280);assert.equal(b.ack.trophies.length,12);
 assert.equal((await ok('record',{...b.b,proof:b.result})).xp.delta,0);
 const changed=structuredClone(b.result);changed.items[0].n=10;assert.equal((await post('record',{...b.b,proof:changed})).ok,false);
 assert.equal((await ok('board',{expectedStudentId:student})).boardBest,0);
 assert.equal((await post('share',b.b)).ok,false);
 assert.equal((await ok('share',{...b.b,confirmed:true})).boardBest,120);
 assert.equal((await ok('share',{...b.b,confirmed:true})).duplicate,true);
 assert.equal((await ok('share',{...a.b,confirmed:true})).alreadyCovered,true);
 const roster=(await ok('teacher-summary',{},teacher)).students;const p=roster.find(x=>x.studentId===student),q=roster.find(x=>x.studentId===other);
 const target=x=>({studentId:x.studentId,epoch:x.resetEpoch,revision:x.revision});
 const reset={scope:'student',part:'integerGeometry',repeatXp:true,confirmed:true,targets:[target(p)]};
 assert.equal((await post('teacher-restart',reset)).error,'professor_required');
 assert.equal((await post('teacher-restart',{...reset,scope:'class',targets:[target(p)]},teacher)).error,'not_enrolled');
 assert.equal((await post('teacher-restart',{...reset,scope:'class',targets:[target(p),{...target(q),epoch:1}]},teacher)).error,'stale_reset_epoch');
 assert.equal((await ok('load')).resetEpoch,0);
 assert.equal((await ok('teacher-restart',reset,teacher)).count,1);
 let snapshot=await ok('load');assert.equal(snapshot.resetEpoch,1);assert.equal(snapshot.xp.appXp,280);assert.equal(snapshot.state.decimalUnlocked,true);assert.ok(snapshot.state.levels.g3);assert.equal(snapshot.state.levels.gi1,undefined);assert.equal(snapshot.scoreRecords.allBest,120);
 assert.equal((await post('record',{...a.b,proof:a.result})).error,'stale_reset_epoch');
 assert.equal((await post('begin',{...a.b,eventId:randomUUID(),resetEpoch:1,activity:'gi2',mode:'lives'})).error,'activity_locked');
 await run('gi1');await run('gi2');await run('gi2','lives');snapshot=await ok('load');assert.equal(snapshot.xp.appXp,356);
 assert.equal((await run('gi2','sudden')).ack.xp.delta,0);
 assert.equal((await ok('load',{},otherActor)).xp.appXp,0);
 const stage2=(await ok('teacher-summary',{},teacher)).students.find(x=>x.studentId===student);assert.equal((await ok('teacher-restart',{scope:'student',part:'decimalStage',repeatXp:true,confirmed:true,targets:[target(stage2)]},teacher)).count,1);
 const dec=await ok('load');assert.equal(dec.state.levels.decimal1,undefined);assert.equal(dec.state.levels.g3,undefined);assert.ok(dec.state.levels.gi1);assert.equal(dec.trophies.length,12);assert.equal(dec.xp.appXp,356);assert.equal(dec.xp.remaining.decimal1,4);assert.equal(dec.xp.remaining['decimals:sudden'],72);assert.equal(dec.xp.remaining.gi1,0);
 const conn=await pool.connect();try{await conn.query('begin');await conn.query('set local role authenticated');await assert.rejects(conn.query('select public.connect_milieu_snapshot_v2($1)',[student]),/permission denied/)}finally{await conn.query('rollback');conn.release()}
});

test('Chromium réel avec JWT simulé, handler et PostgreSQL réels : preuve native, ACK perdu et partage différé',async()=>{
 // The only Auth substitution is a fictive signed-in session. All game requests
 // pass through the real handler, with the same disposable database as above.
 for(const k of ['even','odd','mix'])for(let i=0;i<LEVELS[k].p;i++)await run(k,null,otherActor,other);
 const root=resolve('.'),prefix='/apps/DIV-Milieu-de-segment-1/';
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith(prefix)&&path!=='/avatar-catalog.js'){res.writeHead(404);res.end();return}const absolute=resolve(root,'.'+path);if(!absolute.startsWith(root+'/'))throw Error('path');const data=await readFile(absolute);res.setHeader('content-type',extname(path)==='.html'?'text/html; charset=utf-8':extname(path)==='.svg'?'image/svg+xml':'text/javascript');res.end(data)}catch{res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1100,height:800},serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 let lost=true,recordCalls=0,shareCalls=0;
 await ctx.route('https://esm.sh/**',route=>route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:"export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:'"+otherActor+"',user:{id:'"+otherActor+"',is_anonymous:true}}}}),onAuthStateChange:()=>({})}}}"}));
 await ctx.route('https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-milieu',async route=>{
  const req=route.request(),data=req.postData(),body=data?JSON.parse(data):{};
  const response=await handler(new Request(req.url(),{method:req.method(),headers:req.headers(),...(data?{body:data}:{})}));
  if(body.action==='record'){recordCalls++;if(lost&&response.ok){lost=false;await route.abort();return}}
  if(body.action==='share')shareCalls++;
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
 });
 const url='http://127.0.0.1:'+server.address().port+prefix+'index.html?requireConnect=1&class='+cls;
 try{
  await page.goto(url);await page.locator('[data-start="gi1"]').waitFor();
  assert.equal(await page.locator('#connectAccount').isVisible(),true);
  assert.equal(await page.locator('.account-name').innerText(),'Fictif');
  assert.equal(await page.locator('.account-level strong').innerText(),'2');
  assert.equal(await page.locator('.account-rail').getAttribute('aria-valuenow'),'10');
  assert.equal(await page.locator('.account-avatar').isVisible(),true);
  await page.locator('#refreshProgress').click();await page.locator('#refreshProgress').filter({hasText:'Actualiser la progression'}).waitFor();
  assert.equal(await page.locator('[data-start="gi2"]').isEnabled(),false);
  await page.locator('[data-start="gi1"]').click();
  for(let i=0;i<6;i++){
   await page.locator('#reveal').click();
   const n=await page.evaluate(()=>current().n);
   await page.locator('input[data-field="answer"]').fill(String(n/20).replace('.',','));
   await page.locator('#ok').click();
   const mm=n/2,pt=await page.locator('#rulerHit').evaluate((el,mm)=>{const p=el.ownerSVGElement.createSVGPoint();p.x=35+mm*4;p.y=82;const t=p.matrixTransform(el.getScreenCTM());return {x:t.x,y:t.y}},mm);
   await page.mouse.move(pt.x,pt.y);
   await page.locator('#lens [data-tick="'+mm+'"]').click();
   assert.equal(await page.evaluate(()=>current().done),false);
   await page.locator('#ok').click();
   await page.locator('#ok').click();
  }
  await page.waitForFunction(()=>document.getElementById('officialResultInfo')?.textContent.includes('non confirmé'));
  assert.equal(recordCalls,1);
  assert.equal((await ok('load',{},otherActor)).xp.appXp,72);
  await page.reload();await page.locator('#officialRetry').waitFor();
  await page.locator('#officialRetry').click();
  await page.locator('dialog.milieu-share[open]').waitFor();
  assert.equal(recordCalls,2);
  assert.equal((await ok('load',{},otherActor)).xp.appXp,72);
  await page.getByRole('button',{name:'Non',exact:true}).click();
  assert.equal(shareCalls,0);
  await page.locator('#officialBack').click();
  await page.getByRole('button',{name:'Score du jour : 12 pts',exact:true}).click();
  await page.locator('dialog.milieu-share[open]').waitFor();
  await page.getByRole('button',{name:'Oui',exact:true}).click();
  await page.getByText('✓ Score envoyé.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  assert.equal(shareCalls,1);
  assert.equal((await ok('board',{expectedStudentId:other},otherActor)).boardBest,12);
  await page.getByRole('button',{name:'Score du jour : 12 pts',exact:true}).click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('dialog.milieu-share[open]').count(),0);
  for(const width of [390,320]){await page.setViewportSize({width,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'menu Connect '+width)}
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();await browser.close();await new Promise(r=>server.close(r))}
});

test('classe scolaire fictive : carte masquée, contrôle professeur, appareil approuvé et consentement',async()=>{
 const school=randomUUID(),pupil=randomUUID(),device=randomUUID(),unapproved=randomUUID();
 users.set(device,true);users.set(unapproved,true);
 const open=createMilieuHandler({auth,db,access:'open',pilotClassId:cls});
 const send=(action,body={},who=device,h=open)=>post(action,{classId:school,...body},who,h);
 await query("insert into connect_classes(id,name) values($1,'Fictive scolaire')",[school]);
 await query("insert into connect_milieu_classes(class_id,enabled,preset_slug) values($1,true,'phase2')",[school]);
 await query('insert into connect_class_permissions(teacher_id,class_id,can_manage) values($1,$2,true)',[teacher,school]);
 await query("insert into connect_students(id,display_name) values($1,'Fictif scolaire')",[pupil]);
 await query("insert into connect_devices(auth_user_id,student_id,state) values($1,$2,'approved')",[device,pupil]);
 await query('insert into connect_enrollments(id,class_id,student_id) values($1,$2,$3)',[randomUUID(),school,pupil]);
 await query("insert into connect_hub_preset_entries(preset_slug,app_key,section,display_order,visible,featured) values('phase2','milieu-segment','outil',75,false,false)");
 assert.equal((await send('load')).error,'app_class_not_open');
 assert.equal((await send('teacher-cap-get',{},teacher)).maxActivity,4);
 assert.equal((await send('teacher-summary',{},teacher)).students.length,1);
 assert.equal((await send('teacher-cap-set',{maxActivity:6},teacher)).maxActivity,6);
 await query("update connect_hub_preset_entries set visible=true where preset_slug='phase2' and app_key='milieu-segment'");
 assert.equal((await send('load',{},unapproved)).error,'approved_identity_required');
 assert.equal((await send('load',{},device,createMilieuHandler({auth,db,access:'pilot',pilotClassId:cls}))).error,'app_class_not_open');
 assert.equal((await send('load',{expectedStudentId:student})).error,'identity_binding_conflict');
 const load=await send('load');assert.equal(load.ok,true);assert.equal(load.studentId,pupil);assert.equal(load.xp.appXp,0);
 const eventId=randomUUID(),args={expectedStudentId:pupil,eventId,resetEpoch:0},beg=await send('begin',{...args,activity:'even',mode:null});assert.equal(beg.ok,true);
 const ack=await send('record',{...args,proof:proof('even',null,beg.seed)});assert.equal(ack.ok,true);assert.equal(ack.xp.appXp,14);
 assert.equal((await send('record',{...args,proof:proof('even',null,beg.seed)})).xp.delta,0);
 await query("update connect_hub_preset_entries set visible=false where preset_slug='phase2' and app_key='milieu-segment'");
 assert.equal((await send('load')).error,'app_class_not_open');
 assert.equal((await send('teacher-summary',{},teacher)).students[0].xp.appXp,14);
});
