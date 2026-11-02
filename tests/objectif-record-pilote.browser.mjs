import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Contrat Chromium heberge avec Auth/Edge simulees : aucune connexion ni ecriture
// Supabase reelle. Ce n'est PAS la recette authentifiee du professeur.
const url='https://mr-tat.github.io/Mathas-Connect/essais/objectif-record-pilote.html';
const fakeStudent='11111111-1111-4111-8111-111111111111';
const apps=['addition-simple','addition-multiple','soustraction','multiplication','melange'];
test('cinq moteurs publies, pont iframe et XP projetes depuis la reponse serveur',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  const exceptions=[];
  page.on('pageerror',error=>exceptions.push(String(error.message)));
  const calls=[];
  let earned=0;
  // Blocage de toute requete directe au vrai projet pour cette recette simulee.
  await page.route('**/*.supabase.co/**',route=>route.abort());
  await page.route('**/functions/v1/connect-record-pilot',async route=>{
    const b=route.request().postDataJSON();
    assert.equal(b.classId,'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9');
    assert.ok(b.appKey);
    const common={ok:true,studentId:fakeStudent,revision:earned?1:0,
      xp:earned,best:earned?45:0,trophies:[],recent:earned?[{eventId:'fixture'}]:[]};
    if(b.action==='record'){
      calls.push(b);earned+=5;
      return route.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},
        body:JSON.stringify({ok:true,awarded:5,points:45,revision:1,
          xp:earned,best:45,trophies:[],earned:{}})});
    }
    assert.equal(b.action,'load');
    return route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({...common,rights:Number.isInteger(b.level)?
        {level:b.level,ops:b.ops||[],classic:{4:22,10:36,20:60},threeLives:10,sudden:20}:null})});
  });
  await page.route('**/supabase-js@2.95.0',route=>route.fulfill({
    status:200,contentType:'text/javascript',
    headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+fakeStudent+'",is_anonymous:true}}}})}}}'
  }));
  // La page et les cinq moteurs proviennent de Pages, le pont JS du SHA teste
  // est injecte depuis la branche pour ne pas attendre la fusion GitHub Pages.
  const candidate=readFileSync(new URL('../essais/objectif-record-pilote.js',import.meta.url),'utf8');
  await page.route('**/essais/objectif-record-pilote.js',route=>route.fulfill({
    status:200,contentType:'text/javascript',
    headers:{'access-control-allow-origin':'*'},body:candidate
  }));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
  for(const app of apps){
    await page.locator('#app').selectOption(app);
    try{
      await page.waitForFunction(()=>{
        const body=document.querySelector('#gameFrame')?.contentDocument;
        const inner=body?.getElementById('game')?.contentDocument;
        return inner?.querySelector('#menuScreen')&&
          [...inner.querySelectorAll('#menuScreen .mathas-pilot-remaining')]
            .filter(n=>/Reste (22|36|60|10|20) XP/.test(n.textContent)).length>=3;
      },null,{timeout:20000});
    }catch(error){
      const diag=await page.evaluate(()=>{
        const outer=document.querySelector('#gameFrame');
        let first=null,second=null,labels=[];
        try{first=outer?.contentDocument;second=first?.getElementById('game')?.contentDocument;
          labels=[...(second?.querySelectorAll('#menuScreen .mathas-pilot-remaining')||[])].map(x=>x.textContent)}
        catch(e){return {crossOrigin:String(e)}}
        return {status:document.querySelector('#status')?.textContent,
          topSrc:outer?.getAttribute('src'),first:!!first,second:!!second,
          menu:!!second?.querySelector('#menuScreen'),labels,
          state:window.MathasPilotState};
      });
      throw Error(app+' '+String(error)+' DIAG '+JSON.stringify(diag)+' ERR '+exceptions.join(' | '));
    }
    const values=await page.evaluate(()=>{
      const doc=document.querySelector('#gameFrame').contentDocument.getElementById('game').contentDocument;
      return [...doc.querySelectorAll('#menuScreen .mathas-pilot-remaining')].map(el=>el.textContent);
    });
    for(const xp of [22,36,60])assert.ok(values.includes('Reste '+xp+' XP'),app+': '+values.join(' | '));
    assert.equal(await page.locator('#app').inputValue(),app);
    assert.equal(await page.evaluate(()=>window.MathasPilotState?.active),true);
    assert.ok(!exceptions.length,app+': '+exceptions.join(' | '));
  }
  // Simulation d'un message terminal : prouve la plomberie, pas les reponses de calcul.
  await page.locator('#app').selectOption('addition-simple');
  await page.waitForFunction(()=>{
    const doc=document.querySelector('#gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return !!doc?.querySelector('#menuScreen .mathas-pilot-remaining') &&
      typeof doc.defaultView.MathasLabV2Update==='function';
  },null,{timeout:45000});
  await page.evaluate(()=>{
    const doc=document.querySelector('#gameFrame').contentDocument.getElementById('game').contentDocument;
    const g=doc.querySelector('#gameScreen'),m=doc.querySelector('#menuScreen');
    m?.classList.add('hidden');g?.classList.remove('hidden');
  });
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Partie de test en cours'),
    null,{timeout:10000});
  await page.evaluate(()=>{
    const doc=document.querySelector('#gameFrame').contentDocument.getElementById('game').contentDocument;
    const button=doc.querySelector('#gameScreen #primaryBtn');
    if(button)button.textContent='Retour au menu';
    doc.defaultView.MathasLabV2Update({mode:'three-lives',level:1,score:5,
      total:null,ops:null,phase:'ended',hearts:0,completed:8,hard:false});
  });
  try{
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Partie enregistrée'),
      null,{timeout:15000});
  }catch(e){
    const diag=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,
      running:document.querySelector('#gameFrame')?.contentDocument?.getElementById('game')?.contentDocument
        ?.getElementById('gameScreen')?.className}));
    throw Error('End-of-game mock failed '+JSON.stringify({diag,calls,errors:exceptions}));
  }
  assert.equal(calls.length,1,'Un seul evenement final transmis');
  assert.equal(calls[0].mode,'three-lives');
  assert.equal(calls[0].hearts,0);
  assert.equal(calls[0].completed,8);
  assert.ok(!exceptions.length,exceptions.join(' | '));
 }finally{await browser.close()}
});
