// Align the ORIGINAL pupil exercise toolbar, without modifying game scripts.
// In large viewports the level/progress/score/ruler/tens controls move left,
// manual validation expands to the right, and the three native hearts occupy
// the centered gap between Menu and Niveau. The phone portrait layout and its
// sticky score strip remain owned by the historical engine.
const ID='mathas-session-toolbar-layout-v1';
const ADDITIONS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
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
/* Le moteur historique reste maître de la présentation portrait et de son
   bandeau de score collant : on évite toute collision avec la rangée du haut. */
`;
export function installSessionToolbarLayout(doc,appKey){
 if(!ADDITIONS.has(appKey)||!doc?.head||!doc.querySelector('#gameScreen .session-bar'))
  return false;
 if(doc.getElementById(ID))return true;
 const style=doc.createElement('style');
 style.id=ID;style.textContent=CSS;
 doc.head.appendChild(style);
 return true;
}
