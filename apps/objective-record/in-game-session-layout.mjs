// Align the ORIGINAL pupil exercise toolbar, without modifying game scripts.
// In large viewports the level/progress/score/ruler/tens controls move left,
// manual validation expands to the right, and the three native hearts occupy
// the centered gap between Menu and Niveau. The phone portrait layout and its
// sticky score strip remain owned by the historical engine.
const ID='mathas-session-toolbar-layout-v1';
const CONFIRMED=new Set(['addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple','multiplication-ecrite-simple']);
const CSS=`
/* Une ligne véritable, même lorsque le contenu du jeu n'occupe que 1500px
   au sein d'une fenêtre de 1920px. La largeur de la FENÊTRE ne permet pas
   d'inférer celle du jeu. Un écran étroit défile horizontalement dans la
   barre, sans recréer de deuxième ligne ni déranger le mode portrait GSM. */
@media(min-width:1050px){
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  box-sizing:border-box!important;
  display:grid!important;
  grid-template-columns:max-content minmax(182px,1fr) max-content max-content minmax(0,170px) max-content 158px 158px max-content!important;
  grid-template-rows:minmax(66px,auto)!important;
  align-items:center!important;
  column-gap:clamp(4px,.46vw,8px)!important;
  row-gap:0!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
  scrollbar-width:thin;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .activity-session-left{
  grid-area:1/1/2/2!important;min-width:0!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud{
  grid-area:1/2/2/3!important;
  position:static!important;left:auto!important;top:auto!important;
  transform:none!important;
  justify-self:center!important;align-self:center!important;
  margin:0!important;z-index:4!important;
  width:max-content!important;max-width:100%!important;
  min-height:62px!important;padding:4px 8px!important;
  gap:5px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud .demo-heart{
  width:49px!important;height:49px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionLevel{
  grid-area:1/3/2/4!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionProgress{
  grid-area:1/4/2/5!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionScore{
  grid-area:1/5/2/6!important;
  box-sizing:border-box!important;min-width:0!important;
  max-width:170px!important;white-space:normal!important;
  text-align:center!important;line-height:1.15!important;
  font-size:clamp(.87rem,1.05vw,1.02rem)!important;
  padding:6px 7px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #scoreRulerBtn{
  grid-area:1/6/2/7!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-tens-first-during-game{
  grid-area:1/7/2/8!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{
  grid-area:1/8/2/9!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-tens-first-during-game,
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{
  box-sizing:border-box!important;display:inline-flex!important;
  align-items:center!important;justify-content:flex-start!important;
  justify-self:stretch!important;
  flex:0 0 auto!important;width:158px!important;
  min-width:158px!important;max-width:158px!important;
  min-height:38px!important;max-height:none!important;
  padding:5px 6px!important;gap:4px!important;
  font-size:11px!important;line-height:1.1!important;
  white-space:nowrap!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-tens-first-during-game input,
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game input{
  flex:0 0 17px!important;width:17px!important;height:17px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-points-live{
  grid-area:1/9/2/10!important;
  justify-self:end!important;white-space:nowrap!important;
 }
}
/* Portable PC : même ligne, boutons légèrement compacts. Les éléments sont
   tous accessibles par défilement horizontal local si nécessaire. */
@media(min-width:1050px) and (max-width:1599px){
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  grid-template-columns:max-content minmax(158px,1fr) max-content max-content minmax(0,156px) max-content 145px 145px max-content!important;
  column-gap:5px!important;
  padding:7px 8px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud{
  min-height:57px!important;padding:3px 6px!important;gap:4px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud .demo-heart{
  width:46px!important;height:46px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-tens-first-during-game,
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{
  width:145px!important;min-width:145px!important;max-width:145px!important;
  font-size:10.3px!important;padding:5px 5px!important;gap:3px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #scoreRulerBtn{
  font-size:clamp(.76rem,1vw,.95rem)!important;padding-left:8px!important;padding-right:8px!important;
 }
}
/* Soustraction et multiplication : une vraie barre à une ligne, sans déplacer
   les contrôles dans une deuxième rangée. L'aide native est propre au jeu. */
@media(min-width:1050px){
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  box-sizing:border-box!important;display:grid!important;
  grid-template-columns:max-content minmax(170px,1fr) max-content max-content minmax(0,165px) max-content 158px max-content!important;
  grid-template-rows:minmax(66px,auto)!important;align-items:center!important;
  column-gap:clamp(4px,.46vw,8px)!important;row-gap:0!important;
  overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:thin;
 }
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  box-sizing:border-box!important;display:grid!important;
  grid-template-columns:max-content minmax(170px,1fr) max-content max-content minmax(0,165px) max-content 158px 158px max-content!important;
  grid-template-rows:minmax(66px,auto)!important;align-items:center!important;
  column-gap:clamp(4px,.46vw,8px)!important;row-gap:0!important;
  overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:thin;
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar .activity-session-left,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .activity-session-left{
  grid-area:1/1/2/2!important;min-width:0!important;
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud{
  grid-area:1/2/2/3!important;position:static!important;left:auto!important;top:auto!important;
  transform:none!important;display:flex;align-items:center!important;justify-content:center!important;
  justify-self:center!important;align-self:center!important;box-sizing:border-box!important;
  margin:0!important;z-index:4!important;width:max-content!important;max-width:100%!important;
  min-height:62px!important;padding:4px 8px!important;gap:5px!important;
 }
 html.mathas-toolbar-sub #gameScreen #threeLivesHud[hidden],
 html.mathas-toolbar-mul #gameScreen #threeLivesHud[hidden]{display:none!important}
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionLevel,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionLevel{grid-area:1/3/2/4!important}
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionProgress,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionProgress{grid-area:1/4/2/5!important}
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionScore,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionScore{
  grid-area:1/5/2/6!important;box-sizing:border-box!important;min-width:0!important;
  max-width:165px!important;white-space:normal!important;text-align:center!important;
  line-height:1.15!important;font-size:clamp(.85rem,1.05vw,1.02rem)!important;
  padding:6px 7px!important
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar #scoreRulerBtn,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar #tablesBtn{grid-area:1/6/2/7!important}
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{grid-area:1/7/2/8!important}
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-points-live{grid-area:1/8/2/9!important;justify-self:end!important}
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-multi-tens-control{grid-area:1/7/2/8!important}
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{grid-area:1/8/2/9!important}
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-points-live{grid-area:1/9/2/10!important;justify-self:end!important}
 /* Une seule commande Dizaines : celle déjà fournie par le moteur Multiplication.
    L'autre module garde son écouteur interne mais n'affiche pas de doublon. */
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-tens-first-during-game{display:none!important}
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-multi-tens-control,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{
  box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;
  justify-self:stretch!important;flex:0 0 auto!important;width:158px!important;
  min-width:158px!important;max-width:158px!important;
  min-height:38px!important;padding:5px 6px!important;gap:4px!important;
  font-size:11px!important;line-height:1.1!important;white-space:nowrap!important
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game input,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-multi-tens-control input,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game input{
  flex:0 0 17px!important;width:17px!important;height:17px!important
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen #threeLivesHud .demo-heart,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen #threeLivesHud .demo-heart{
  position:relative;display:inline-block;flex:0 0 49px!important;
  width:49px!important;height:49px!important;filter:drop-shadow(0 2px 3px #0005)
 }
 html.mathas-toolbar-sub #gameScreen #threeLivesHud .demo-heart svg,
 html.mathas-toolbar-mul #gameScreen #threeLivesHud .demo-heart svg{width:100%;height:100%;display:block}
 html.mathas-toolbar-sub #gameScreen #threeLivesHud .demo-heart.lost,
 html.mathas-toolbar-mul #gameScreen #threeLivesHud .demo-heart.lost{
  filter:grayscale(1) opacity(.3)!important;transform:scale(.84);transition:filter .22s ease,transform .22s ease
 }
}
@media(min-width:1050px) and (max-width:1599px){
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  grid-template-columns:max-content minmax(150px,1fr) max-content max-content minmax(0,145px) max-content 145px max-content!important;
  column-gap:5px!important;padding:7px 8px!important
 }
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  grid-template-columns:max-content minmax(150px,1fr) max-content max-content minmax(0,145px) max-content 145px 145px max-content!important;
  column-gap:5px!important;padding:7px 8px!important
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-multi-tens-control,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{
  width:145px!important;min-width:145px!important;max-width:145px!important;font-size:10.3px!important;padding:5px!important;gap:3px!important
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen #threeLivesHud .demo-heart,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen #threeLivesHud .demo-heart{
  flex-basis:46px!important;width:46px!important;height:46px!important
 }
 html.mathas-toolbar-sub:not(.mathas-handheld-portrait) #gameScreen .session-bar #scoreRulerBtn,
 html.mathas-toolbar-mul:not(.mathas-handheld-portrait) #gameScreen .session-bar #tablesBtn{
  font-size:clamp(.76rem,1vw,.95rem)!important;padding-left:8px!important;padding-right:8px!important
 }
}
/* Les contrôles du moteur Multiplication incluent deux synchroniseurs de
   préférence. La vraie commande scolaire reste visible sur TOUS les formats. */
html.mathas-toolbar-mul #gameScreen .session-bar .mathas-tens-first-during-game{
 display:none!important
}
/* Sur GSM, le bandeau et les trois pastilles sont répartis par le moteur
   historique ; les cœurs utilisent leur propre emplacement (sans overlay). */
html.mathas-handheld-portrait.mathas-toolbar-sub #gameScreen .session-bar #threeLivesHud,
html.mathas-handheld-portrait.mathas-toolbar-mul #gameScreen .session-bar #threeLivesHud{
 position:static!important;left:auto!important;top:auto!important;
 transform:none!important;box-sizing:border-box!important;
 grid-area:2/1/3/7!important;justify-self:center!important;align-self:center!important;
 margin:5px auto 0!important;min-height:46px!important;
 display:flex!important;justify-content:center!important;align-items:center!important;gap:5px!important
}
html.mathas-handheld-portrait.mathas-toolbar-sub #gameScreen .session-bar #threeLivesHud[hidden],
html.mathas-handheld-portrait.mathas-toolbar-mul #gameScreen .session-bar #threeLivesHud[hidden]{
 display:none!important
}
html.mathas-handheld-portrait.mathas-toolbar-sub #gameScreen #threeLivesHud .demo-heart,
html.mathas-handheld-portrait.mathas-toolbar-mul #gameScreen #threeLivesHud .demo-heart{
 display:inline-block;width:36px!important;height:36px!important;flex:0 0 36px!important
}
/* Source visuelle des trois cœurs du mode 3 vies : décorative, le nombre
   vient des tentatives déjà vérifiées par le moteur, jamais du compteur local XP. */
/* Le moteur historique reste maître de la présentation portrait et de son
   bandeau de score collant : on évite toute collision avec la rangée du haut. */
`;
const HEART_PATH='M30 49C25 45 2 28 2 15 2 6 9 1 17 1c6 0 10 4 13 8 3-4 7-8 13-8 8 0 15 5 15 14 0 13-23 30-28 34Z';
function createHeart(doc,i){
 const item=doc.createElement('span');item.className='demo-heart';item.setAttribute('aria-hidden','true');
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 60 54');svg.setAttribute('focusable','false');
 const path=doc.createElementNS('http://www.w3.org/2000/svg','path');
 path.setAttribute('d',HEART_PATH);path.setAttribute('fill','#e52445');
 path.setAttribute('stroke','#ff97a7');path.setAttribute('stroke-width','1.8');
 svg.append(path);item.append(svg);return item;
}
function syncSchoolSurvivalHearts(doc,appKey){
 const hud=doc.getElementById('threeLivesHud');
 if(!hud||hud.dataset.mathasLayoutOwned!=='1')return;
 const screen=doc.getElementById('gameScreen');
 const mode=(doc.getElementById('sessionMode')?.textContent||'').toLowerCase();
 const score=doc.getElementById('sessionScore')?.textContent||'';
 const certified=doc.defaultView?.__mathasCertifiedSurvivalHud;
 let count=null;
 if(certified?.mode==='three-lives'&&Number.isInteger(certified.remaining))
  count=certified.remaining;
 else if(appKey==='soustraction-ecrite-simple'&&/3 vies/.test(mode)){
  const match=score.match(/[❤♥]\uFE0F?\s*([0-3])/u);
  count=match?Number(match[1]):3;
 }
 const active=count!==null&&screen&&!screen.classList.contains('hidden');
 hud.hidden=!active;
 if(!active)return;
 count=Math.max(0,Math.min(3,count));
 hud.setAttribute('aria-label','Mode 3 vies : '+count+' vie(s) restante(s)');
 if(hud.dataset.mathasLastLives===String(count))return;
 hud.dataset.mathasLastLives=String(count);
 [...hud.children].forEach((heart,i)=>heart.classList.toggle('lost',i>=count));
}
export function installSessionToolbarLayout(doc,appKey){
 if(!CONFIRMED.has(appKey)||!doc?.head||!doc.querySelector('#gameScreen .session-bar'))
  return false;
 const special=appKey==='soustraction-ecrite-simple'?'sub':appKey==='multiplication-ecrite-simple'?'mul':null;
 if(special)doc.documentElement.classList.add('mathas-toolbar-'+special);
 if(!doc.getElementById(ID)){
  const style=doc.createElement('style');style.id=ID;style.textContent=CSS;doc.head.appendChild(style);
 }
 if(special&&!doc.__mathasConfirmedSurvivalHud){
  doc.__mathasConfirmedSurvivalHud=true;
  const bar=doc.querySelector('#gameScreen .session-bar');
  if(!doc.getElementById('threeLivesHud')){
   const hud=doc.createElement('div');
   hud.id='threeLivesHud';hud.dataset.mathasLayoutOwned='1';hud.hidden=true;
   hud.setAttribute('role','img');hud.setAttribute('aria-label','Trois vies');
   for(let i=0;i<3;i++)hud.append(createHeart(doc,i));
   bar.append(hud);
  }
  doc.defaultView?.setInterval?.(()=>syncSchoolSurvivalHearts(doc,appKey),300);
 }
 if(special)syncSchoolSurvivalHearts(doc,appKey);
 return true;
}
