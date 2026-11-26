/* Tests reproductibles : node tests/engine.cjs
   Moteur exact du fichier livré, avec DOM minimal simulé (pas un test navigateur). */
const fs=require("node:fs"),path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const stub='const store=new Map();const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};const nodes=new Map();const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,querySelector:()=>null,querySelectorAll:()=>[],innerHTML:""});return nodes.get(id)}};const confirm=()=>true;';
const checks=''+
'const results=[];const assert=(x,m)=>{if(!x)throw Error(m);results.push(m)};'+
'render=()=>checkpoint();renderResult=()=>{};function reset(){progress=blank();safeRemove(RUNKEY);run=null;practice=false}'+
'function correctPage(){for(const q of pageItems())q.answer=fmt(q.n/2);validate();assert(run.checked,"page validée");validate()}'+
'for(const id of ORDER){for(let j=0;j<100;j++){const qs=questions(id,LEVELS[id].total);if(qs.length!==LEVELS[id].total||new Set(qs.map(x=>x.n)).size!==qs.length||qs.some(q=>q.n<1||q.n>200||q.n%2||parse10(fmt(q.n/2))!==q.n/2))throw Error("génération "+id)}}'+
'assert(parse10("1,8")===18&&parse10("1.80")===18&&parse10("1.81")===null&&parse10("")===null,"saisie exacte");'+
'reset();assert(!unlocked("odd"),"verrou initial");start("even");correctPage();correctPage();assert(!unlocked("odd"),"une réussite ne suffit pas");start("even");correctPage();correctPage();assert(unlocked("odd")&&progress.cups.even,"deux séries parfaites débloquent et donnent la coupe");'+
'start("odd");const qs=pageItems();for(const q of qs)q.answer=fmt(q.n/2);qs[0].answer="99";validate();assert(run.correct===4&&!run.checked,"premier essai faux conservé");qs[0].answer=fmt(qs[0].n/2);validate();assert(run.correct===4&&run.checked,"correction sans crédit supplémentaire");validate();correctPage();assert(scores("odd")[0].score===90,"score 90%");'+
'start("odd");helpToggle(0,"manip");removeUnit(0,1);assert(run.q[0].removed===1&&!run.q[0].clean,"manipulation suivie");correctPage();correctPage();assert(passing("odd")&&!progress.cups.odd,"aide permet progression mais pas coupe");'+
'const prior=JSON.stringify(progress);practice=true;start("decimal");helpToggle(0,"decomp");helpToggle(0,"manip");removeUnit(0,1);assert(equation(run.q[0],0).includes("branchArrow")&&equation(run.q[0],0).includes("partB"),"deux branches dans la même équation");correctPage();correctPage();assert(JSON.stringify(progress)===prior,"mode test isolé");'+
'practice=true;start("g3");let q=current();assert(!diagram(q,true).includes(fmt(q.n)+" cm"),"mesure cachée");selectTick(q.n);assert(q.measure===""&&q.measureTick===q.n,"graduation ne remplit pas la mesure");q.measure=fmt(q.n);validate();assert(q.stage==="calc"&&q.measureKnown,"mesure correcte");q.answer=fmt(q.n/2);validate();assert(q.stage==="place","calcul correct");selectTick(q.n/2);assert(q.done&&run.correct===1,"milieu correct");validate();assert(run.index===1,"segment suivant");'+
'q=current();q.measure=fmt(q.n);validate();assert(q.first===null,"choix de graduation manquant non pénalisé");selectTick(q.n<200?q.n+1:q.n-1);validate();assert(q.first===false&&q.stage==="measure","graduation erronée refusée");selectTick(q.n);q.measure=fmt(q.n);validate();q.answer=fmt(q.n/2);validate();selectTick(q.n/2);assert(run.correct===1&&q.done,"correction segment non comptée deux fois");'+
'start("g3","sudden");q=current();assert(!helpAllowed(),"aucune aide mathématique en défi");selectTick(q.n);q.measure=fmt(q.n);validate();q.answer="99";validate();assert(run.finished&&run.lives===0,"mort subite dès première erreur");'+
'start("g3","lives");for(let i=0;i<3;i++){q=current();selectTick(q.n);q.measure="99";validate();if(i<2){assert(run.lives===2-i&&!run.finished,"vie retirée une fois");validate()}}assert(run.finished&&run.lives===0,"troisième erreur termine");'+
'start("g3","lives");for(let i=0;i<3;i++){q=current();selectTick(q.n);q.measure=fmt(q.n);validate();q.answer=fmt(q.n/2);validate();selectTick(q.n/2);validate()}assert(run.correct===3&&run.lives===3&&run.index===3,"série illimitée");const resumed=safeGet(RUNKEY);assert(validRun(resumed)&&resumed.index===3,"reprise locale");'+
'return results;';
const results=new Function(stub+code.replace(/showHome\(\);\s*$/,"")+checks)();
console.log("6500 questions générées ; "+results.length+" contrôles réussis.");
