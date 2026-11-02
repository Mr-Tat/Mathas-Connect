import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Navigateur Pages reel. Auth + Edge sont MOCKEES pour ne jamais creer
// d'eleve, de partie ou d'XP dans Supabase.
test('pont pilote : vraie navigation et fin de partie -> recu LAB une seule fois',async()=>{
 const browser=await chromium.launch({headless:true});
 let recorded=0,earned=0;
 const fakeId='00000000-0000-4000-8000-000000000011';
 const page=await browser.newPage({viewport:{width:1240,height:800}});
 try{
  await page.route('https://esm.sh/@supabase/supabase-js@2.95.0',async route=>{
   await route.fulfill({status:200,contentType:'text/javascript',
    headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"test-only",user:{id:"mock-student",is_anonymous:true}}},error:null})}}}'});
  });
  await page.route('https://awmhpfofacaglewammxt.supabase.co/functions/v1/connect-record-pilot',async route=>{
   const body=route.request().postDataJSON();
   assert.equal(body.classId,'4bf3400d-a315-4ea4-a2f3-afaca24dc9b9');
   assert.equal(body.appKey,'addition-ecrite-simple');
   if(body.action==='record'){
    recorded++;
    assert.equal(body.mode,'classic');
    assert.equal(body.level,1);
    assert.equal(body.total,4);
    assert.equal(body.score,4);
    assert.match(body.eventId,/^[0-9a-f-]{36}$/i);
    earned=22;
   }
   const payload={ok:true,studentId:fakeId,pilot:true,revision:recorded,
     xp:earned,earned:earned?{'1:standard:normal:classic:4:perfect':22}:{},
     best:earned?16:0,trophies:earned?['mastery:1:4']:[],recent:[],
     rights:{level:1,ops:[],classic:{'4':earned?0:22,'10':36,'20':60},
       sudden:20,threeLives:10},awarded:body.action==='record'?22:undefined};
   await route.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(payload)});
  });
  const url='https://mr-tat.github.io/Mathas-Connect/essais/objectif-record-pilote.html?app=addition-simple';
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  const inner=page.frameLocator('#gameFrame').frameLocator('#game');
  await inner.locator('#menuScreen .classic-count-btn[data-count="4"]').waitFor({timeout:35000});
  await page.getByText('Moteur prêt',{exact:false}).waitFor({timeout:12000});
  await inner.locator('#menuScreen .classic-count-btn[data-count="4"]').click();
  await inner.locator('body').evaluate(()=>{
    window.MathasLabV2Update?.({mode:'classic',score:4,total:4,level:1,phase:'ended',hard:false,ops:null});
  });
  await page.waitForFunction(()=>document.getElementById('xp')?.textContent==='22',{timeout:12000});
  await page.waitForTimeout(1200);
  assert.equal(recorded,1,'Un seul recu est envoye pour une partie terminee');
 }finally{await page.close();await browser.close()}
});
