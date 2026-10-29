import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Real teacher DOM and app.js, but fake professor JWT + fake read-only Edge.
// ADD_MULTI_TEACHER_READY is overridden in test traffic ONLY, not in GitHub.
// No request reaches a genuine Supabase project, no teacher restart is sent.
const origin='http://127.0.0.1:8765';
const classroom='8fe170fa-9e8f-4e80-885a-b0ba68026f64'; // app's existing demo-space identifier
const student='11111111-1111-4111-8111-111111111111';
const record={
 classic:[{'4':4,'10':8},{'20':19},{}],
 sudden:[6,null,null],hard:[7,2,null],hardThree:[3,null,null],
 recent:[{at:'2026-10-29T10:01:00Z',score:4,total:4}]
};
const teacherData={ok:true,students:[{
 id:student,displayName:'Élève fictif',apps:[{
  appKey:'addition-ecrite-multiple',
  state:{...record,bestPoints:null,todayBest:null}
 }]
}]};
const browser=await chromium.launch({headless:true});
try{
 for(const enabled of [false,true]){
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[],edgeCalls=[];
  let interceptedTeacherModule=false;
  page.on('pageerror',error=>errors.push(error.message));
  if(enabled){
   await context.route(url=>url.pathname==='/app.js',async route=>{
    interceptedTeacherModule=true;
    const response=await route.fetch();
    const src=await response.text();
    assert.ok(src.includes('const ADD_MULTI_TEACHER_READY=false;'));
    await route.fulfill({response,contentType:'text/javascript',
      body:src.replace('const ADD_MULTI_TEACHER_READY=false;',
       'const ADD_MULTI_TEACHER_READY=true;')});
   });
  }
  await context.route('https://esm.sh/@supabase/supabase-js@2.95.0',async route=>
   route.fulfill({status:200,contentType:'text/javascript',body:`
    export function createClient(){return {auth:{
     getSession:async()=>({data:{session:{
      access_token:'FAKE-PROF-JWT',user:{id:'33333333-3333-4333-8333-333333333333',is_anonymous:false}
     }}}),
     signOut:async()=>({error:null})
    }}}
   `})
  );
  await context.route('https://awmhpfofacaglewammxt.supabase.co/functions/v1/**',async route=>{
   const req=route.request(),p=JSON.parse(req.postData()||'{}');
   edgeCalls.push(p);
   assert.equal(req.headers().authorization,'Bearer FAKE-PROF-JWT');
   const answer=payload=>route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify(payload)});
   if(req.url().endsWith('/connect-api')){
    if(p.action==='teacher-dashboard')return answer({
     ok:true,classes:[{id:classroom,name:'Classe fictive'}],
     years:[],requests:[]
    });
    throw Error('Unexpected teacher API action: '+p.action);
   }
   assert.equal(p.classId,classroom);
   if(p.action==='teacher-overview')return answer(teacherData);
   if(p.action==='teacher-summary')return answer({ok:true,students:[{
    id:student,name:'Élève fictif',recent:record.recent,bestPoints:null,todayBest:null
   }]});
   if(p.action==='teacher-detail')return answer({ok:true,name:'Élève fictif',state:record});
   if(p.action==='teacher-parcours-history')return answer({ok:true,current:{parcours_number:1,repeat_xp:false},history:[]});
   throw Error('Unexpected teacher results action: '+p.action);
  });
  await page.goto(origin+'/?portail=prof&profClass='+classroom,
   {waitUntil:'domcontentloaded'});
  await page.locator('.results-overview-table').waitFor({timeout:20000});
  assert.equal(interceptedTeacherModule,enabled,'test must override the actual versioned app.js URL');
  const labels=await page.locator('.results-overview-table thead th').allTextContents();
  assert.ok(labels.some(x=>x==='Élève'));
  assert.equal(labels.some(x=>x.includes('Addition de plusieurs nombres')),enabled,
   'new game column must remain hidden until test-only flag is lifted');
  const selector=page.locator('#results-app option[value="addition-ecrite-multiple"]');
  assert.equal(await selector.count(),Number(enabled));
  if(enabled){
   const button=page.getByRole('button',{
    name:'Voir les résultats de Élève fictif dans Addition de plusieurs nombres'
   });
   await button.click();
   const table=page.locator('#results-student-content .result-table');
   await table.waitFor();
   const rows=await table.locator('tr').allTextContents();
   assert.match(rows.join(' | '),/4\/4/);
   assert.match(rows.join(' | '),/8\/10/);
   assert.match(rows.join(' | '),/19\/20/);
   assert.match(rows.join(' | '),/3\/5/);
   assert.match(rows.join(' | '),/7/);
   assert.ok(await page.locator('#results-student-content').getByText(/Recommencer/).count(),
    'individual restart controls must be scoped to selected app');
   await page.locator('#results-back').click();
   await page.locator('#results-app').selectOption('addition-ecrite-multiple');
   await page.waitForFunction(()=>
    document.getElementById('results-class-restart')?.hidden===false,{timeout:12000});
   assert.ok(edgeCalls.some(c=>c.action==='teacher-summary'&&c.appKey==='addition-ecrite-multiple'));
  }
  assert.ok(edgeCalls.some(c=>c.action==='teacher-overview'));
  assert.ok(!edgeCalls.some(c=>c.action?.includes('restart')),
   'rendering must not trigger teacher restart write');
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('PASS professor UI Chromium: disabled 4th app invisible, authorized test flag shows fake student, 4/4 and 3/5 results, scoped reset controls; zero writes');
}finally{await browser.close()}
