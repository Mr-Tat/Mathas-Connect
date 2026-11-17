import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VERSION,judgeCompletion,conversionPoints,recordPoints} from '../apps/GRAN-abaque-m-1/connect/completion-contract.mjs';
const r=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='e2e42645-6c22-40cc-9a89-2a6c9f1a5c44';
const good=(extra={})=>({from:'m',to:'cm',source:2,answer:200,manip:false,units:false,...extra});
const proof=(kind,tasks,version=3,completed=true)=>({
 version,eventId:id,expectedResetEpoch:0,kind,units:[],images:[],tasks,completed,master:false,
 ...(completed?{}:{abandoned:true})
});
test('V3 : 1 page manipulation automatique gratuite (3 points), abaque -1 (2 points), XP inchangés sauf abaque',()=>{
 assert.equal(VERSION,4);
 assert.equal(conversionPoints('one',{manip:true},3),3);
 assert.equal(conversionPoints('one',{manip:true,units:true},3),2);
 assert.equal(conversionPoints('one',{manip:true},2),2,'ancienne preuve V2 stable');
 assert.equal(conversionPoints('one',{manip:true,units:true},2),1,'ancienne preuve V2 stable');
 const clean=judgeCompletion(proof('one',Array.from({length:4},()=>good({manip:true}))));
 assert.equal(clean.points,12);assert.equal(clean.assisted,false);
 assert.equal(clean.cleanPerfect,true);
 assert.deepEqual(clean.resultDots,['blue','blue','blue','blue']);
 const withAbacus=judgeCompletion(proof('one',[good({manip:true,units:true}),...Array.from({length:3},()=>good({manip:true}))]));
 assert.equal(withAbacus.points,11);assert.equal(withAbacus.assisted,true);assert.equal(withAbacus.cleanPerfect,false);
 assert.equal(judgeCompletion(proof('one',[good({manip:true,units:true}),...Array.from({length:3},()=>good({manip:true}))],2)).points,7);
});
test('V3 : 3/5 pages et 3 vies conservent 3 / 2 / 1 ; Mort subite 6 / 4 / 2',()=>{
 for(const k of ['three','five','lives']){
  assert.equal(conversionPoints(k,{},3),3);
  assert.equal(conversionPoints(k,{manip:true},3),2);
  assert.equal(conversionPoints(k,{manip:true,units:true},3),1);
 }
 assert.deepEqual([{}, {manip:true},{manip:true,units:true}].map(h=>conversionPoints('sudden',h,3)),[6,4,2]);
 const clean=judgeCompletion(proof('three',Array.from({length:12},()=>good())));
 assert.equal(clean.cleanPerfect,true);assert.equal(clean.assisted,false);
 const helped=judgeCompletion(proof('five',Array.from({length:20},(_,i)=>i===7?good({manip:true}):good())));
 assert.equal(helped.firstTry,20);assert.equal(helped.cleanPerfect,false);assert.equal(helped.assisted,true);
 const sudden=judgeCompletion(proof('sudden',[good({manip:true,units:true}),good({answer:0})]));
 assert.equal(sudden.cleanRecord,false);assert.equal(sudden.points,2);
 const suddenClean=judgeCompletion(proof('sudden',[good(),good({answer:0})]));
 assert.equal(suddenClean.cleanRecord,true);assert.equal(suddenClean.points,6);
 assert.equal(recordPoints('sudden',50,3),300);
});
test('V1/V2 historiques : scores, assistances et format du reçu inchangés',()=>{
 const v1=judgeCompletion(proof('one',Array.from({length:4},()=>good({manip:true})),1));
 const v2=judgeCompletion(proof('one',Array.from({length:4},()=>good({manip:true})),2));
 assert.equal(v1.points,8);assert.equal(v2.points,8);
 assert.equal('assisted' in v1,false);assert.equal(v2.assisted,true);
 assert.equal('cleanPerfect' in v1,false);assert.equal('cleanPerfect' in v2,false);
});
test('Aucune coupe supplémentaire à partir des XP ou de l’ancien score ; acquisitions déjà présentes intactes',()=>{
 const sql=r('supabase/migrations/20261116213000_abaque_helpers_confirmation_clean_trophies_v3.sql').replaceAll("''","'");
 const html=r('apps/GRAN-abaque-m-1/index.html');
 assert.match(sql,/cleanPerfect,one/);
 assert.match(sql,/cleanPerfect,three/);
 assert.match(sql,/cleanPerfect,five/);
 assert.match(sql,/cleanRecord/);
 assert.match(sql,/NOT IN \('1','2','3'\)/);
 assert.match(sql,/ON CONFLICT DO NOTHING|IF first_good>=threshold/);
 assert.doesNotMatch(sql,/DELETE FROM|DROP TABLE|TRUNCATE TABLE/);
 assert.match(html,/if\(clean&&correct===total\)data\.cleanPerfect\[key\]=true/);
 assert.match(html,/if\(clean\)data\.suddenCleanBest=/);
 assert.match(html,/Les aides gratuites restent facultatives/);
 assert.match(html,/runUsedHelp=false/);
 assert.match(html,/recordMode\(selectedMode,runCorrect,total,runDots,!runUsedHelp\)/);
 assert.match(html,/recordSudden\(suddenStreak,!runUsedHelp\)/);
 const bridge=r('apps/GRAN-abaque-m-1/connect/native-bridge.js');
 assert.match(bridge,/version:4/);
});
test('L’aide a une confirmation annulable, deux zones séparées et disparaît à la validation',()=>{
 const h=r('apps/GRAN-abaque-m-1/index.html');
 for(const s of ['t3HelpConfirm','t3ConfirmCancel','t3ConfirmOk','t3AbacusZone','Afficher l’abaque',
  't3UnitLabels','t3Movement','unitPromptActive','t3HelpFinished','helpValidated=true'])
  assert.ok(h.includes(s),s);
 assert.match(h,/ex\.units=true;ex\.usedUnits=true/);
 assert.match(h,/runUsedHelp=true/);
 assert.match(h,/width:172px/);
});

