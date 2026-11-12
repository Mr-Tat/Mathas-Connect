import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../apps/soustraction-simple');
const uuid='f7d3f280-726e-4e61-86d2-13256aac1746';
const cls='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const read=p=>readFileSync(join(root,p),'utf8');
const native=read('game-original.html');
const source=read('collective-native-bridge.js');
const marker="primaryBtn.addEventListener('click',handlePrimary);";
assert.equal(native.split(marker).length,2);
const hook=source+'\nconst oldGuidedNativeHandler=handlePrimary;'
 +'\nhandlePrimary=function(...args){if(window.MathasGuidedBridge?.isCollectiveActive()&&phase==="review"){window.MathasGuidedBridge.onContinue?.();return}return oldGuidedNativeHandler(...args)};'
 +'\nprimaryBtn.addEventListener("click",handlePrimary);';
const patched=native.replace(marker,hook);
const fixture='<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><iframe id="game" src="/native" style="border:0;width:100%;height:95vh"></iframe></body></html>';
function server(){
 return createServer((req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(path==='/fixture'){res.setHeader('content-type','text/html; charset=utf-8');res.end(fixture);return}
  if(path==='/native'){res.setHeader('content-type','text/html; charset=utf-8');res.end(patched);return}
  const file=resolve(root,'.'+decodeURIComponent(path));
  if(!file.startsWith(root+'/')){res.statusCode=403;res.end();return}
  try{
   const data=readFileSync(file);const ext=extname(file).toLowerCase();
   res.setHeader('content-type',ext==='.mjs'||ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.png'?'image/png':ext==='.webp'?'image/webp':'application/octet-stream');
   res.end(data)
  }catch{res.statusCode=404;res.end('not found')}
 });
}
const first=[[{a:'56342',b:'28765'},{a:'54321',b:'12345'}]];
const second=[{a:'34567',b:'4567'},{a:'76543',b:'12345'}];
test('Chromium soustraction : enseignant lance, élève rejoint, page obligatoire bloque', {timeout:120000},async()=>{
 const http=server();
 await new Promise(r=>http.listen(0,'127.0.0.1',r));
 const address=http.address(),url='http://127.0.0.1:'+address.port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined});
 let state=null;
 const clone=x=>JSON.parse(JSON.stringify(x));
 async function api(role,action,payload){
  if(action==='status'||action==='resume')return clone(state??{ok:true,active:false});
  if(action==='heartbeat'||action==='closing')return {ok:true,active:true};
  assert.equal(role,'teacher');
  if(action==='start'){
   state={ok:true,active:true,sessionId:uuid,revision:1,level:payload.level,borrowMethod:payload.borrowMethod,
    pages:clone(first),requiredPages:[false],pageIndex:0};return clone(state);
  }
  if(action==='next'){
   if(state.pageIndex+1<state.pages.length)state.pageIndex++;
   else{state.pages.push(clone(second));state.requiredPages.push(false);state.pageIndex++}
  }else if(action==='previous')state.pageIndex--;
  else if(action==='set-required')state.requiredPages[payload.pageIndex]=payload.required;
  else if(action==='stop'){state.active=false;return {ok:true,active:false}}
  state.revision++;return clone(state);
 }
 async function open(role,existing=null){
  const p=existing||await browser.newPage({viewport:{width:1160,height:900}});
  if(!existing)await p.exposeFunction('__guidedApi',(action,payload)=>api(role,action,payload));
  await p.goto(url+'/fixture');
  await p.waitForFunction(()=>!!document.querySelector('#game')?.contentWindow?.MathasGuidedBridge);
  await p.evaluate(async ({role,cls})=>{
   const {createSubtractionCollective}=await import('/collective-ui.mjs');
   const iframe=document.querySelector('#game');
   window.guidedTest=createSubtractionCollective({
    iframe,teacher:role==='teacher',classId:cls,classLabel:'TEST',
    studentId:role==='student'?'e0a1e106-1f35-45b3-83cf-719c4e6bbdad':'',
    storage:sessionStorage,call:(action,payload)=>window.__guidedApi(action,payload),
    onClose:()=>{}
   });
   window.guidedTest.mount();
  },{role,cls});
  await p.frameLocator('#game').locator('#trainingChoiceBtn').click();
  return p;
 }
 try{
  const teacher=await open('teacher');
  await teacher.frameLocator('#game').getByRole('button',{name:/Lancer la séance/}).click();
  await teacher.frameLocator('#game').getByText(/Guidé collectif · page 1/).waitFor();
  assert.equal(state?.pages?.length,1);
  const student=await open('student');
  await student.frameLocator('#game').getByRole('button',{name:/Rejoindre la classe/}).click();
  const teacherNumbers=await teacher.frameLocator('#game').locator('#calculationsPair .digit').allTextContents();
  const studentNumbers=await student.frameLocator('#game').locator('#calculationsPair .digit').allTextContents();
  assert.deepEqual(studentNumbers,teacherNumbers);
  const input=student.frameLocator('#game').locator('.answer-input[data-calc="0"][data-col="0"]');
  await input.click();
  await student.frameLocator('#game').locator('.num-key[data-key="8"]').click();
  assert.equal(await input.inputValue(),'8');
  await student.waitForFunction(()=>Object.keys(sessionStorage).some(k=>k.includes('guided.draft')));
  await open('student',student);
  await student.frameLocator('#game').getByRole('button',{name:/Rejoindre la classe/}).click();
  await student.frameLocator('#game').locator('.answer-input[data-calc="0"][data-col="0"]').waitFor();
  assert.equal(await student.frameLocator('#game').locator('.answer-input[data-calc="0"][data-col="0"]').inputValue(),'8');
  // Afficher le corrigé uniquement au tableau professeur, sans toucher aux réponses.
  const beforeAnswers=await teacher.frameLocator('#game').locator('.answer-input').evaluateAll(nodes=>nodes.map(x=>x.value));
  await teacher.frameLocator('#game').getByRole('button',{name:/Afficher les réponses/}).click();
  await teacher.frameLocator('#game').getByRole('button',{name:'Oui',exact:true}).click();
  assert.ok(await teacher.frameLocator('#game').locator('.mc-guided-answer-digit').count()>0);
  assert.deepEqual(await teacher.frameLocator('#game').locator('.answer-input').evaluateAll(nodes=>nodes.map(x=>x.value)),beforeAnswers);
  await teacher.frameLocator('#game').getByRole('button',{name:/Masquer les réponses/}).click();
  assert.equal(await teacher.frameLocator('#game').locator('.mc-guided-answer-digit').count(),0);
  await teacher.frameLocator('#game').getByRole('button',{name:/Page obligatoire/}).click();
  await teacher.frameLocator('#game').getByRole('button',{name:/Nouvelle page/}).click();
  await student.frameLocator('#game').getByRole('button',{name:/Suivant|Vérifier la suite/}).click();
  await student.frameLocator('#game').getByText(/Page obligatoire : réussis/).waitFor();
  assert.equal(state.pages.length,2);
  await student.close();await teacher.close();
 }finally{await browser.close();await new Promise(r=>http.close(r))}
});
