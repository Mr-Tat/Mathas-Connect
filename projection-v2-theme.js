/* Thèmes de la projection V2 connectée.
   Uniquement du DOM et une préférence visuelle locale :
   aucun appel à Supabase, aucun traitement de score ou de données élève. */
(function(){
 'use strict';
 const STORAGE_KEY='mathas_projection_v2_theme';
 const DEFAULT_THEME='neon';
 const ALLOWED_THEMES=new Set(['neon','papier','ardoise','studio']);
 const valid=value=>ALLOWED_THEMES.has(value)?value:null;
 const fromUrl=()=>{
  try{return valid(new URLSearchParams(window.location.search).get('theme'))}
  catch{return null}
 };
 const fromStorage=()=>{
  try{return valid(window.localStorage.getItem(STORAGE_KEY))}
  catch{return null}
 };
 const remember=theme=>{
  try{window.localStorage.setItem(STORAGE_KEY,theme)}catch{/* navigation privée : choix temporaire */}
 };
 function apply(theme){
  if(!valid(theme))return false;
  document.documentElement.setAttribute('data-proj-da',theme);
  const select=document.getElementById('projection-theme');
  if(select)select.value=theme;
  remember(theme);
  return true;
 }
 // URL explicite > préférence de ce navigateur > valeur par défaut.
 const initial=fromUrl()||fromStorage()||DEFAULT_THEME;
 apply(initial);
 function attach(){
  const select=document.getElementById('projection-theme');
  if(!select)return;
  select.value=document.documentElement.getAttribute('data-proj-da')||initial;
  select.addEventListener('change',()=>{
   const selected=valid(select.value);
   if(selected)apply(selected);
   else select.value=document.documentElement.getAttribute('data-proj-da')||initial;
  });
 }
 if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',attach,{once:true});
 }else attach();
})();
