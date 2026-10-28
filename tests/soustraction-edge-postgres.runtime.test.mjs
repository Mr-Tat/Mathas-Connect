import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
// Ce test exige pg seulement dans le workflow PostgreSQL isolé.
// Dans la CI Node générale, l'absence du paquet fait ignorer ce test coûteux.
const pg=(await import('pg').catch(()=>null))?.default;
// PostgREST transmet les révisions bigint JSON comme nombres (bornées à 1e9
// par l'Edge) ; le paquet pg les renvoie en chaînes par défaut.
if(pg)pg.types.setTypeParser(20,value=>Number(value));

// Test du vrai code Edge + des vraies fonctions PostgreSQL, sans Supabase distant.
// Auth et REST sont adaptés localement ; aucune connexion à des comptes d'élèves.
const CLASS='22222222-2222-4222-8222-222222222222';
const TEACHER='33333333-3333-4333-8333-333333333333';
const STUDENT='99999999-9999-4999-8999-999999999999';
const AUTH='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUB='soustraction-ecrite-simple';
const ADD='addition-ecrite-simple';
const blob=readFileSync(new URL('../supabase/functions/connect-results/index.ts',import.meta.url),'utf8');
const source=stripTypeScriptTypes(blob.replace(/^import .*;\n/,''),{mode:'strip'});
const uuid=n=>'bbbbbbbb-bbbb-4bbb-8bbb-'+String(n).padStart(12,'0');

const db=pg?new pg.Client({
 host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),
 user:process.env.PGUSER||'postgres',password:process.env.PGPASSWORD||'local_fake_only',
 database:process.env.PGDATABASE||'postgres'
}):null;

const identifier=x=>{
 if(!/^[a-z][a-z0-9_]*$/.test(x))throw Error('identifier_invalid');
 return '"'+x+'"';
};
function adapter(table){
 const tab=identifier(table);
 let where=[],args=[],method='GET',payload=null,fields='*',lim=null,sort=null;
 const val=v=>{args.push(v);return '$'+args.length};
 const api={
  select(s){fields=s.split(',').map(x=>identifier(x.trim())).join(',');return api},
  eq(k,v){where.push(identifier(k)+'='+val(v));return api},
  is(k,v){if(v!==null)throw Error('unsupported_is');where.push(identifier(k)+' IS NULL');return api},
  in(k,vs){where.push(identifier(k)+'=ANY('+val(vs)+')');return api},
  limit(n){lim=n;return api},
  order(k,opts){sort=identifier(k)+(opts?.ascending===false?' DESC':' ASC');return api},
  update(data){method='UPDATE';payload=data;return api},
  insert(data){method='INSERT';payload=data;return api},
  async maybeSingle(){const r=await execute();return {data:r.data?.[0]??null,error:r.error}},
  async single(){const r=await execute();return {data:r.data?.[0]??null,error:r.error}},
  then(resolve,reject){return execute().then(resolve,reject)}
 };
 async function execute(){
  try{
   let query;
   if(method==='GET')query='SELECT '+fields+' FROM '+tab;
   else if(method==='INSERT'){
    const keys=Object.keys(payload);
    query='INSERT INTO '+tab+' ('+keys.map(identifier).join(',')+') VALUES ('+keys.map(k=>val(payload[k])).join(',')+') RETURNING '+fields;
   }else{
    const sets=Object.entries(payload).map(([k,v])=>identifier(k)+'='+val(v));
    query='UPDATE '+tab+' SET '+sets.join(',');
   }
   if(where.length)query+=' WHERE '+where.join(' AND ');
   if(method==='UPDATE')query+=' RETURNING '+fields;
   if(sort)query+=' ORDER BY '+sort;
   if(lim!=null)query+=' LIMIT '+Number(lim);
   const data=await db.query(query,args);
   return {data:data.rows,error:null};
  }catch(e){return {data:null,error:{code:e.code||'PG_FAILED',message:e.message}}}
 }
 return api;
}

