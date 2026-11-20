// Fumée Chromium sur l'hôte Objectif record réellement ouvert depuis le HUB.
// Professeur et élève simulés, aucune écriture vers Supabase réel.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const CLASS='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
const AUTH='22222222-2222-4222-8222-222222222222';
async function serve(){
 const server=createServer(async(req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+sep)){res.writeHead(403).end();return}
  try{
   const bytes=await readFile(file);
   const type=({'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript',
    '.png':'image/png','.webp':'image/webp','.css':'text/css'})[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'content-type':type}).end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
for(const [slug,app] of [['addition-simple','addition-ecrite-simple'],
 ['addition-multiple','addition-ecrite-multiple']]){
 for(const teacher of [false,true]){
  test('HUB Objectif record · '+slug+' · '+(teacher?'professeur lanceur':'élève rejoint'),async()=>{
   const {server,url}=await serve();let browser;
   try{
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    const requests=[],errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({
     status:200,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},
     body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+AUTH+'",is_anonymous:'+(!teacher)+'}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:'+(!teacher)+'}},error:null})}}}'
    }));
    await page.route('**/*.supabase.co/**',async route=>{
     const b=route.request().postDataJSON()||{};requests.push({url:route.request().url(),...b});
     let result;
     if(route.request().url().includes('/connect-api')){
      result={ok:true,status:'approved',classId:CLASS,displayName:teacher?'Monsieur T':'Élève TEST'};
     }else if(route.request().url().includes('/connect-results')){
      result=b.action==='student-load'
       ?{ok:true,revision:0,resetEpoch:0,state:{rewards:{version:3}},storageSubject:AUTH}
       :{ok:true,appXp:0,total:0,level:1,max:160,milestones:[],currentMilestones:[]};
     }else if(route.request().url().includes('/connect-projection-v2')){
      result={ok:true,events:[],bestThree:[],todayBest:null,boardBest:0};
     }else if(route.request().url().includes('/connect-guided-written')){
      result={ok:true,active:false};
     }else{
      result={ok:false,error:'unexpected_test_request'};
     }
     await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:JSON.stringify(result)});
    });
    await page.goto(url+'/apps/objective-record/eleve.html?class='+CLASS+'&app='+slug+(teacher?'&joueur=prof':''),
     {waitUntil:'domcontentloaded',timeout:30000});
    const game=page.frameLocator('#gameFrame').frameLocator('#game');
    await game.locator('#mc-guided-bar').waitFor({state:'attached',timeout:30000});
    // On démarre l'exercice guidé natif, pas une session notée.
    await game.locator('#startTraining').evaluate(button=>button.click());
    await game.locator('#gameScreen:not(.hidden)').waitFor({state:'visible',timeout:15000});
    const bar=game.locator('#mc-guided-bar');
    await bar.waitFor({state:'visible',timeout:5000});
    const entry=bar.locator('#mc-guided-entry');
    // Le conteneur porte une classe CSS ; les boutons sont identifiés par libellé.
    const command=bar.getByRole('button',{name:teacher?'Lancer la séance':'Rejoindre la classe'});
    await command.waitFor({state:'visible',timeout:8000});
    assert.equal(await game.locator('.mathas-collective-button').count()>0,true);
    if(!teacher){
     assert.equal(requests.some(x=>x.action==='status'&&x.appKey===app),false,
      'aucun polling élève avant son clic');
     await command.click();
     await page.waitForFunction(()=>true); // laisse le contrôle asynchrone se déclencher
     await game.getByText('Aucune séance collective lancée pour ta classe.',{exact:false}).waitFor({timeout:10000});
     assert.equal(requests.filter(x=>x.action==='status'&&x.appKey===app).length,1);
    }else{
     assert.equal(requests.some(x=>x.action==='start'&&x.appKey===app),false,
      'pas de création de séance sans clic professeur');
    }
    assert.deepEqual(errors,[]);
   }finally{await browser?.close();await new Promise(ok=>server.close(ok))}
  });
 }
}
