import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const text=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const hub=JSON.parse(text('../hub-catalog.json'));
const sql=text('../supabase/migrations/20261028_soustraction_connect_v1.sql');
const app=text('../app.js'),html=text('../index.html'),css=text('../style.css');
const file=new URL('../assets/miniatures/soustraction-ecrite-simple.webp',import.meta.url);
test('miniature originale Soustraction: fichier WebP autonome et moins de 40 Ko',()=>{
 const data=readFileSync(file);
 assert.ok(data.length>1500 && data.length<40000,'taille WebP adaptée aux PC de classe');
 assert.equal(data.toString('ascii',0,4),'RIFF');
 assert.equal(data.toString('ascii',8,12),'WEBP');
});
test('la même miniature est référencée dans le HUB, le prof et la migration SQL',()=>{
 const local='./assets/miniatures/soustraction-ecrite-simple.webp';
 const global='https://mr-tat.github.io/Mathas-Connect/assets/miniatures/soustraction-ecrite-simple.webp';
 const entry=hub.apps.find(x=>x.app_key==='soustraction-ecrite-simple');
 assert.equal(entry.image_url,local);
 assert.ok(app.includes("'soustraction-ecrite-simple':'"+local+"'"));
 assert.ok(sql.includes("'"+global+"'"));
});
test('le dernier GLOBAL n’est pas remplacé par l’ancien pendant l’intégration',()=>{
 assert.ok(html.includes('data-matrix-clear-day="observation"'));
 assert.ok(html.includes('data-matrix-clear-day="phase1"'));
 assert.ok(html.includes('data-matrix-clear-day="phase2"'));
 assert.ok(html.includes('data-matrix-clear-day="2eco"'));
 assert.ok(app.includes("teacher-matrix-action"));
 assert.ok(app.includes("teacher-matrix-order-ok"));
 assert.ok(css.includes("teacher-app-scroll"));
 assert.ok(css.includes("teacher-matrix-app-link"));
 assert.ok(html.includes('<option value="soustraction-ecrite-simple">Soustraction écrite</option>'));
});
test('le mode HOLD de Soustraction demeure invisible avant activation serveur',()=>{
 assert.ok(sql.includes("'soustraction-ecrite-simple','Soustraction écrite'"));
 assert.ok(sql.includes("false,'calculs_ecrits',false,30"));
 assert.ok(sql.includes("'soustraction-ecrite-simple','calculs_ecrits',30,false,false"));
});

test('tableau professeur : Soustraction utilise un indicateur défini et ses deux méthodes',()=>{
 const start=app.indexOf('function showOverviewDetail('),end=app.indexOf('async function showResults()',start);
 assert.ok(start>=0 && end>start);
 const detail=app.slice(start,end);
 assert.match(detail,/const isSubtraction=app\.app_key==='soustraction-ecrite-simple'/);
 assert.match(detail,/isSubtraction\?\['Mort subite · Compensation','Mort subite · Emprunt direct'\]/);
 assert.match(detail,/\['addBottom','takeTop'\]\.map\(m=>state\.suddenMethods/);
 assert.ok(app.includes("'Soustraction':'Multiplication')+' écrite (sauvegarde rev."));
});
