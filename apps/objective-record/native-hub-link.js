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
 function installEmbeddedConnectHud(frame){
  const doc=frame?.contentDocument;
  if(!doc||new URL(location.href).searchParams.get('connect')!=='1')return;
  let host;
  try{
    host=parent.document;
    if(!host.documentElement.classList.contains('mathas-native-connect-hud'))return;
  }catch{return}
  const style=doc.createElement('style');
  style.id='mathas-embedded-connect-hud-style';
  style.textContent=`
    .mathas-brand-row #mathas-native-connect-profile{
      display:inline-flex!important;align-items:center!important;flex-wrap:wrap!important;
      gap:6px 12px!important;max-width:min(100%,440px)!important;min-height:38px!important;
      padding:6px 10px!important;margin:0!important;box-sizing:border-box!important;
      border:1px solid rgba(116,171,197,.48)!important;border-radius:11px!important;
      background:linear-gradient(115deg,rgba(20,62,86,.92),rgba(13,43,65,.94))!important;
      color:#e8f5ff!important;box-shadow:0 4px 13px rgba(0,0,0,.20)!important;
      font:700 12px system-ui,sans-serif!important;line-height:1.2!important
    }
    #mathas-native-connect-profile .connect-identity{
      display:inline-flex!important;gap:5px!important;align-items:center!important;
      max-width:190px!important;min-width:0!important;white-space:nowrap!important
    }
    #mathas-native-connect-profile .connect-presence{color:#70e3ae!important;flex:none!important}
    #mathas-native-connect-profile .connect-person{
      max-width:140px!important;overflow:hidden!important;text-overflow:ellipsis!important
    }
    #mathas-native-connect-profile .connect-level{white-space:nowrap!important;color:#ffe7a4!important}
    #mathas-native-connect-profile .connect-level strong{font-size:17px!important;color:#ffe8a4!important}
    #mathas-native-connect-profile .connect-meter{
      display:grid!important;gap:3px!important;min-width:98px!important;
      max-width:145px!important;flex:1 1 98px!important;font:650 10px system-ui,sans-serif!important
    }
    #mathas-native-connect-profile .connect-track{
      height:8px!important;border:1px solid #658da5!important;background:#0c2638!important;
      border-radius:99px!important;overflow:hidden!important
    }
    #mathas-native-connect-profile .connect-fill{
      display:block!important;height:100%!important;width:0;
      background:linear-gradient(90deg,#d9a336,#ffe18b)!important
    }
    #menuScreen #mathas-native-connect-xp{
      box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;
      justify-content:center!important;min-height:39px!important;min-width:152px!important;
      width:max-content!important;max-width:100%!important;margin:8px 0 6px 12px!important;
      padding:8px 13px!important;border:1px solid #c9a45b!important;border-radius:10px!important;
      background:linear-gradient(150deg,#685020,#4f3918)!important;color:#fff1bf!important;
      box-shadow:0 3px 11px rgba(0,0,0,.24)!important;
      font:750 12px system-ui,sans-serif!important;cursor:pointer!important
    }
    #menuScreen #mathas-native-connect-xp:hover{filter:brightness(1.11)!important}
    #menuScreen #mathas-native-connect-xp:focus-visible{outline:3px solid #ffe489!important;outline-offset:2px!important}
    @media(max-width:700px){
      .mathas-brand-row #mathas-native-connect-profile{max-width:100%!important;gap:5px 9px!important;padding:6px 8px!important}
      #mathas-native-connect-profile .connect-identity{max-width:155px!important;font-size:11px!important}
      #mathas-native-connect-profile .connect-person{max-width:106px!important}
      #menuScreen #mathas-native-connect-xp{min-width:140px!important;margin-left:5px!important}
    }
    @media(max-width:440px){
      .mathas-brand-row #mathas-native-connect-profile{width:100%!important}
      #mathas-native-connect-profile .connect-meter{max-width:110px!important}
    }
    body.light-mode #mathas-native-connect-profile,body.light #mathas-native-connect-profile{
      background:#e4f2fa!important;border-color:#8ab3cc!important;color:#14364f!important
    }
    body.light-mode #mathas-native-connect-profile .connect-level,
    body.light #mathas-native-connect-profile .connect-level,
    body.light-mode #mathas-native-connect-profile .connect-level strong,
    body.light #mathas-native-connect-profile .connect-level strong{color:#744e0e!important}
  `;
  doc.head.append(style);
  let ticker;
  const update=()=>{
    if(frame.contentDocument!==doc){clearInterval(ticker);return}
    const row=doc.querySelector('main.app > header .mathas-brand-row');
    if(row&&!doc.getElementById('mathas-native-connect-profile')){
      const profile=doc.createElement('div');
      profile.id='mathas-native-connect-profile';
      profile.setAttribute('aria-label','Profil et progression Math’as Connect');
      profile.innerHTML='<span class="connect-identity"><span class="connect-presence" aria-hidden="true">●</span>Connecté · <strong class="connect-person"></strong></span><span class="connect-level">Niveau <strong></strong></span><span class="connect-meter"><span class="connect-earned"></span><span class="connect-track"><span class="connect-fill"></span></span></span>';
      row.append(profile);
    }
    const strip=doc.getElementById('mathasTrophiesStrip');
    if(strip&&!doc.getElementById('mathas-native-connect-xp')){
      const button=doc.createElement('button');
      button.type='button';button.id='mathas-native-connect-xp';
      button.textContent='✨ XP à gagner';
      button.setAttribute('aria-label','Afficher les XP acquis et à gagner');
      button.setAttribute('aria-expanded','false');
      button.addEventListener('click',()=>{
        const toggle=host.getElementById('xp-toggle');
        if(!toggle||host.getElementById('connect-bar')?.hidden)return;
        toggle.click();
        button.setAttribute('aria-expanded',toggle.getAttribute('aria-expanded')||'false');
      });
      strip.insertAdjacentElement('afterend',button);
    }
    const profile=doc.getElementById('mathas-native-connect-profile');
    const button=doc.getElementById('mathas-native-connect-xp');
    const available=!host.getElementById('connect-bar')?.hidden;
    if(profile){
      profile.hidden=!available;
      if(available){
        profile.querySelector('.connect-person').textContent=host.getElementById('connected-name')?.textContent||'Élève';
        profile.querySelector('.connect-level strong').textContent=host.getElementById('level')?.textContent||'—';
        profile.querySelector('.connect-earned').textContent=host.getElementById('level-xp')?.textContent||'— / — XP';
        profile.querySelector('.connect-fill').style.width=host.getElementById('level-fill')?.style.width||'0%';
      }
    }
    if(button){
      button.hidden=!available;
      button.setAttribute('aria-expanded',host.getElementById('xp-toggle')?.getAttribute('aria-expanded')||'false');
    }
  };
  ticker=setInterval(update,400);
  update();
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
    .mathas-top-actions{
      position:relative!important;display:grid!important;
      grid-template-columns:128px 158px!important;grid-auto-rows:minmax(42px,auto)!important;
      column-gap:9px!important;row-gap:9px!important;width:295px!important;
      align-items:start!important;
    }
    .mathas-top-actions > #fullscreenBtn,
    .mathas-top-actions > #fullBtn{grid-column:2!important;grid-row:1!important}
    .mathas-top-actions > .theme-toggle-btn,
    .mathas-top-actions > #themeBtn{grid-column:2!important;grid-row:2!important}
    .mathas-top-actions > #mathas-game-hub-return{
      position:static!important;grid-column:1!important;grid-row:1!important;
      align-self:stretch!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;
      box-sizing:border-box!important;min-height:42px!important;width:128px!important;
      max-width:128px!important;padding:7px 7px!important;border-radius:10px!important;
      background:#204664!important;color:#f4faff!important;
      border:1px solid #79a5c7!important;box-shadow:0 4px 8px #0006!important;
      text-decoration:none!important;white-space:nowrap!important;
      font:700 12px system-ui,sans-serif!important;z-index:10100!important;
    }
    .mathas-top-actions > #mathas-game-hub-return:focus-visible{
      outline:3px solid #ffe38b!important;outline-offset:2px!important;
    }
    @media(max-width:920px){
      .mathas-top-actions{grid-template-columns:116px 142px!important;width:267px!important}
      .mathas-top-actions > #mathas-game-hub-return{width:116px!important;max-width:116px!important}
    }
    @media(max-width:560px){
      .mathas-top-cluster{gap:7px!important}
      .mathas-top-cluster .mathas-wordmark{width:65px!important;max-width:65px!important}
      .mathas-top-actions{grid-template-columns:96px 126px!important;column-gap:6px!important;width:228px!important;grid-auto-rows:minmax(40px,auto)!important}
      .mathas-top-actions > #mathas-game-hub-return{
        width:96px!important;max-width:96px!important;font-size:10px!important;padding:5px!important;min-height:40px!important;
      }
    }
  `;
  doc.head.append(style);
  actions.insertBefore(link,fullscreen);
  installEmbeddedConnectHud(frame);
 }
 window.MathasAttachNativeHubLink=function(frame){
  if(!frame)return;
  // Navigation requires a real click; scripts may never auto-navigate the top page.
  frame.sandbox?.add('allow-top-navigation-by-user-activation');
  frame.addEventListener('load',()=>install(frame));
  try{install(frame)}catch{}
 };
})();
