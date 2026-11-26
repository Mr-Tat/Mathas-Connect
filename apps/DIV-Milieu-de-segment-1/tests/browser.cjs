/* Recette navigateur locale. npm install --no-save playwright
   npx playwright install chromium ; node tests/browser.cjs */
const {chromium}=require("playwright");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const ctx=await browser.newContext({viewport:{width:1100,height:800},offline:true});
 const page=await ctx.newPage(), errors=[],net=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>{if(/^https?:/.test(r.url()))net.push(r.url())});
 page.on("dialog",d=>d.accept());
 const url=pathToFileURL(path.join(__dirname,"..","index.html")).href;
 await page.goto(url);assert.equal(await page.locator("#practice").count(),0,"pas de mode test en version élève");
 await page.goto(url);
 await page.locator('[data-start="even"]').click();
 for(let series=0;series<2;series++){
   if(series)await page.locator('[data-start="even"]').click();
   for(let p=0;p<2;p++){
     const answers=await page.evaluate(()=>pageItems().map(q=>fmt(q.n/2)));
     for(let i=0;i<5;i++)await page.locator('input[data-field="answer"]:not([readonly])').nth(i).fill(answers[i]);
     await page.locator("#ok").click();
     assert.equal(await page.locator("#ok").innerText(),"Page suivante →");
     await page.locator("#ok").click();
   }
   await page.locator("#back").click();
 }
 assert.equal(await page.locator('[data-start="odd"]').isEnabled(),true);
 assert.equal(await page.evaluate(()=>progress.cups.even),true);
 await page.goto(url+"?test=1");await page.locator("#practice").click();
 await page.locator('[data-start="odd"]').click();
 await page.locator('[data-help="0"][data-kind="manip"]').click();
 const drag=page.locator('[data-drag="0"]'), b=await drag.boundingBox();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
 await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2+40,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>run.q[0].removed),1);
 await page.locator('[data-undo="0"]').click();
 assert.equal(await page.evaluate(()=>run.q[0].removed),0);
 await page.locator("#home").click();await page.locator("#discard").click();
 await page.locator('[data-start="decimal"]').click();
 await page.locator('[data-help="0"][data-kind="decomp"]').click();
 await page.locator('[data-help="0"][data-kind="manip"]').click();
 assert.equal(await page.locator('[data-i="0"][data-field="partA"]').count(),1);
 for(const width of [390,320]){
   await page.setViewportSize({width,height:740});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"débordement décimal "+width);
 }
 await page.setViewportSize({width:1100,height:800});
 await page.locator("#home").click();await page.locator("#discard").click();
 await page.locator('[data-start="g3"]').click();
 const n=await page.evaluate(()=>current().n);
 async function pick(mm){
   const hit=await page.locator("#rulerHit").boundingBox();
   await page.mouse.move(hit.x+(5+mm*4)*hit.width/810,hit.y+hit.height/2);
   await page.locator('#lens [data-tick="'+mm+'"]').click();
 }
 await pick(n);
 assert.equal(await page.locator('input[data-field="measure"]').inputValue(),"");
 await page.locator('input[data-field="measure"]').fill(String(n/10).replace(".",","));
 await page.locator("#ok").click();
 await page.locator('input[data-field="answer"]').fill(String(n/20).replace(".",","));
 await page.locator("#ok").click();
 await pick(n/2);
 assert.equal(await page.evaluate(()=>current().done&&run.correct===1),true);
 await page.locator("#ok").click();
 await page.reload();await page.locator("#resume").click();
 assert.equal(await page.evaluate(()=>run.index===1),true);
 await page.locator("#home").click();await page.locator("#discard").click();
 await page.setViewportSize({width:320,height:740});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"débordement menu");
 assert.deepEqual(errors,[]);assert.deepEqual(net,[]);
 console.log("Chromium : menu, deux séries, glisser, aides décimales, 320/390 px, loupe, mesure, milieu, reprise et accès hors ligne OK.");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
