import {createXpHints} from './xp-hints.mjs';

// These are visual account presets, never authentication or server results.
if(new URLSearchParams(location.search).get('connect')!=='1'&&(window.MATHAS_ABAQUE_ENV?.laboratory===true||new URLSearchParams(location.search).get('demo')==='1')){
 const hints=createXpHints({simulation:true});
 const notice=document.querySelector('.demo-notice'),originalNotice=notice.textContent;
 const bar=document.createElement('div');bar.id='abaque-demo-controls';bar.className='demo-controls';
 const label=document.createElement('label');label.htmlFor='abaque-demo-state';label.textContent='Simulation';
 const select=document.createElement('select');select.id='abaque-demo-state';select.setAttribute('aria-label','État du compte simulé');
 for(const [value,text] of [['signed-out','Pas connecté'],['connected','Connecté'],['collected','Connecté — tout récupéré']]){
  const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
 }
 bar.append(label,select);document.querySelector('header').insertBefore(bar,document.querySelector('.headerBtns'));

 function scenario(collected){
  const stage=(passes,score)=>({passes,passScores:[score,score],failed:false,failedScore:null,best:score});
  const state={
   stage1:stage(collected?['green','green']:['orange','orange'],collected?12:10),
   stage2:stage(collected?['green','green']:['orange','orange'],collected?8:7),
   modes:{one:'green',three:collected?'green':'orange',five:collected?'green':'orange',sudden:collected?'green':null},
   modeScores:{one:4,three:collected?12:10,five:collected?20:16},
   recordsByMode:{one:100,three:collected?324:266,five:collected?580:448,lives:collected?282:0,sudden:collected?260:0},
   suddenBest:collected?8:0,
   scoreRecords:{dayDate:'',dayBest:0,dayMode:'',allBest:collected?580:448,allMode:'five',medals:[]}
  };
  return {state,trophies:collected?['bronze','silver','gold','sudden-bronze','sudden-silver','sudden-gold']:[],
   remaining:collected?{build:0,moves:0,one:0,three:0,five:0,lives:0,sudden:0}:{build:6,moves:6,one:0,three:10,five:12,lives:16,sudden:32}};
 }
 function apply(){
  const mode=select.value;
  for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
  const home=document.getElementById('homeBtn');if(!home.classList.contains('hidden'))home.click();
  document.documentElement.dataset.abaqueDemoState=mode;
  if(mode==='signed-out'){
   window.MATHAS_PROGRESS.setDemoPreview(null);hints.hide();notice.textContent=originalNotice;
  }else{
   const preview=scenario(mode==='collected');window.MATHAS_PROGRESS.setDemoPreview(preview);
   hints.render(preview.remaining,true);
   notice.textContent='🧪 Laboratoire · connexion simulée · XP fictifs · aucun résultat Connect. Profil d’aperçu non enregistré.';
  }
 }
 select.addEventListener('change',apply);apply();
}