function makeEdge(){
 let serve;
 const pgService={
  from:adapter,
  async rpc(name,values){
   if(!/^(connect_xp_sync_v2|connect_xp_read_v2|connect_parcours_restart_one|connect_parcours_restart_class)$/.test(name))throw Error('unexpected_rpc '+name);
   const columns={
    connect_xp_sync_v2:['p_student','p_app','p_force'],
    connect_xp_read_v2:['p_student','p_app','p_include_milestones'],
    connect_parcours_restart_one:['p_teacher','p_class','p_student','p_app','p_repeat_xp'],
    connect_parcours_restart_class:['p_teacher','p_class','p_app','p_repeat_xp']
   }[name];
   try{
    const out=await db.query('SELECT public.'+identifier(name)+'('+columns.map((_,i)=>'$'+(i+1)).join(',')+') AS result',columns.map(k=>values[k]));
    return {data:out.rows[0].result,error:null};
   }catch(e){return {data:null,error:{code:e.code,message:e.message}}}
  }
 };
 const authService={auth:{getUser:async token=>({
   data:{user:{id:token==='FAKE_TEACHER'?TEACHER:AUTH,is_anonymous:token!=='FAKE_TEACHER'}},error:null
 })}};
 const context=vm.createContext({
  createClient:(_url,key)=>key==='priv'?pgService:authService,
  Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'priv':'pub'},serve:h=>{serve=h}},
  Date,Intl,Response,Headers,Request,crypto:globalThis.crypto,TextEncoder,URL,structuredClone,JSON,Object,Array,Number,Map,Set,Error,RegExp
 });
 vm.runInContext(source,context);
 return async (action,body={},teacher=false)=>{
  const req=new Request('http://localhost/functions/v1/connect-results',{
   method:'POST',headers:{authorization:'Bearer '+(teacher?'FAKE_TEACHER':'FAKE_STUDENT')},
   body:JSON.stringify({classId:CLASS,appKey:SUB,action,...body})
  });
  const response=await serve(req);
  return {status:response.status,body:await response.json()};
 };
}
test('Edge réel raccordé à PostgreSQL : partie, idempotence, XP, prof et reprise isolée', {skip:!pg?'Nécessite pg dans la CI PostgreSQL':false},async()=>{
 await db.connect();
 try{
  await db.query("CREATE TABLE IF NOT EXISTS public.connect_devices(auth_user_id uuid,student_id uuid,state text)");
  await db.query("INSERT INTO public.connect_students(id,display_name) VALUES($1,'Élève fictif Edge+SQL') ON CONFLICT DO NOTHING",[STUDENT]);
  await db.query("INSERT INTO public.connect_enrollments(class_id,student_id) VALUES($1,$2)",[CLASS,STUDENT]);
  await db.query("INSERT INTO public.connect_devices(auth_user_id,student_id,state) VALUES($1,$2,'approved')",[AUTH,STUDENT]);
  const call=makeEdge();
  const load=await call('student-load');
  assert.equal(load.status,200,JSON.stringify(load));
  assert.equal(load.body.revision,0);
  assert.equal(load.body.state,null);

  const first={eventId:uuid(1),expectedRevision:0,expectedResetEpoch:0,mode:'classic',level:1,score:4,total:4,points:20};
  const played=await call('game-record',first);
  assert.equal(played.status,200,JSON.stringify(played));
  assert.equal(played.body.revision,1);
  assert.equal(played.body.xp.appXp,22);
  assert.equal(played.body.xp.total,22);
  const duplicate=await call('game-record',first);
  assert.equal(duplicate.status,200,JSON.stringify(duplicate));
  assert.equal(duplicate.body.duplicate,true);
  assert.equal(duplicate.body.xp.delta,0);

  const other=await call('game-record',{eventId:uuid(2),expectedRevision:1,expectedResetEpoch:0,
    mode:'sudden',method:'takeTop',level:1,score:5,total:null,points:31});
  assert.equal(other.status,200,JSON.stringify(other));
  assert.equal(other.body.xp.appXp,32);
  assert.equal(other.body.state.suddenMethods.takeTop[0],5);
  assert.equal(other.body.state.suddenMethods.addBottom[0],null);

  const professor=await call('teacher-overview',{},true);
  assert.equal(professor.status,200,JSON.stringify(professor));
  const fake=professor.body.students.find(x=>x.id===STUDENT);
  assert.equal(fake.apps.find(a=>a.appKey===SUB).state.suddenMethods.takeTop[0],5);
  const forbidden=await call('teacher-parcours-restart',{scope:'student',studentId:STUDENT,repeatXp:false});
  assert.equal(forbidden.status,403);
  const reset=await call('teacher-parcours-restart',{scope:'student',studentId:STUDENT,repeatXp:false},true);
  assert.equal(reset.status,200,JSON.stringify(reset));
  assert.equal(reset.body.parcours,2);
  const after=await call('student-load');
  assert.equal(after.body.resetEpoch,1);
  assert.deepEqual(after.body.state,{});
  const stale=await call('game-record',{...first,eventId:uuid(3),expectedRevision:2});
  assert.equal(stale.status,409);
  assert.equal(stale.body.error,'stale_reset_epoch');
  const preserved=await db.query(
   'SELECT xp_credited FROM public.connect_xp_credits WHERE student_id=$1 AND app_key=$2',[STUDENT,SUB]
  );
  assert.equal(preserved.rows[0].xp_credited,32);
  const unrelated=await db.query(
   'SELECT xp_credited FROM public.connect_xp_credits WHERE student_id=$1 AND app_key=$2',
   ['11111111-1111-4111-8111-111111111111',ADD]
  );
  assert.equal(unrelated.rows[0].xp_credited,100);

  // Chaîne navigateur → HTTP Edge réel → PostgreSQL, mêmes données fictives.
  // Après restart, un nouvel exercice doit être crédité côté serveur, pas seulement
  // affiché comme synchronisé dans le lanceur.
  const playwright=await import('playwright');
  const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox']});
  const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
  const http=createServer(async (req,res)=>{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const target=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
   if(!target.startsWith(root+'/')){res.writeHead(403).end();return}
   try{
    const bytes=await readFile(target);
    res.writeHead(200,{'content-type':extname(target)==='.html'?'text/html; charset=utf-8':'application/octet-stream'});
    res.end(bytes);
   }catch{res.writeHead(404).end()}
  });
  await new Promise(ok=>http.listen(0,'127.0.0.1',ok));
  const host='http://127.0.0.1:'+http.address().port;
  const ctx=await browser.newContext({viewport:{width:390,height:740},reducedMotion:'reduce'});
  const responses=[];
  try{
   const jsStub="export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:'"+AUTH+"',is_anonymous:true},access_token:'FAKE_STUDENT'}}})}}}";
   await ctx.route('**/*',async route=>{
    const uri=route.request().url();
    if(uri.startsWith(host))return route.continue();
    if(uri.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',
      headers:{'access-control-allow-origin':'*'},body:jsStub});
    if(uri.startsWith('https://mr-tat.github.io/Mathas-Connect/apps/soustraction-simple/')){
      const file=resolve(root,'apps/soustraction-simple',uri.split('/').pop());
      return route.fulfill({status:200,contentType:'application/octet-stream',
        headers:{'access-control-allow-origin':'*'},body:await readFile(file)});
    }
    if(uri.includes('.supabase.co/functions/v1/')){
      const data=JSON.parse(route.request().postData()||'{}');
      const out=uri.endsWith('/connect-api')
       ?{status:200,body:{ok:true,status:'approved',classId:CLASS,displayName:'Élève fictif'}}
       :await call(data.action,data);
      responses.push({action:data.action,body:out.body});
      return route.fulfill({status:out.status,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out.body)});
    }
    return route.abort();
   });
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(host+'/apps/soustraction-simple/?class='+CLASS,{waitUntil:'domcontentloaded'});
   const frame=page.frameLocator('iframe');
   await frame.locator('#menuScreen').waitFor({timeout:25000});
   await frame.locator('body').evaluate(()=>window.__setLastWork({label:'Calculs · Niveau 1',score:'4/4',rulerUsed:false}));
   await page.waitForFunction(()=>document.querySelector('#ce-sync')?.textContent?.includes('Synchronisé'),{timeout:25000});
   assert.equal(responses.filter(x=>x.action==='game-record').length,1);
   assert.equal(responses.find(x=>x.action==='game-record').body.revision,4);
   const persisted=await call('student-load');
   assert.equal(persisted.body.resetEpoch,1);
   assert.equal(persisted.body.state.classic[0]['4'],4);
   await page.reload({waitUntil:'domcontentloaded'});
   await frame.locator('#menuScreen').waitFor({timeout:25000});
   const restored=await frame.locator('body').evaluate(()=>{
      const state=JSON.parse(localStorage.getItem('soustraction_classic20_v6'));
      return state?.['3']?.['4'];
   });
   assert.equal(restored,4,'record restauré localement depuis le vrai serveur + PostgreSQL');
   assert.deepEqual(errors,[]);
   await page.close();
  }finally{
   await ctx.close();await browser.close();
   await new Promise(ok=>http.close(ok));
  }

 }finally{await db.end()}
});
