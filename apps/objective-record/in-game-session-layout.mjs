// Align the ORIGINAL pupil exercise toolbar, without modifying game scripts.
// In large viewports the level/progress/score/ruler/tens controls move left,
// manual validation expands to the right, and the three native hearts occupy
// the centered gap between Menu and Niveau. The phone portrait layout and its
// sticky score strip remain owned by the historical engine.
const ID='mathas-session-toolbar-layout-v1';
const ADDITIONS=new Set(['addition-ecrite-simple','addition-ecrite-multiple']);
const CSS=`
/* Desktop: one continuous row; the manual checkbox takes the remaining width. */
@media(min-width:1600px){
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  display:grid!important;
  grid-template-columns:max-content minmax(145px,.60fr) max-content max-content max-content max-content max-content minmax(215px,1fr) max-content!important;
  grid-template-rows:minmax(62px,auto)!important;
  column-gap:clamp(5px,.55vw,10px)!important;
  row-gap:0!important;
  align-items:center!important;
  box-sizing:border-box!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .activity-session-left{grid-area:1/1/2/2!important;min-width:0!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud{grid-area:1/2/2/3!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionLevel{grid-area:1/3/2/4!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionProgress{grid-area:1/4/2/5!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionScore{grid-area:1/5/2/6!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #scoreRulerBtn{grid-area:1/6/2/7!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-tens-first-during-game{grid-area:1/7/2/8!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{
  grid-area:1/8/2/9!important;justify-self:stretch!important;
  display:flex!important;align-items:center!important;
  box-sizing:border-box!important;min-width:0!important;max-width:none!important;
  width:100%!important;min-height:38px!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-points-live{grid-area:1/9/2/10!important;justify-self:end!important;white-space:nowrap!important;}
}
/* Smaller laptops: keep the same reading order without clipping controls.
   Only validation + points wrap beneath the row when space is insufficient. */
@media(min-width:1450px) and (max-width:1599px){
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar{
  display:grid!important;
  grid-template-columns:max-content minmax(126px,1fr) repeat(5,max-content)!important;
  grid-template-rows:auto auto!important;
  gap:7px clamp(5px,.5vw,8px)!important;
  box-sizing:border-box!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .activity-session-left{grid-area:1/1/2/2!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud{grid-area:1/2/2/3!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionLevel{grid-area:1/3/2/4!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionProgress{grid-area:1/4/2/5!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #sessionScore{grid-area:1/5/2/6!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #scoreRulerBtn{grid-area:1/6/2/7!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-tens-first-during-game{grid-area:1/7/2/8!important;}
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-manual-validation-during-game{
  grid-area:2/3/3/7!important;min-width:0!important;width:100%!important;
  box-sizing:border-box!important;justify-self:stretch!important;display:flex!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar .mathas-points-live{grid-area:2/7/3/8!important;justify-self:end!important;}
}
/* Cancel the original 43% absolute position of the heart group. Center it
   in the actual free slot after Menu, not over a button or the validation. */
@media(min-width:1450px){
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud{
  position:static!important;left:auto!important;top:auto!important;
  transform:none!important;justify-self:center!important;align-self:center!important;
  margin:0!important;z-index:4!important;
  min-height:48px!important;padding:4px 8px!important;
  gap:5px!important;max-width:100%!important;
 }
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud .demo-heart{
  width:37px!important;height:37px!important;
 }
}
@media(min-width:1400px) and (max-width:1449px){
 html:not(.mathas-handheld-portrait) #gameScreen .session-bar #threeLivesHud{
  position:static!important;left:auto!important;top:auto!important;
  transform:none!important;grid-column:1/-1!important;grid-row:auto!important;
  justify-self:center!important;margin:2px auto!important;
 }
}
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