test('Les scripts intégrés à la page sont syntaxiquement valides avant publication',()=>{
 const html=r('apps/GRAN-abaque-m-1/index.html');
 const scripts=[...html.matchAll(new RegExp('<script[^>]*>([^]*?)</script>','g'))].map(m=>m[1].trim()).filter(Boolean);
 assert.ok(scripts.length>=2);
 for(const [index,script] of scripts.entries())assert.doesNotThrow(()=>new Function(script),'script '+index);
});

test('Les arcs sont liés à la virgule, les unités de l’abaque restent fixes et les grandes flèches peuvent être réactivées',()=>{
 const h=r('apps/GRAN-abaque-m-1/index.html');
 assert.match(h,/t3Board"><div class="t3Movement" aria-hidden="true"><\/div><div class="t3Digits"/);
 assert.match(h,/t3Abacus hidden" aria-label="Abaque métrique fixe"><div class="t3UnitLabels hidden"><\/div><\/div>/);
 assert.match(h,/const SHOW_ABACUS_CORRESPONDENCE_ARROWS=false;/);
 assert.match(h,/function drawUnitCorrespondences\(article\)/);
 assert.match(h,/if\(!SHOW_ABACUS_CORRESPONDENCE_ARROWS\)/);
 assert.match(h,/if\(!SHOW_ABACUS_CORRESPONDENCE_ARROWS\)return;/);
 assert.match(h,/\.t3Board \.t3Movement\{/);
 assert.doesNotMatch(h,/\.t3Abacus \.t3Movement\{/);
 assert.doesNotMatch(h,/if\(ex\.units\)\[\.\.\.headers\.children\]\.forEach/);
});

test('Activité 2 : multiplier ou diviser par dix fois chaque déplacement, sans modifier le barème',()=>{
 const h=r('apps/GRAN-abaque-m-1/index.html');
 assert.match(h,/const factor=String\(10\*\*Math\.abs\(n\)\)/);
 assert.match(h,/const operation=n>0\?'×':'÷'/);
 assert.match(h,/class="moveOperation"/);
 assert.match(h,/\$\{operation\} \$\{factor\}.*<strong>\$\{Math\.abs\(n\)\}/);
 assert.match(h,/\.moveLineTop \.moveOperation\{/);
 assert.match(h,/color:var\(--moveColor\)/);
});
test('Abaque : les cases migrent à gauche, les unités à droite ont une largeur accrue',()=>{
 const h=r('apps/GRAN-abaque-m-1/index.html');
 assert.match(h,/grid-template-columns:minmax\(340px,1fr\) clamp\(262px,19vw,280px\) 120px/);
 assert.match(h,/\.t3BoardScroll \.t3Board\{\s*margin-left:0!important;margin-right:0!important/);
 assert.match(h,/\.t3AbacusZone\{\s*width:100%!important;max-width:280px!important/);
 assert.match(h,/\.t3Abacus \.t3UnitLabel\{\s*height:42px!important;font-size:\.8rem!important/);
 assert.match(h,/width:min\(310px,100%\)!important/);
 assert.match(h,/const SHOW_ABACUS_CORRESPONDENCE_ARROWS=false/);
});
