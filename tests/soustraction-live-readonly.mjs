// Smoke en LECTURE SEULE du site réellement déployé : aucun compte, aucune écriture.
import assert from 'node:assert/strict';
import {assertTeacherLaunchSource,inspectSubtractionCatalogue} from './soustraction-live-contract.mjs';

const SITE='https://mr-tat.github.io/Mathas-Connect/';
const API='https://awmhpfofacaglewammxt.supabase.co/functions/v1/';
const SUB='soustraction-ecrite-simple';
const catalogues=[],jwtStatuses=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function retry(url,check,label){
 let last;
 for(let attempt=0;attempt<7;attempt++){
  try{
   const response=await fetch(url+(url.includes('?')?'&':'?')+'smoke='+Date.now(),{headers:{'cache-control':'no-cache'}});
   if(!response.ok)throw Error('HTTP '+response.status);
   await check(response);
   console.log('OK '+label);return;
  }catch(error){last=error;if(attempt<6)await sleep(4000)}
 }
 throw Error(label+': '+last?.message);
}
await retry(SITE+'apps/soustraction-simple/',async r=>{
 const html=await r.text();
 assert.match(html,/Math.as.*Soustraction/i);
 assert.match(html,/game-original\.html/);
 assert.match(html,/connect-results/);
},'lanceur Soustraction publié');

await retry(SITE+'apps/soustraction-simple/game-original.html',async r=>{
 const source=await r.text();
 assert.ok(source.length>600000);
 assert.match(source,/soustraction_classic20_v6/);
},'moteur fidèle publié');

await retry(SITE+'assets/miniatures/soustraction-ecrite-simple.webp',async r=>{
 const buffer=Buffer.from(await r.arrayBuffer());
 assert.ok(buffer.length>1500&&buffer.length<40000);
 assert.equal(buffer.toString('ascii',0,4),'RIFF');
 assert.equal(buffer.toString('ascii',8,12),'WEBP');
},'miniature légère publiée');

await retry(SITE+'app.js',async r=>{
 const code=await r.text();
 assertTeacherLaunchSource(code);
},'lien test Monsieur T publié dans GLOBAL');

for(const space of ['observation','phase1','phase2','2eco']){
 const response=await fetch(API+'connect-catalog?space='+space,{headers:{'cache-control':'no-cache'}});
 assert.equal(response.status,200,'catalogue '+space);
 const data=await response.json();
 const {visible}=inspectSubtractionCatalogue(data,space,SITE);
 catalogues.push({space,subtractionVisible:visible,mixedVisible:data.apps.some(app=>app.app_key==='melange-calculs-ecrits')});
 // Visibility is the teacher's current GLOBAL setting, not a permanent
 // pre-release condition. Public catalogue and JWT checks stay read-only.
 console.log('OK HUB '+space+' : Soustraction '+(visible?'visible, destination valide':'masquée par le catalogue'));
}
for(const token of ['', 'Bearer completely_invalid_test_token']){
 const headers={'content-type':'application/json'};
 if(token)headers.authorization=token;
 const response=await fetch(API+'connect-results',{method:'POST',headers,
  body:JSON.stringify({action:'student-load',appKey:SUB,classId:'11111111-1111-4111-8111-111111111111'})});
 assert.ok([401,403].includes(response.status),
  'la fonction doit rejeter la requête sans vrai JWT (HTTP '+response.status+')');
 jwtStatuses.push(response.status);
 console.log('OK JWT absent/invalide refusé : '+response.status);
}
console.log('SITE_PUBLIE_ET_ACCES_NON_AUTORISES_VERIFIES');
// Only public catalogue flags and anonymous HTTP codes: no pupil or session data.
console.log('::notice title=Public read-only smoke::'+JSON.stringify({catalogues,jwtStatuses}));
