/* Recette navigateur locale. npm install --no-save playwright
   npx playwright install chromium ; node tests/browser.cjs */
const {chromium}=require("playwright");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const assert=require("node:assert/strict");
const http=require("node:http"),fs=require("node:fs");
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
 // DA : matériaux distincts, texture intégrée et lisibilité à toutes les tailles.
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundImage.includes("data:image/svg+xml")),true,"grain local du fond");
 const skins=await page.evaluate(()=>[".integers",".decimals",".segments"].map(sel=>getComputedStyle(document.querySelector(sel)).backgroundImage));
 assert.equal(new Set(skins).size,3,"trame distincte par famille");
 assert.equal(await page.locator('[data-start="even"]').evaluate(el=>getComputedStyle(el).backgroundImage.includes("data:image/svg+xml")),true,"carte texturée");
 assert.equal(await page.locator('[data-start="even"] .activity-title').evaluate(el=>el.nextElementSibling.classList.contains("activity-example")),true);
 assert.equal(await page.locator('[data-start="gi1"] .mini-segment text').count(),3);
 for(const width of [320,390,768,1100]){await page.setViewportSize({width,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"menu DA "+width)}
 await page.setViewportSize({width:1100,height:800});
 await page.locator('[data-start="even"]').click();
 assert.equal(await page.locator('.pad [data-key="7"]').evaluate(el=>getComputedStyle(el).backgroundImage.includes("data:image/svg+xml")),true,"pavé texturé");
 assert.equal(await page.locator('input[data-field="answer"]').first().evaluate(el=>getComputedStyle(el).backgroundImage),"none","champ de réponse uni");
 assert.equal(await page.locator('input[data-i]:not([inputmode="none"])').count(),0);
 const size=await page.locator('[data-key="7"]').boundingBox();assert.ok(size.height>=60&&size.width>=60,"touches agrandies");
 const fields=page.locator('input[data-field="answer"]');
 const vals=await page.evaluate(()=>pageItems().map(q=>fmt(q.n/2)));
 await fields.first().focus();assert.equal(await page.locator("#padOK").innerText(),"Avancer");
 for(let i=0;i<5;i++){await fields.nth(i).fill(vals[i]);assert.equal(await page.locator("#padOK").innerText(),i===4?"Valider":"Avancer");await page.locator("#padOK").click();if(i<4){assert.equal(await fields.nth(i+1).evaluate(el=>document.activeElement===el),true);assert.equal(await page.evaluate(()=>run.q[0].attempts),0,"aucune validation anticipée")}}
 assert.equal(await page.locator("#padOK").innerText(),"Page suivante");assert.equal(await page.evaluate(()=>run.checked),true);await page.locator("#home").click();await page.locator("#discard").click();await page.locator('[data-start="even"]').click();
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
   if(series===0)assert.equal(await page.locator('[data-start="odd"]').isDisabled(),true);
 }
 assert.equal(await page.locator('[data-start="odd"]').isEnabled(),true);
 assert.equal(await page.evaluate(()=>progress.cups.even),true);assert.equal(await page.evaluate(()=>{const x=document.querySelector(".challenge"),y=x.querySelector(".tile");return Math.abs(y.getBoundingClientRect().width/x.getBoundingClientRect().width-.65)<.03}),true,"boutons centrés à 65%");
 await page.goto(url);assert.equal(await page.locator('[data-start="g3"]').isDisabled(),true);
 const master=page.locator("#master"),dialog=page.locator("#masterDialog"),pw=page.locator("#masterPassword");
 assert.equal(await master.innerText(),"M");const masterBox=await master.boundingBox();assert.ok(masterBox.x<=15&&masterBox.y+masterBox.height>=785);
 assert.equal(await page.locator('[data-start="even"] .activity-title').evaluate(el=>el.nextElementSibling.classList.contains("activity-example")),true);
 await master.click();assert.equal(await pw.getAttribute("type"),"password");await pw.fill("incorrect");await pw.press("Enter");assert.equal(await page.locator("#masterError").isVisible(),true);assert.equal(await page.locator('[data-start="g3"]').isDisabled(),true);
 await page.locator("#masterCancel").click();assert.equal(await dialog.isVisible(),false);assert.equal(await pw.inputValue(),"");await master.click();await pw.fill("Thecakeisalie");await pw.press("Enter");assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('[data-start="g3"]').isEnabled(),true);
 await page.locator('[data-start="odd"]').click();
 await page.locator('[data-help="0"][data-kind="manip"]').click();
 const drag=page.locator('[data-drag="0"]'), b=await drag.boundingBox();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
 await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2+40,{steps:8});await page.mouse.up();
 assert.equal(await page.evaluate(()=>run.q[0].removed),1);
 await page.locator('[data-undo="0"]').click();
 assert.equal(await page.evaluate(()=>run.q[0].removed),0);
 await page.locator("#home").click();await page.locator("#discard").click();
 for(const [id,pages] of [["decimal1",1],["decimal2",2],["decimal3",3]]){await page.locator('[data-start="'+id+'"]').click();assert.equal(await page.locator("#master").isVisible(),false);for(let i=0;i<pages;i++){assert.match(await page.locator(".top .muted").innerText(),new RegExp("Page "+(i+1)+" / "+pages));const answers=await page.evaluate(()=>pageItems().map(q=>fmt(q.n/2)));for(let j=0;j<5;j++)await page.locator('input[data-field="answer"]:not([readonly])').nth(j).fill(answers[j]);await page.locator("#ok").click();await page.locator("#ok").click();}assert.equal(await page.locator(".result b").innerText(),"100 %");await page.locator("#back").click();}assert.equal(await page.evaluate(()=>progress.cups.decimal??false),false,"Master sans coupe");
 await page.locator('[data-start="decimal2"]').click();
 await page.locator('[data-help="0"][data-kind="decomp"]').click();
 await page.locator('[data-help="0"][data-kind="manip"]').click();
 assert.equal(await page.locator('[data-i="0"][data-field="partA"]').count(),1);assert.equal(await page.locator('input[data-i]:not([inputmode="none"])').count(),0);
 await page.locator('[data-i="0"][data-field="partA"]').focus();await page.locator("#padOK").click();assert.equal(await page.locator('[data-i="0"][data-field="partB"]').evaluate(el=>document.activeElement===el),true);await page.keyboard.press("Enter");assert.equal(await page.locator('[data-i="0"][data-field="answer"]').evaluate(el=>document.activeElement===el),true);
 await page.locator("#padOK").click();assert.equal(await page.locator('[data-i="1"][data-field="answer"]').evaluate(el=>document.activeElement===el),true);
 for(const width of [390,320]){
   await page.setViewportSize({width,height:740});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"débordement décimal "+width);assert.ok((await page.locator('[data-key="7"]').boundingBox()).height>=60);
 }
 await page.setViewportSize({width:1100,height:800});
 await page.locator("#home").click();await page.locator("#discard").click();
 for(const geometryId of ["gi2","g3"]){
 await page.locator('[data-start="' + geometryId + '"]').click();
 assert.equal(await page.evaluate(()=>run.id==="gi2"?run.q.length===6&&run.q.every(q=>q.n%10===0):run.q.length===10&&run.q.every(q=>q.n%10!==0)),true);
 const n=await page.evaluate(()=>current().n);
 async function pick(mm){
   const hit=await page.locator("#rulerHit").boundingBox();
   await page.mouse.move(hit.x+(5+mm*4)*hit.width/810,hit.y+hit.height/2);
   await page.locator('#lens [data-tick="'+mm+'"]').click();
 }
 await pick(n);
 assert.equal(await page.locator('input[data-field="measure"]').getAttribute("inputmode"),"none");
 assert.equal(await page.locator('input[data-field="measure"]').inputValue(),"");
 await page.locator('input[data-field="measure"]').fill(String(n/10).replace(".",","));
 await page.locator("#ok").click();
 assert.equal(await page.locator('input[data-field="answer"]').getAttribute("inputmode"),"none");
 await page.locator('input[data-field="answer"]').fill(String(n/20).replace(".",","));
 await page.locator("#ok").click();
 await pick(n/2);
 assert.equal(await page.evaluate(()=>current().done&&run.correct===1),true);
 await page.locator("#ok").click();
 await page.reload();await page.locator("#master").click();await page.locator("#masterPassword").fill("Thecakeisalie");await page.locator("#masterPassword").press("Enter");await page.locator("#resume").click();
 assert.equal(await page.evaluate(()=>run.index===1),true);
 assert.equal(await page.evaluate(()=>run.id),geometryId);
 await page.locator("#home").click();await page.locator("#discard").click();
 }
 await page.setViewportSize({width:320,height:740});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,"débordement menu");
 assert.deepEqual(errors,[]);assert.deepEqual(net,[]);
 await page.goto(url+"?requireConnect=1&test=1");assert.equal(await page.locator("[data-start]").count(),0);assert.equal(await page.locator("#practice").count(),0);assert.equal(await page.locator("#master").isVisible(),false);await page.locator("#freeLaunch").click();await page.locator('[data-start="even"]').waitFor();
 const touch=await browser.newContext({viewport:{width:900,height:700},hasTouch:true,offline:true});
 try{const p=await touch.newPage();await p.goto(url);await p.locator('[data-start="even"]').tap();const first=p.locator('input[data-field="answer"]').first();await first.tap();assert.equal(await first.getAttribute("inputmode"),"none");assert.equal(await first.evaluate(el=>document.activeElement===el&&el.readOnly),true);await p.locator('[data-key="7"]').tap();assert.equal(await first.inputValue(),"7");await p.keyboard.press("Backspace");await p.keyboard.type("8");assert.equal(await first.inputValue(),"8");await p.keyboard.press("ArrowLeft");await p.keyboard.press("Delete");assert.equal(await first.inputValue(),"");await p.keyboard.type("1.5");assert.equal(await first.inputValue(),"1,5");await p.locator("#padOK").tap();assert.equal(await p.locator('input[data-field="answer"]').nth(1).evaluate(el=>document.activeElement===el),true)}finally{await touch.close()}
 const server=http.createServer((req,res)=>{const file=new URL(req.url,"http://localhost").pathname.slice(1)||"index.html";if(!["index.html","sw.js","favicon.svg"].includes(file)){res.writeHead(404);res.end();return}res.setHeader("content-type",file==="sw.js"?"text/javascript":file==="favicon.svg"?"image/svg+xml":"text/html");res.end(fs.readFileSync(path.join(__dirname,"..",file)))});
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 const web=await browser.newContext({viewport:{width:390,height:740}});
 try{const p=await web.newPage(),entry="http://127.0.0.1:"+server.address().port+"/index.html";await p.goto(entry);await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await web.setOffline(true);await p.goto(entry+"?hub=toutes");await p.locator('[data-start="even"]').click();await p.locator('input[data-field="answer"]').first().fill("2");await p.reload();await p.locator("#resume").click();assert.equal(await p.locator('input[data-field="answer"]').first().inputValue(),"2");await p.locator("#home").click();assert.equal(await p.locator('[data-start="even"]').isVisible(),true)}finally{await web.close();await new Promise(resolve=>server.close(resolve))}
 // Actual browser routing for both fictive TEST roles, without a live login.
 const routeServer=http.createServer((req,res)=>{const u=new URL(req.url,"http://localhost");if(u.pathname==="/hub.html"){res.setHeader("content-type","text/html");res.end("<h1>HUB fictif</h1>");return}const name=u.pathname.split("/").pop()||"index.html";if(!["index.html","sw.js","favicon.svg"].includes(name)){res.writeHead(404);res.end();return}res.setHeader("content-type",name==="sw.js"?"text/javascript":name==="favicon.svg"?"image/svg+xml":"text/html");res.end(fs.readFileSync(path.join(__dirname,"..",name)))});
 await new Promise(resolve=>routeServer.listen(0,"127.0.0.1",resolve));
 const routeCtx=await browser.newContext({serviceWorkers:"block"});try{
  await routeCtx.route("https://esm.sh/**",r=>r.abort());
  const p=await routeCtx.newPage(),base="http://127.0.0.1:"+routeServer.address().port+"/apps/DIV-Milieu-de-segment-1/index.html",cls="4bf3400d-a315-4ea4-a2f3-afaca24dc9b9";
  for(const role of ["","&joueur=prof"]){
   await p.goto(base+"?hub=toutes&class="+cls+role);
   await p.getByRole("button",{name:"Parcours Connect · TEST"}).click();
   await p.locator("#freeLaunch").waitFor();
   assert.equal(new URL(p.url()).searchParams.get("requireConnect"),"1");
   await p.locator("#freeLaunch").click();await p.getByRole("button",{name:"Parcours Connect · TEST"}).waitFor();
   assert.equal(new URL(p.url()).searchParams.get("class"),cls);
   await p.locator("#hubReturn").click();await p.waitForURL("**/hub.html?**");
   const back=new URL(p.url());assert.equal(back.searchParams.get("class"),cls);assert.equal(back.searchParams.get("toutes"),"1");assert.equal(back.searchParams.get("joueur"),role?"prof":null);
  }
  await p.goto(base+"?hub=toutes&class=71f5f4a5-3f25-4ec7-ac29-c33d2e6b395e");
  assert.equal(await p.getByRole("button",{name:"Parcours Connect · TEST"}).count(),0);
 }finally{await routeCtx.close();await new Promise(resolve=>routeServer.close(resolve))}
 console.log("Chromium : cache web local, refus Connect non certifié, menu, deux séries, glisser, aides décimales, 320/390 px, loupe, mesure, milieu, reprise et accès hors ligne OK.");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
