// Same-origin navigation beside the native Fullscreen button.
// This remains available in free/demonstration mode, independently of Connect auth.
(function(){
 'use strict';
 function hubHref(){
  const hub=new URL('../../../../hub.html',location.href);
  let context=location;
  try{if(parent!==window&&parent.location.origin===location.origin)context=parent.location;}catch{}
  const args=new URL(context.href).searchParams;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(uuid.test(args.get('class')||''))hub.searchParams.set('class',args.get('class'));
  if(args.get('joueur')==='prof')hub.searchParams.set('joueur','prof');
  return hub.href;
 }
 function install(frame){
  const doc=frame?.contentDocument;
  const actions=doc?.querySelector('.mathas-top-actions');
  const fullscreen=actions?.querySelector('#fullscreenBtn');
  if(!actions||!fullscreen||doc.getElementById('mathas-game-hub-return'))return;
  const link=doc.createElement('a');
  link.id='mathas-game-hub-return';
  link.href=hubHref();
  link.target='_top';
  link.rel='noopener';
  link.textContent='↩ Retour au HUB';
  link.setAttribute('aria-label','Retour au HUB Math’as Connect');
  const style=doc.createElement('style');
  style.id='mathas-game-hub-return-style';
  style.textContent=`
    .mathas-top-actions{position:relative!important}
    .mathas-top-actions > #mathas-game-hub-return{
      position:absolute!important;top:0!important;right:calc(100% + 9px)!important;
      display:inline-flex!important;align-items:center!important;justify-content:center!important;
      box-sizing:border-box!important;min-height:42px!important;width:max-content!important;
      max-width:145px!important;padding:7px 10px!important;border-radius:10px!important;
      background:#204664!important;color:#f4faff!important;
      border:1px solid #79a5c7!important;box-shadow:0 4px 8px #0006!important;
      text-decoration:none!important;white-space:nowrap!important;
      font:700 12px system-ui,sans-serif!important;z-index:10100!important;
    }
    .mathas-top-actions > #mathas-game-hub-return:focus-visible{
      outline:3px solid #ffe38b!important;outline-offset:2px!important;
    }
    @media(max-width:560px){
      .mathas-top-actions > #mathas-game-hub-return{
        max-width:112px!important;font-size:10px!important;padding:6px!important;
        min-height:40px!important;right:calc(100% + 6px)!important;
      }
    }
  `;
  doc.head.append(style);
  actions.insertBefore(link,fullscreen);
 }
 window.MathasAttachNativeHubLink=function(frame){
  if(!frame)return;
  // Navigation requires a real click; scripts may never auto-navigate the top page.
  frame.sandbox?.add('allow-top-navigation-by-user-activation');
  frame.addEventListener('load',()=>install(frame));
  try{install(frame)}catch{}
 };
})();
