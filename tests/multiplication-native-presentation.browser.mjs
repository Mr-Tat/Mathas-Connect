import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Le vrai DOM natif V7.0.0 est exécuté ; Connect/XP sont des fixtures locales.
// Aucun JWT, score ou trophée n'est écrit dans Supabase.
const pathMap=new Map([
 ['/apps/multiplication-simple/game-original.html',
  ['../apps/multiplication-simple/game-original.html','text/html; charset=utf-8']],
 ['/apps/multiplication-simple/school-ui.mjs',
  ['../apps/multiplication-simple/school-ui.mjs','text/javascript; charset=utf-8']],
 ['/apps/objective-record/native-connect-bridge.mjs',
  ['../apps/objective-record/native-connect-bridge.mjs','text/javascript; charset=utf-8']]
]);
const server=createServer((req,res)=>{
 const target=pathMap.get(req.url);
 if(!target){res.writeHead(404);res.end();return}
 const [relative,contentType]=target;
 res.writeHead(200,{'content-type':contentType});
 res.end(readFileSync(new URL(relative,import.meta.url)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});

try{
 await test('native school buttons: one official XP badge and cups, no overlap at 320/390/1160px',async()=>{
  const context=await browser.newContext({viewport:{width:320,height:780}});
  const page=await context.newPage();
  try{
   await page.goto(origin+'/apps/multiplication-simple/game-original.html',{waitUntil:'domcontentloaded'});
   await page.locator('#menuScreen .classic-count-btn[data-count]').first().waitFor();
   await page.evaluate(async()=>{
    const {installMultiplicationSchoolUi}=await import('/apps/multiplication-simple/school-ui.mjs');
    const rewards={version:3,
      mastery:{4:[true,false,false],10:[true,false,false],20:[true,false,false]},
      sudden:[false,false,false],
      hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
      scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
    const xp={milestones:[],repeatXp:false,parcours:1};
    window.__installSchool=()=>installMultiplicationSchoolUi(document,{connected:true,rewards,xp});
    window.__installSchool();
   });
   for(const width of [320,390,1160]){
    await page.setViewportSize({width,height:780});
    await page.evaluate(()=>window.__installSchool());
    const state=await page.evaluate(()=>{
     const buttons=[...document.querySelectorAll('#menuScreen .classic-count-btn[data-count]')];
     const rects=buttons.map(btn=>{
      const xp=btn.querySelector(':scope > .mathas-multi-official-xp');
      const cups=btn.querySelector(':scope > .mathas-multi-school-cups');
      const r1=xp?.getBoundingClientRect(),r2=cups?.getBoundingClientRect();
      const area=r1&&r2
       ?Math.max(0,Math.min(r1.right,r2.right)-Math.max(r1.left,r2.left))*
        Math.max(0,Math.min(r1.bottom,r2.bottom)-Math.max(r1.top,r2.top)):null;
      return {n:Number(btn.dataset.count),
        visible:btn.getBoundingClientRect().width>0,
        countXP:btn.querySelectorAll('.mathas-multi-official-xp').length,
        countCups:btn.querySelectorAll('.mathas-multi-school-cups').length,
        text:(btn.textContent.match(/Reste\s+\d+\s+XP/g)||[]).length,
        collision:area
      };
     });
     return {buttons:rects,style:!!document.getElementById('mathas-multi-school-style')};
    });
    assert.equal(state.buttons.length,3,'all native classic buttons must exist');
    for(const row of state.buttons){
     assert.equal(row.countXP,1,JSON.stringify({width,row}));
     assert.equal(row.countCups,1,JSON.stringify({width,row}));
     assert.equal(row.text,1,JSON.stringify({width,row}));
     assert.ok(row.collision!==null&&row.collision<1,JSON.stringify({width,row}));
    }
   }
  }finally{await context.close()}
 });
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
