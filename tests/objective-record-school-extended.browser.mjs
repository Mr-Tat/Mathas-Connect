// Browser E2E using a fake authenticated school account ONLY. No real
// student JWT, no production writes, actual DOM/keyboard and BigInt columns.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {expectedExtendedWidth} from '../apps/objective-record/certified-extended.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const CLASS='8fe170fa-9e8f-4e80-885a-b0ba68026f64';
const PUPIL='11111111-1111-4111-8111-111111111111';
const AUTH='22222222-2222-4222-8222-222222222222';
const SESSION='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REWARDS={version:3,mastery:{'4':[false,false,false],'10':[false,false,false],'20':[false,false,false]},
 sudden:[false,false,false],hardAwards:{bronze:[false,false,false],silver:[false,false,false],gold:[false,false,false]},
 scoreOne:{bronze:false,silver:false,gold:false},unlockedGold:false};
const examples=[
 {slug:'addition-simple',app:'addition-ecrite-simple',mode:'sudden',level:1,wrong:1},
 {slug:'addition-simple',app:'addition-ecrite-simple',mode:'three-lives',level:1,wrong:3},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',mode:'hard-three-lives',level:3,wrong:3},
 {slug:'addition-multiple',app:'addition-ecrite-multiple',mode:'hard-sudden',level:3,wrong:1}
];
for(const item of examples){
 test('school browser certified '+item.slug+' '+item.mode+' early stop, score, XP, projected consent',async()=>{
  const server=createServer(async(req,res)=>{
   const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
   if(!path.startsWith(root+sep)){res.writeHead(403).end();return}
   try{const bytes=await readFile(path);
    res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
    '.png':'image/png','.webp':'image/webp'})[extname(path)]||'application/octet-stream'}).end(bytes)
   }catch{res.writeHead(404).end()}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port;let browser;
  const width=expectedExtendedWidth(item.app,item.mode,item.level);
  const terms=item.app==='addition-ecrite-simple'?2:item.level===3?7:6;
  const number='9'.repeat(width);
  const questions=Array.from({length:120},(_,i)=>({id:'q'+(i+1),op:'add',width,
   addends:Array(terms).fill(number)}));
  const actions=[],errors=[];let recordUnlocked=item.slug!=='addition-simple';
  const slowStart=item.slug==='addition-simple'&&item.mode==='sudden';
  let releaseStart;const startGate=new Promise(resolve=>{releaseStart=resolve});
  let releaseFinish;
  const finishGate=new Promise(resolve=>{releaseFinish=resolve});
  try{
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1160,height:820}});
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/supabase-js@2.95.0*',r=>r.fulfill({status:200,contentType:'text/javascript',
    headers:{'access-control-allow-origin':'*'},
    body:'export function createClient(){return {auth:{getSession:async()=>({data:{session:{access_token:"fake",user:{id:"'+AUTH+'",is_anonymous:true}}}}),getUser:async()=>({data:{user:{id:"'+AUTH+'",is_anonymous:true}},error:null})}}}'
   }));
   await page.route('**/*.supabase.co/**',async r=>{
    const b=r.request().postDataJSON()||{};actions.push(b);
    const part=r.request().url();let ack;
    if(part.includes('/connect-api'))ack={ok:true,status:'approved',classId:CLASS};
    else if(part.includes('/connect-results'))ack=b.action==='student-load'?
     {ok:true,revision:0,resetEpoch:0,state:{rewards:REWARDS,progress:recordUnlocked?{level2:true,level3:true,sudden1:true,sudden2:true,sudden3:true,perfect1:true,perfect2:true,perfect3:true,hard:true}:{},
      classic:recordUnlocked?[{'10':10},{'10':10},{'10':10}]:[{},{},{}],hard:[3,3,0]},storageSubject:PUPIL}:
     {ok:true,appXp:0,total:0,max:594,level:1,milestones:[],currentMilestones:[],
      parcours:1,repeatXp:false};
    else if(part.includes('/connect-projection-v2')){
     if(b.action!=='student-score-history')throw Error('unexpected score action '+b.action);
     ack={ok:true,events:[],bestThree:[],todayBest:null,boardBest:0};
    }
    else if(part.includes('/connect-objective-record-school')){
     if(b.action==='start-extended-proof-v1'){
      assert.equal(b.mode,item.mode);assert.equal(b.level,item.level);
      if(slowStart)await startGate; // keep network pending to test immediate click feedback
      ack={ok:true,sessionId:SESSION,questions,mode:item.mode,level:item.level,width,
       limit:120,revision:0,resetEpoch:0,expiresAt:'2090-12-31T23:59:59Z'};
     }else if(b.action==='finish-extended-proof-v1'){
      assert.equal(b.answers.length,item.wrong);
      assert.ok(b.answers.every(a=>a.digits.every(x=>x==='0')));
      assert.ok(b.answers.every((a,i)=>a.id==='q'+(i+1)));
      ack={ok:true,proofVerified:true,verifiedScore:0,mode:item.mode,attempted:item.wrong,
       revision:1,resetEpoch:0,xp:{delta:0,appXp:0,total:0,level:1}};
      if(item.mode.endsWith('sudden'))await finishGate;
     }else throw Error('unexpected extended action '+b.action);
    }else throw Error('unhandled endpoint '+part);
    await r.fulfill({status:200,contentType:'application/json',
     headers:{'access-control-allow-origin':'*'},body:JSON.stringify(ack)});
   });
   await page.goto(url+'/apps/objective-record/eleve.html?class='+CLASS+'&app='+item.slug,
    {waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,null,{timeout:45000});
   assert.equal(await page.locator('#connect-bar').isVisible(),false,
    'la barre rétractable a disparu du rendu des deux additions');
   assert.equal(await page.locator('#bar-handle').isVisible(),false,
    'pas de poignée repliable');
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return !!doc?.getElementById('mathas-game-hub-return')&&
     !!doc?.getElementById('fullscreenBtn')&&
     !!doc?.getElementById('mathas-native-connect-profile')&&
     !!doc?.getElementById('mathas-native-connect-xp');
   },null,{timeout:16000});
   // Native engines can reconstruct or delay their header. With it hidden,
   // the authenticated host MUST still show a working profile/XP fallback;
   // once it returns, the native badge resumes without two duplicate bars.
   if(item.slug==='addition-simple'&&item.mode==='sudden'){
    await page.evaluate(()=>{
     const d=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     d.querySelector('main.app > header .mathas-brand-row').style.setProperty('display','none','important');
    });
    await page.waitForFunction(()=>document.documentElement.classList.contains('mathas-native-connect-fallback'),null,{timeout:11000});
    assert.equal(await page.locator('#connect-bar').isVisible(),true,
     'profil, niveau et XP restent visibles pendant une reconstruction native');
    assert.equal(await page.locator('#connected-name').textContent(),'Élève');
    await page.evaluate(()=>{
     const d=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     d.querySelector('main.app > header .mathas-brand-row').style.removeProperty('display');
    });
    await page.waitForFunction(()=>!document.documentElement.classList.contains('mathas-native-connect-fallback'),null,{timeout:11000});
    assert.equal(await page.locator('#connect-bar').isVisible(),false,
     'une fois restauré, seul le profil du vrai jeu est affiché');
   }
   for(const viewportWidth of [1160,620,390,320]){
    await page.setViewportSize({width:viewportWidth,height:820});
    await page.waitForTimeout(550);
    const layout=await page.evaluate((viewportWidth)=>{
     const outer=document.getElementById('gameFrame');
     const inner=outer.contentDocument.getElementById('game');
     const doc=inner.contentDocument;
     const o=outer.getBoundingClientRect(),i=inner.getBoundingClientRect();
     const nodes=[doc.getElementById('fullscreenBtn'),
      doc.getElementById('mathas-game-hub-return'),
      doc.querySelector('.mathas-top-actions>.theme-toggle-btn')];
     const points=nodes.map(el=>{
      const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
      const hit=document.elementFromPoint(o.left+i.left+cx,o.top+i.top+cy);
      const inside=doc.elementFromPoint(cx,cy);
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,
       globalX:o.left+i.left+cx,globalY:o.top+i.top+cy,hostHit:hit?.id,
       innerHit:inside===el||el.contains(inside),href:el.getAttribute('href')};
     });
     const launch=doc.querySelector('#menuScreen > .mathas-menu-zone-launch');
     const tensOption=doc.querySelector('#menuScreen > .mathas-addition-secondary-setting');
     const launchRect=launch.getBoundingClientRect(),tensRect=tensOption.getBoundingClientRect();
     const launchMargin=parseFloat(doc.defaultView.getComputedStyle(launch).marginBottom);
     const card=doc.querySelector('#menuScreen .mode-card.sudden');
     const profile=doc.getElementById('mathas-native-connect-profile');
     const xpButton=doc.getElementById('mathas-native-connect-xp');
     const levelBadge=profile.querySelector('.connect-level');
     const levelNumber=levelBadge.querySelector('strong');
     const badgeCss=doc.defaultView.getComputedStyle(levelBadge);
     const numberCss=doc.defaultView.getComputedStyle(levelNumber);
     const row=doc.querySelector('main.app > header .mathas-brand-row');
     const logo=row.querySelector('.mathas-header-wordmark');
     const originalVersion=row.querySelector(':scope > .app-version-pill');
     const title=doc.querySelector('main.app > header .mathas-header-copy h1');
     const titleVersion=title.querySelector('.mathas-connect-title-version');
     const titleVersionRect=titleVersion?.getBoundingClientRect();
     const logoRect=logo.getBoundingClientRect();
     const pr=profile.getBoundingClientRect(), xr=xpButton.getBoundingClientRect();
     return {viewportWidth,points,
      launchBottomMargin:launchMargin,launchToTensGap:tensRect.top-launchRect.bottom,
      tensOptionVisible:tensRect.width>0&&tensRect.height>0,
      profileText:profile.textContent.trim(),profileVisible:pr.width>0&&pr.height>0,
      levelBadgeWidth:levelBadge.getBoundingClientRect().width,
      levelBadgeRight:levelBadge.getBoundingClientRect().right,
      levelBadgeColor:badgeCss.borderTopColor,
      levelBadgeBackground:badgeCss.backgroundImage,
      levelBadgeRadius:badgeCss.borderTopLeftRadius,
      levelNumberFont:parseFloat(numberCss.fontSize),
      levelNumberWeight:numberCss.fontWeight,
      profileInHeader:row.contains(profile),profileRight:pr.right,profileLeft:pr.left,
      profileTop:pr.top,logoRight:logoRect.right,logoTop:logoRect.top,
      originalVersionHidden:doc.defaultView.getComputedStyle(originalVersion).display==='none',
      titleVersionText:titleVersion?.textContent?.trim(),
      originalVersionText:originalVersion?.textContent?.trim(),
      titleVersionInsideTitle:title.contains(titleVersion),
      titleVersionVisible:!!titleVersionRect&&titleVersionRect.width>0&&titleVersionRect.height>0,
      titleVersionRight:titleVersionRect?.right,
      xpLabel:xpButton.textContent.trim(),xpVisible:xr.width>0&&xr.height>0,
      xpBesideProfile:profile.nextElementSibling===xpButton&&profile.parentElement===xpButton.parentElement,
      xpToRight:xr.left>=pr.right-2,
      icon:card.querySelector('.mode-icon')?.textContent?.trim(),
      title:card.querySelector('.mode-title')?.textContent?.trim(),
      description:card.querySelector('.mode-description')?.textContent?.trim(),
      titleHasCup:!!card.querySelector('.mode-title .score-mode-cup'),
      skullInsideButton:!!card.querySelector('#startSudden .score-mode-icon')};
    },viewportWidth);
    assert.ok(layout.launchBottomMargin<=12,
     'l ancienne marge de 72/52px est supprimée : '+JSON.stringify(layout));
    assert.ok(layout.launchToTensGap>=-1&&layout.launchToTensGap<=20,
     'pas de bande vide entre Lance-toi et le réglage dizaines : '+JSON.stringify(layout));
    assert.equal(layout.tensOptionVisible,true,
     'le réglage pédagogique dizaines reste présent : '+JSON.stringify(layout));
    assert.equal(layout.icon,'👑',JSON.stringify(layout));
    assert.equal(layout.title,'Objectif record',JSON.stringify(layout));
    assert.equal(layout.description,'Pour marquer un plus gros score !',JSON.stringify(layout));
    assert.equal(layout.titleHasCup,false);
    assert.equal(layout.skullInsideButton,true);
    assert.equal(layout.profileVisible,true,'profil Connect visible dans entête : '+JSON.stringify(layout));
    assert.equal(layout.profileInHeader,true);
    assert.equal(layout.originalVersionHidden,true,'la version ne doit plus séparer le logo et le profil');
    assert.equal(layout.titleVersionInsideTitle,true,'pastille intégrée au titre de l addition');
    assert.equal(layout.titleVersionVisible,true,'la version doit rester lisible sur PC/GSM');
    assert.match(layout.titleVersionText,/^V\d+(?:\.\d+)+$/,'version native conservée');
    assert.equal(layout.titleVersionText,layout.originalVersionText,'la version affichée correspond au moteur natif');
    if(viewportWidth>=950){
     assert.ok(layout.logoRight<=layout.profileLeft+2,
      'Connect est directement à droite du logo, sans version intermédiaire : '+JSON.stringify(layout));
     assert.equal(layout.xpToRight,true,'XP à droite du cadre Connecté : '+JSON.stringify(layout));
     assert.ok(layout.titleVersionRight<=viewportWidth+2,
      'la version ne dépasse pas la largeur : '+JSON.stringify(layout));
    }
    assert.match(layout.profileText,/^●.*Niveau 1.*0 \/ 50 XP/);
    assert.ok(layout.levelBadgeWidth>=75,'cadre Niveau visible : '+JSON.stringify(layout));
    assert.ok(layout.levelBadgeRight<=viewportWidth+3,'cadre Niveau dans la fenêtre : '+JSON.stringify(layout));
    assert.equal(layout.levelBadgeColor,'rgb(239, 197, 106)','bordure or de l ancien bandeau');
    assert.match(layout.levelBadgeBackground,/linear-gradient/,'cartouche bleu dégradé conservé');
    assert.equal(layout.levelBadgeRadius,'99px');
    assert.ok(layout.levelNumberFont>=23,'chiffre du niveau mis en évidence : '+JSON.stringify(layout));
    assert.equal(Number(layout.levelNumberWeight),900);
    assert.doesNotMatch(layout.profileText,/Connecté ·/,'le nom suffit pour signaler la session');
    assert.equal(layout.xpVisible,true,'bouton XP visible près du profil : '+JSON.stringify(layout));
    assert.equal(layout.xpBesideProfile,true,'bouton XP immédiatement après le profil Connect');
    assert.match(layout.xpLabel,/✨ \d+ \/ \d+ XP récupérés/);
    assert.match(layout.xpLabel,/Voir le détail/);
    const [fullscreen,hub,theme]=layout.points;
    assert.ok(hub.left<fullscreen.left,'Retour au HUB à gauche de Plein écran : '+JSON.stringify(layout));
    assert.ok(Math.abs(fullscreen.top-hub.top)<=2,'boutons d origine côte à côte : '+JSON.stringify(layout));
    assert.ok(theme.top>=fullscreen.bottom-3,'Mode clair sous les deux commandes : '+JSON.stringify(layout));
    for(const point of layout.points){
      assert.ok(point.globalX>0&&point.globalX<viewportWidth,
       'commande dans la largeur visible : '+JSON.stringify(layout));
      assert.equal(point.hostHit,'gameFrame','aucun bandeau au-dessus : '+JSON.stringify(layout));
      assert.equal(point.innerHit,true,'commande cliquable : '+JSON.stringify(layout));
    }
    assert.match(hub.href,/\/hub\.html\?class=/);
   }
   await page.setViewportSize({width:1160,height:820});
   const nativeXp=page.frameLocator('#gameFrame').frameLocator('#game').locator('#mathas-native-connect-xp');
   await nativeXp.click();
   await page.locator('#xp-panel:not([hidden])').waitFor({state:'visible',timeout:12000});
   assert.equal(await page.locator('#connect-bar').isVisible(),false,
    'le panneau XP n ouvre pas la barre disparue');
   await page.locator('#xp-close').click();
   assert.equal(await page.locator('#xp-panel').isVisible(),false);
   await page.setViewportSize({width:1160,height:820});
   const nativeTheme=page.frameLocator('#gameFrame').frameLocator('#game').locator('.theme-toggle-btn');
   await nativeTheme.click({timeout:5000});
   assert.equal(await page.evaluate(()=>document.getElementById('gameFrame').contentDocument
    .getElementById('game').contentDocument.body.classList.contains('light-mode')),true);
   await nativeTheme.click({timeout:5000});
   // Visual contract: a verified pupil never sees the LAB's duplicate
   // "Reste XP" simulation; only one small official badge per native button.
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return !!doc?.querySelector('.classic-count-btn[data-count="10"] .mathas-connect-official-xp');
   },null,{timeout:16000});
   const schoolLayout=await page.evaluate(()=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const classic=doc.querySelector('.classic-count-btn[data-count="10"]');
    const badge=classic.querySelector('.mathas-connect-official-xp');
    const red=doc.querySelector('#startSudden');
    const b=badge.getBoundingClientRect(),r=classic.getBoundingClientRect();
    return {
     fake:doc.querySelectorAll('.classic-xp-remaining,.score-mode-detail,.mathas-pilot-remaining').length,
     badges:classic.querySelectorAll('.mathas-connect-official-xp').length,
     badgePosition:doc.defaultView.getComputedStyle(badge).position,
     bottom:r.bottom-b.bottom,
     right:r.right-b.right,
     redName:red.querySelector('.score-mode-name')?.textContent?.trim(),
     redText:red.textContent,
     threeName:doc.querySelector('#startThreeLives .score-mode-name')?.textContent?.trim(),
     threeLabel:doc.querySelector('#startThreeLives .score-mode-lives-info')?.textContent?.trim(),
     titleRows:[...doc.querySelectorAll('#startThreeLives>.score-mode-title-row,#startSudden>.score-mode-title-row')].length,
     hardLocked:doc.documentElement.classList.contains('mathas-school-hard-locked'),
     hardLevel3Locked:doc.documentElement.classList.contains('mathas-school-hard3-locked')
    };
   });
   assert.equal(schoolLayout.fake,0,'no fake XP line from the LAB preview');
   assert.equal(schoolLayout.badges,1,'one official XP badge per classic button');
   assert.equal(schoolLayout.badgePosition,'absolute','XP belongs to the bottom-right corner');
   assert.ok(schoolLayout.bottom>=-1&&schoolLayout.bottom<=18,JSON.stringify(schoolLayout));
   assert.ok(schoolLayout.right>=-1&&schoolLayout.right<=18,JSON.stringify(schoolLayout));
   assert.equal(schoolLayout.redName,'Mort subite');
   assert.equal(schoolLayout.threeName,'3 vies');
   assert.equal(schoolLayout.threeLabel,undefined,'aucun sous-libellé 3 erreurs possibles');
   assert.equal(schoolLayout.titleRows,2,'normal 3 vies and Mort subite share icon/title layout');
   assert.doesNotMatch(schoolLayout.redText,/Lancer la mort subite/i);
   assert.equal(schoolLayout.hardLocked,item.slug==='addition-simple',
    'HARD hidden until official progression has unlocked it');
   // Reproduce the ACTUAL customer screenshot: a native script rewrites
   // an XP label into plain button text, while an official badge also exists.
   // Removing just .classic-xp-remaining would not fix this.
   await page.evaluate(()=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const button=doc.querySelector('.classic-count-btn[data-count="10"]');
    button.append(doc.createTextNode(' Reste 36 XP'));
    const nested=doc.createElement('span');
    nested.textContent='Reste 36 XP';
    button.append(nested);
   });
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    const button=doc?.querySelector('.classic-count-btn[data-count="10"]');
    return !!button&&(button.textContent.match(/Reste\s+36\s+XP/g)||[]).length===1;
   },null,{timeout:9000});
   // A late native trophy redraw must not re-add fake XP.
   await page.waitForTimeout(1050);
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return !!doc&&doc.querySelectorAll('.classic-xp-remaining,.score-mode-detail,.mathas-pilot-remaining').length===0;
   },null,{timeout:8000});
   // Test actual bounding boxes (not CSS selectors only) on desktop/mobile.
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return !!doc?.querySelector('#startSudden > .mlab-sudden .mlab-cup')&&
     !!doc.querySelector('#startSudden > .mathas-connect-official-xp');
   },null,{timeout:12000});
   for(const viewportWidth of [1160,390]){
    await page.setViewportSize({width:viewportWidth,height:820});
    await page.waitForTimeout(950);
    const boxes=await page.evaluate(()=>{
     const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const red=doc.getElementById('startSudden');
     const xp=red.querySelector(':scope > .mathas-connect-official-xp');
     const cups=red.querySelector(':scope > .mlab-sudden');
     const classical=[...doc.querySelectorAll('.classic-count-btn[data-count]')].map(button=>{
      const label=button.querySelector('.mathas-connect-official-xp');
      const b=button.getBoundingClientRect(),x=label?.getBoundingClientRect();
      return {label:button.textContent,
       paddingTop:parseFloat(doc.defaultView.getComputedStyle(button).paddingTop),
       count:(button.textContent.match(/Reste\s+\d+\s+XP/g)||[]).length,
       inside:!!x&&x.top>=b.top-1&&x.bottom<=b.bottom+1&&x.left>=b.left-1&&x.right<=b.right+1};
     });
     const b=red.getBoundingClientRect(),x=xp.getBoundingClientRect(),c=cups.getBoundingClientRect();
     const three=doc.getElementById('startThreeLives');
     const t=three.getBoundingClientRect(),heartXp=three.querySelector(':scope > .mathas-connect-official-xp')?.getBoundingClientRect();
     const heartInfo=three.querySelector('.score-mode-lives-info');
     const intersects=x.left<c.right-1&&x.right>c.left+1&&x.top<c.bottom-1&&x.bottom>c.top+1;
     return {classic:classical,intersects,
      xpInside:x.left>=b.left-1&&x.right<=b.right+1&&x.top>=b.top-1&&x.bottom<=b.bottom+1,
      cupsInside:c.left>=b.left-1&&c.right<=b.right+1&&c.top>=b.top-1&&c.bottom<=b.bottom+1,
      threeEqualWidth:Math.abs(t.width-b.width)<=2,
      threeEqualHeight:Math.abs(t.height-b.height)<=2,
      threeXpInside:!!heartXp&&heartXp.left>=t.left-1&&heartXp.right<=t.right+1&&heartXp.top>=t.top-1&&heartXp.bottom<=t.bottom+1,
      threeInfoAbsent:!heartInfo&&!three.textContent.includes('3 erreurs possibles'),
      threeXpCount:three.querySelectorAll(':scope > .mathas-connect-official-xp').length,
      rects:{red:{w:b.width,h:b.height},three:{w:t.width,h:t.height},xp:{x:x.x,y:x.y,w:x.width,h:x.height},
       cups:{x:c.x,y:c.y,w:c.width,h:c.height}}};
    });
    for(const b of boxes.classic){
     assert.equal(b.count,1,'only ONE XP indication in '+viewportWidth+'px '+JSON.stringify(b));
      assert.ok(b.paddingTop>=12,'libellés 4/10/20 légèrement descendus : '+JSON.stringify(b));
     assert.equal(b.inside,true,'classic badge stays INSIDE its button '+viewportWidth+'px '+JSON.stringify(b));
    }
    assert.equal(boxes.intersects,false,'Mort subite cups must not cover XP '+viewportWidth+'px '+JSON.stringify(boxes));
    assert.equal(boxes.xpInside,true,'Mort subite XP inside the button '+viewportWidth+'px '+JSON.stringify(boxes));
    assert.equal(boxes.cupsInside,true,'Mort subite trophies inside the button '+viewportWidth+'px '+JSON.stringify(boxes));
    assert.equal(boxes.threeEqualWidth,true,'both normal score buttons have equal width '+viewportWidth+'px '+JSON.stringify(boxes));
    assert.equal(boxes.threeEqualHeight,true,'both normal score buttons have equal height '+viewportWidth+'px '+JSON.stringify(boxes));
    assert.equal(boxes.threeXpCount,1,'one official XP badge on 3 vies');
    assert.equal(boxes.threeXpInside,true,'3 vies XP inside its button '+viewportWidth+'px '+JSON.stringify(boxes));
    assert.equal(boxes.threeInfoAbsent,true,'aucune mention 3 erreurs possibles dans le bouton '+viewportWidth+'px '+JSON.stringify(boxes));
   }
   await page.setViewportSize({width:1160,height:820});
   // Opening the custom Niveau selector must place its portal BELOW the
   // button, never in the header or above the window.
   const nativeMenu=page.frameLocator('#gameFrame').frameLocator('#game');
   await nativeMenu.locator('#menuScreen .slide-select-button').first().click();
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    const menu=doc?.querySelector('.slide-select-menu.mathas-dropdown-portal');
    const button=doc?.querySelector('#menuScreen .slide-select-wrap.open .slide-select-button');
    if(!menu||!button)return false;
    return menu.getBoundingClientRect().top>=button.getBoundingClientRect().bottom;
   },null,{timeout:12000});
   await nativeMenu.locator('#menuScreen .slide-select-button').first().click();

   if(item.slug==='addition-simple'){
    // A new approved pupil cannot launch either Objectif record mode.
    await page.waitForFunction(()=>{
     const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
     return doc?.getElementById('startSudden')?.disabled===true &&
      doc?.getElementById('startThreeLives')?.disabled===true &&
      doc?.getElementById('mathas-school-record-lock')?.hidden===false;
    },null,{timeout:16000});
    const lockedButtons=await page.evaluate(()=>{
     const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     return ['startThreeLives','startSudden'].map(id=>{
      const button=doc.getElementById(id),style=doc.defaultView.getComputedStyle(button);
      return {id,disabled:button.disabled,cursor:style.cursor,transform:style.transform,
       lockClass:button.classList.contains('progress-sudden-locked')};
     });
    });
    for(const button of lockedButtons){
     assert.equal(button.disabled,true,'locked normal score option: '+JSON.stringify(button));
     assert.equal(button.lockClass,true,'same progression lock appearance: '+JSON.stringify(button));
     assert.equal(button.cursor,'not-allowed','disabled score card is not clickable');
     assert.equal(button.transform,'none','locked buttons do not animate on selection');
    }
    assert.equal(actions.filter(a=>a.action==='start-extended-proof-v1').length,0);
    // The same pupil unlocks both modes after a server-verified 8/10.
    // Simulate only the official student-load reply, NEVER a local browser score.
    recordUnlocked=true;
    await page.evaluate(()=>document.getElementById('refresh').click());
    await page.waitForFunction(()=>{
     const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
     return doc?.getElementById('startSudden')?.disabled===false &&
      doc?.getElementById('startThreeLives')?.disabled===false;
    },null,{timeout:16000});
    // The 3-vies button intentionally avoids the old .btn class: the legacy
    // engine selects .btn and rewrites its label. Both score buttons must
    // nevertheless share real 3D face, hover and pressed states in Chromium.
    const inspect3d=()=>page.evaluate(()=>{
     const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const win=doc.defaultView;
     return Object.fromEntries(['startThreeLives','startSudden'].map(id=>{
      const el=doc.getElementById(id),style=win.getComputedStyle(el);
      return [id,{
       text:el.textContent.trim(),classes:el.className,
       hover:el.matches(':hover'),active:el.matches(':active'),
       y:new win.DOMMatrix(style.transform).m42,
       before:win.getComputedStyle(el,'::before').content,
       after:win.getComputedStyle(el,'::after').content,
       afterHeight:win.getComputedStyle(el,'::after').height,
       shadow:style.boxShadow
      }];
     }));
    });
    const base3d=await inspect3d();
    for(const id of ['startThreeLives','startSudden']){
     assert.notEqual(base3d[id].before,'none','reflet 3D visible '+id);
     assert.notEqual(base3d[id].after,'none','tranche 3D visible '+id);
     assert.notEqual(base3d[id].shadow,'none','profondeur 3D visible '+id);
    }
    assert.equal(base3d.startThreeLives.classes.includes('btn'),false,
     '3 vies ne doit pas activer les anciens scripts qui sélectionnent .btn');
    assert.match(base3d.startThreeLives.text,/3 vies/);
    assert.doesNotMatch(base3d.startThreeLives.text,/Moitié des XP/);
    for(const id of ['startThreeLives','startSudden']){
     const target=page.frameLocator('#gameFrame').frameLocator('#game').locator('#'+id);
     await target.hover();
     await page.waitForTimeout(220);
     const hovered=(await inspect3d())[id];
     assert.equal(hovered.hover,true,'vrai survol de '+id);
     assert.ok(hovered.y<=-1,'bouton relevé au survol '+id+' : '+JSON.stringify(hovered));
     await page.mouse.down();
     await page.waitForTimeout(220);
     const pressed=(await inspect3d())[id];
     assert.equal(pressed.active,true,'vrai :active durant le clic '+id);
     assert.ok(pressed.y>=3,'bouton physiquement enfoncé '+id+' : '+JSON.stringify(pressed));
     assert.notEqual(pressed.afterHeight,hovered.afterHeight,
      'la tranche devient moins profonde au clic '+id);
     await page.mouse.move(0,0);
     await page.mouse.up();
    }
    // A real click on either normal score button must issue its specific school
    // proof. No separate "Défi Connect" action is necessary.
    // already defined above as nativeMenu
    await page.evaluate(()=>{
     const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const level=doc.getElementById('suddenMaxDigits');level.value='3';
     level.dispatchEvent(new Event('change',{bubbles:true}));
    });
    const modeButton=item.mode==='three-lives'?'startThreeLives':'startSudden';
    await nativeMenu.locator('#'+modeButton+' .mathas-connect-official-xp').waitFor({state:'visible',timeout:15000});
    assert.match(await nativeMenu.locator('#'+modeButton).textContent(),item.mode==='three-lives'?/Reste 20 XP/:/Reste 40 XP/);
    await nativeMenu.locator('#'+modeButton).click();
    assert.equal(await page.locator('#certified-mode').inputValue(),item.mode);
    if(slowStart){
     const feedback=nativeMenu.locator('#mathas-official-launch-feedback');
     await feedback.waitFor({state:'visible',timeout:4000});
     assert.match(await feedback.textContent(),/Préparation des calculs Connect/);
     // A second real click must NOT start another independent proof.
     await nativeMenu.locator('#'+modeButton).click();
     assert.equal(actions.filter(a=>a.action==='start-extended-proof-v1').length,1,
      'second click during loading must not create a second challenge');
     releaseStart();
    }
   }else{
    // Ouvrir le VRAI menu HARD et utiliser son bouton d'origine.
    await page.evaluate(()=>{
     const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const select=doc.getElementById('trainingMaxDigits');
     const hard=[...select.options].find(x=>x.value==='__hard__');
     if(!hard)throw Error('Le bouton HARD natif est absent');
     select.value=hard.value;select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    const hardMode=item.mode.slice(5);
    await nativeMenu.locator('#hardMenuScreen:not(.hidden)').waitFor({state:'visible',timeout:15000});
    const hardButton=nativeMenu.locator('#hardMenuScreen .hard-start[data-level="'+item.level+'"][data-mode="'+hardMode+'"]');
    await hardButton.waitFor({state:'visible',timeout:15000});
    await hardButton.click();
   }
   // Une série certifiée utilise le VRAI jeu et ne masque plus son iframe.
   await page.waitForFunction(mode=>{
    const host=document.getElementById('gameFrame');
    const w=host?.contentDocument?.getElementById('game')?.contentWindow;
    const d=w?.document;
    const screen=d?.getElementById(mode.startsWith('hard-')?'hardGameScreen':'gameScreen');
    return !!w?.__mathasServerCertifiedExtended?.sessionId &&
     !host.hidden && document.getElementById('extended-certified').hidden &&
     !!screen && !screen.classList.contains('hidden');
   },item.mode,{timeout:18000});
   assert.equal(await nativeMenu.locator('#mathas-official-launch-feedback').count(),0,
    'loading status disappears as soon as the original game starts');
   await page.evaluate(()=>{
    const win=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
    win.__mathasManualValidation=true; // Real keypresses, deliberate checking.
   });
   const nativeVisual=await page.evaluate(mode=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    const active=doc.getElementById(mode.startsWith('hard-')?'hardGameScreen':'gameScreen');
    const proof=doc.defaultView.__mathasServerCertifiedExtended;
    return {native:!active.classList.contains('hidden'),
     inputs:active.querySelectorAll('input.answer-input,input.hard-answer').length,
     hearts:doc.getElementById('threeLivesHud')?.hidden,
     proofMode:proof?.mode,proofWidth:proof?.width,certifiedOverlay:!!doc.getElementById('mathas-certified-survival-screen')};
   },item.mode);
   assert.equal(nativeVisual.native,true,'la vue du jeu historique est utilisée');
   assert.equal(nativeVisual.proofMode,item.mode);
   assert.equal(nativeVisual.proofWidth,width);
   assert.ok(nativeVisual.inputs>=width,'les cases de saisie originales restent présentes');
   assert.equal(nativeVisual.certifiedOverlay,false,'aucun écran de substitution pendant le jeu');
   if(item.mode==='three-lives')assert.equal(nativeVisual.hearts,false,'les cœurs natifs sont visibles');
   if(!item.mode.startsWith('hard-')){
    // Wide-screen native bar: Menu → centered hearts → metrics → stretched
    // manual validation → live points, all on one line (user's screenshot).
    await page.setViewportSize({width:1920,height:900});
    await page.waitForFunction(()=>{
     const d=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
     return !!d?.getElementById('mathas-session-toolbar-layout-v1')&&
      !!d?.querySelector('#gameScreen .mathas-manual-validation-during-game')&&
      !!d?.querySelector('#gameScreen .mathas-points-live');
    },null,{timeout:10000});
    const row=await page.evaluate(()=>{
     const d=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const r=selector=>{
      const x=d.querySelector(selector)?.getBoundingClientRect();
      return x?{left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,
       mid:(x.top+x.bottom)/2,center:(x.left+x.right)/2}:null;
     };
     return {bar:r('#gameScreen .session-bar'),menu:r('#gameScreen #menuBtn'),
      hearts:r('#gameScreen #threeLivesHud'),level:r('#gameScreen #sessionLevel'),
      progress:r('#gameScreen #sessionProgress'),score:r('#gameScreen #sessionScore'),
      ruler:r('#gameScreen #scoreRulerBtn'),tens:r('#gameScreen .mathas-tens-first-during-game'),
      manual:r('#gameScreen .mathas-manual-validation-during-game'),
      points:r('#gameScreen .mathas-points-live'),
      heartsHidden:d.getElementById('threeLivesHud')?.hidden,
      heartIconWidth:d.querySelector('#gameScreen #threeLivesHud .demo-heart')?.getBoundingClientRect().width,
      manualText:d.querySelector('#gameScreen .mathas-manual-validation-during-game span')?.textContent,
      manualOverflow:(()=>{const el=d.querySelector('#gameScreen .mathas-manual-validation-during-game');
       return el?.scrollWidth>el?.clientWidth+2})()};
    });
    assert.ok(row.level.left>row.menu.right,'niveau déplacé à gauche mais après Menu : '+JSON.stringify(row));
    for(const [a,b] of [['level','progress'],['progress','score'],['score','ruler'],['ruler','tens'],['tens','manual'],['manual','points']]){
     assert.ok(row[b].left>=row[a].right-2,a+' doit précéder '+b+' : '+JSON.stringify(row));
    }
    assert.ok(Math.abs(row.manual.width-row.tens.width)<3,
     'Valider les réponses doit avoir la même largeur que Dizaines d’abord : '+JSON.stringify(row));
    assert.ok(row.manual.width<=160,'les deux cases doivent rester compactes : '+JSON.stringify(row));
    assert.equal(row.manualOverflow,false,'la légende Valider les réponses ne doit pas être rognée');
    assert.equal(row.manualText,'Valider les réponses');
    assert.ok(row.points.right<=row.bar.right+3,'le score de jeu tient dans la barre : '+JSON.stringify(row));
    assert.ok(Math.abs(row.manual.mid-row.level.mid)<15,'toutes les commandes doivent être sur la même ligne');
    assert.ok(Math.abs(row.manual.mid-row.points.mid)<15,'les points sont sur la même ligne');
    if(item.mode==='three-lives'){
     assert.equal(row.heartsHidden,false);
     assert.ok(row.hearts.left>=row.menu.right-2&&row.hearts.right<=row.level.left+2,
      'les trois cœurs sont entre Menu et Niveau : '+JSON.stringify(row));
     assert.ok(Math.abs(row.hearts.center-(row.menu.right+row.level.left)/2)<28,
      'les trois cœurs sont centrés dans cet espace : '+JSON.stringify(row));
     assert.ok(Math.abs(row.hearts.mid-row.level.mid)<16,'les trois cœurs sont sur la ligne principale');
     assert.ok(row.heartIconWidth>=48,'les cœurs du mode 3 vies sont agrandis : '+JSON.stringify(row));
    }
    // A 1536px computer display must NEVER revert to the old second row.
    await page.setViewportSize({width:1536,height:820});
    const laptop=await page.evaluate(()=>{
     const d=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const r=s=>d.querySelector(s)?.getBoundingClientRect();
     const level=r('#gameScreen #sessionLevel'),manual=r('#gameScreen .mathas-manual-validation-during-game');
     const points=r('#gameScreen .mathas-points-live');
     const hearts=r('#gameScreen #threeLivesHud'),menu=r('#gameScreen #menuBtn');
     return {levelTop:level?.top,manualTop:manual?.top,
      levelMid:level?(level.top+level.bottom)/2:null,
      pointsMid:points?(points.top+points.bottom)/2:null,
      heartsTop:hearts?.top,heartsHidden:d.getElementById('threeLivesHud')?.hidden,
      menuRight:menu?.right,levelLeft:level?.left,heartsLeft:hearts?.left,heartsRight:hearts?.right};
    });
    assert.ok(Math.abs(laptop.manualTop-laptop.levelTop)<18,
     'à 1536px, Valider les réponses ne doit plus passer sur une deuxième ligne : '+JSON.stringify(laptop));
    assert.ok(Math.abs(laptop.pointsMid-laptop.levelMid)<15,
     'à 1536px, les points sont centrés sur la même ligne : '+JSON.stringify(laptop));
    if(item.mode==='three-lives'){
     assert.ok(Math.abs(laptop.heartsTop-laptop.levelTop)<20,
      'à 1536px, les cœurs ne passent pas sur une deuxième ligne : '+JSON.stringify(laptop));
     assert.ok(laptop.heartsLeft>=laptop.menuRight-3&&laptop.heartsRight<=laptop.levelLeft+3,
      'à 1536px, les cœurs restent entre Menu et Niveau : '+JSON.stringify(laptop));
    }
    await page.setViewportSize({width:1160,height:820});
   }
   await page.setViewportSize({width:390,height:820});
   assert.equal(await page.locator('#gameFrame').isVisible(),true,'le jeu natif reste visible sur mobile');
   await page.setViewportSize({width:1160,height:820});

   // Rejouer les premières tentatives à travers les vrais champs/clavier du jeu.
   for(let i=0;i<item.wrong;i++){
    const hard=item.mode.startsWith('hard-');
    const index=i%2;
    const digitSelector=hard?'#hardGameScreen input.hard-answer':
     '.answer-input[data-calc="'+index+'"]';
    const carrySelector=hard?'#hardGameScreen input.hard-carry':
     '.carry-input[data-calc="'+index+'"]';
    const fields=nativeMenu.locator(digitSelector),carries=nativeMenu.locator(carrySelector);
    const n=await fields.count();
    assert.ok(n>=width,'des chiffres du résultat sont attendus');
    for(let j=0;j<n;j++){await fields.nth(j).focus();await page.keyboard.press('0')}
    const m=await carries.count();
    for(let j=0;j<m;j++){await carries.nth(j).focus();await page.keyboard.press('0')}
    if(hard){
     await nativeMenu.locator('#hardPrimary').click();
     if(i<item.wrong-1)await nativeMenu.locator('#hardPrimary').click();
    }else{
     await nativeMenu.locator('#primaryBtn').click();
     if(i===1&&i<item.wrong-1)await nativeMenu.locator('#primaryBtn').click();
    }
    await page.waitForFunction(expected=>{
     const win=document.getElementById('gameFrame').contentDocument.getElementById('game').contentWindow;
     return win.__mathasServerCertifiedExtended?.index>=expected;
    },i+1,{timeout:5000});
   }
   try{
    await page.waitForFunction(()=>{
     const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
     return !!doc?.getElementById('mathas-certified-survival-screen');
    },null,{timeout:15000});
   }catch(error){
    const debug=await page.evaluate(()=>{
     const inner=document.getElementById('gameFrame')?.contentDocument?.getElementById('game');
     const doc=inner?.contentDocument,win=inner?.contentWindow;
     const proof=win?.__mathasServerCertifiedExtended;
     return {proof,phase:document.getElementById('extended-certified')?.dataset.phase,
      hostStatus:document.getElementById('status')?.textContent,
      nativeFeedback:doc?.getElementById('feedback')?.textContent,
      primary:doc?.getElementById('primaryBtn')?.textContent,
      statuses:[...doc?.querySelectorAll('#calculationsPair .calc-status')||[]].map(x=>x.textContent)};
    });
    throw Error('Certification sans résultat natif : '+JSON.stringify(debug)+' '+error.message);
   }
   if(item.mode.endsWith('sudden')){
    const before=await page.evaluate(()=>{
     const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
     const node=doc.getElementById('mathas-certified-survival-screen');
     return {label:node.textContent,phase:document.getElementById('extended-certified').dataset.phase};
    });
    assert.equal(before.phase,'saving');
    assert.match(before.label,/Vérification du résultat/i);
    assert.doesNotMatch(before.label,/Résultat officiel Connect/i,
     'le score officiel attend le reçu du serveur');
    releaseFinish();
   }
   await page.waitForFunction(()=>{
    const doc=document.getElementById('gameFrame')?.contentDocument?.getElementById('game')?.contentDocument;
    return doc?.getElementById('mathas-certified-survival-screen')?.textContent.includes('Résultat officiel Connect');
   },null,{timeout:18000});
   const official=await page.evaluate(()=>{
    const doc=document.getElementById('gameFrame').contentDocument.getElementById('game').contentDocument;
    return doc.getElementById('mathas-certified-survival-screen').textContent;
   });
   assert.match(official,/Partie vérifiée par Connect/);
   assert.match(official,/XP officiels/);
   assert.equal(actions.filter(a=>a.action==='finish-extended-proof-v1').length,1);
   assert.equal(actions.filter(a=>a.action==='game-record').length,0);
   // Switching straight from a finished extended mode to the other addition
   // must never leave the shared certified start button disabled.
   const other=item.slug==='addition-simple'?'addition-multiple':'addition-simple';
   await page.evaluate(other=>{
    const select=document.getElementById('app');
    select.value=other;select.dispatchEvent(new Event('change',{bubbles:true}));
   },other);
   await page.waitForFunction(()=>!document.getElementById('certify').disabled,
    null,{timeout:35000});
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(ok=>server.close(ok))}
 });
}
