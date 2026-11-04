// Lecture du site GitHub Pages public, sans profil réel, compte ni appel en écriture.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const SITE='https://mr-tat.github.io/Mathas-Connect/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const response=await page.goto(SITE+'projection-v2-demo.html?audit='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200,'la démo publique doit répondre HTTP 200');
 await page.waitForFunction(()=>document.querySelectorAll('#ranking-list .entry').length>=8,{timeout:20000});
 await page.waitForFunction(()=>/^\d{2}:\d{2}$/.test(document.querySelector('#projection-clock')?.textContent||''),{timeout:10000});
 const result=await page.evaluate(()=>{
  const header=document.querySelector('header');
  const entries=[...document.querySelectorAll('#ranking-list .entry')];
  const first=entries[0],last=entries[7],points=first.querySelector('.points');
  let transparent=first.querySelector('.projection-avatar.transparent');
  if(!transparent){
   const label=first.querySelector('.player-label')||first.querySelector('.primary');
   transparent=document.createElement('span');transparent.className='projection-avatar transparent';
   transparent.textContent='É';label.prepend(transparent);
  }
  const style=el=>getComputedStyle(el);
  return {
   headerText:header.textContent.trim().replace(/\s+/g,' '),
   clock:document.getElementById('projection-clock').textContent,
   appCount:entries.length,
   firstHeight:first.getBoundingClientRect().height,
   lastHeight:last.getBoundingClientRect().height,
   pointsBackground:style(points).backgroundColor,pointsColor:style(points).color,
   avatarBorder:style(transparent).borderWidth,avatarBorderColor:style(transparent).borderColor,
   avatarBackground:style(transparent).backgroundColor,
   headerButtons:header.querySelectorAll('button').length,
   classText:document.getElementById('header-class')?.textContent,
   demoSidebar:!!document.querySelector('.projection-demo-tools')
  };
 });
 console.log('LIVE_CHROMIUM_PUBLIC_PROJECTION: '+JSON.stringify(result));
 assert.equal(result.classText,'Phase 2 A');
 assert.match(result.clock,/^\d{2}:\d{2}$/);
 assert.equal(result.headerButtons,0,'aucun bouton parasite dans le bandeau');
 assert.ok(result.demoSidebar,'avertissement démo déplacé dans la colonne gauche');
 assert.ok(result.firstHeight>=54&&result.firstHeight<=85,'les cartes ne doivent pas remplir toute la hauteur');
 assert.ok(Math.abs(result.lastHeight-result.firstHeight)<=4,'hauteurs de cartes régulières');
 assert.equal(result.pointsBackground,'rgb(32, 51, 72)');
 assert.equal(result.pointsColor,'rgb(255, 243, 210)');
 assert.equal(result.avatarBorder,'2px');
 assert.notEqual(result.avatarBorderColor,'rgba(0, 0, 0, 0)');
 assert.equal(result.avatarBackground,'rgba(0, 0, 0, 0)');
 await page.screenshot({path:'mathas-live-projection-audit.png',fullPage:true});
 console.log('LIVE_CHROMIUM_SUCCES : rendu public vérifié');
 await page.close();
}finally{await browser.close()}
