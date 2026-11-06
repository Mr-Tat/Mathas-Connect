import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const moduleCode=readFileSync(new URL('../results-overview-sticky.mjs',import.meta.url),'utf8');

for (const width of [1280,390]) {
 test('résultats professeur : scroll page, entête et élève fixes à '+width+'px',async()=>{
  const browser=await chromium.launch({
    headless:true,
    executablePath:process.env.CHROME_BIN||undefined,
    args:['--no-sandbox']
  });
  try {
   const page=await browser.newPage({viewport:{width,height:640}});
   const rows=Array.from({length:35},(_,i)=>
    '<tr><td><button>Élève '+i+'</button></td>'+
    Array.from({length:5},(_,j)=>'<td>Résultat '+i+' / '+j+'</td>').join('')+'</tr>').join('');
   const columns='<th>Élève</th>'+Array.from({length:5},(_,i)=>'<th>Application '+i+'</th>').join('');
   await page.setContent('<div style="height:240px"></div>'+
    '<div id="teacher-results"><div id="results-list">'+
    '<div class="results-overview-scroll" style="width:100%">'+
    '<table class="results-overview-table"><thead><tr>'+columns+'</tr></thead>'+
    '<tbody>'+rows+'</tbody></table></div></div></div>'+
    '<div style="height:900px"></div>');
   await page.addStyleTag({path:new URL('../style.css',import.meta.url).pathname});
   await page.evaluate(async code=>{
     const src=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
     try {
       const mod=await import(src);
       window.__disposeSticky=mod.attachResultsOverviewSticky(
         document.querySelector('.results-overview-scroll'),
         document.querySelector('.results-overview-table')
       );
     } finally {URL.revokeObjectURL(src)}
   },moduleCode);
   const dimensions=await page.evaluate(()=>{
     const w=document.querySelector('.results-overview-scroll');
     return {wrapperHeight:w.clientHeight,wrapperScrollHeight:w.scrollHeight,
       viewportHeight:window.innerHeight,pageHeight:document.documentElement.scrollHeight};
   });
   assert.ok(dimensions.wrapperHeight>dimensions.viewportHeight,'le tableau est plus haut que la fenêtre');
   assert.ok(dimensions.pageHeight>dimensions.viewportHeight,'la page peut défiler');
   assert.ok(Math.abs(dimensions.wrapperScrollHeight-dimensions.wrapperHeight)<3,
    'le tableau ne possède pas de défilement vertical indépendant');
   await page.evaluate(()=>window.scrollTo(0,520));
   await page.waitForTimeout(100);
   let floating=await page.locator('.results-overview-floating-head').evaluate(e=>({
     visible:!e.hidden,top:e.getBoundingClientRect().top,
     first:e.querySelector('th').getBoundingClientRect().left,
     left:e.getBoundingClientRect().left
   }));
   assert.equal(floating.visible,true,'en-tête affiché pendant le scroll page');
   assert.ok(Math.abs(floating.top)<2,'en-tête au sommet de la fenêtre');
   assert.ok(Math.abs(floating.first-floating.left)<3,'colonne Élève fixée initialement');
   await page.evaluate(()=>{
      document.querySelector('.results-overview-scroll').scrollLeft=230;
   });
   await page.waitForTimeout(90);
   const metrics=await page.evaluate(()=>{
      const w=document.querySelector('.results-overview-scroll');
      const h=document.querySelector('.results-overview-floating-head');
      const first=w.querySelector('tbody td:first-child');
      return {scrollLeft:w.scrollLeft,cell:first.getBoundingClientRect().left,
        wrapperLeft:w.getBoundingClientRect().left,cloneFirst:h.querySelector('th').getBoundingClientRect().left,
        floatingLeft:h.getBoundingClientRect().left};
   });
   assert.ok(metrics.scrollLeft>100,'le tableau défile horizontalement');
   assert.ok(Math.abs(metrics.cell-metrics.wrapperLeft)<4,'la première colonne reste fixe');
   assert.ok(Math.abs(metrics.cloneFirst-metrics.floatingLeft)<4,'l’entête Élève reste fixe');
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForTimeout(90);
   assert.equal(await page.locator('.results-overview-floating-head').evaluate(e=>e.hidden),true,
     'l’en-tête ne doit pas flotter après la fin du tableau');
  }finally{await browser.close()}
 });
}
