// Données exclusivement relues depuis les fonctions serveur d'autorisations.
// Ne jamais utiliser les cases modifiées mais pas encore enregistrées.
export function summarizeSavedAuthorizations({multipliers=[],aids=[],studentId=null}={}){
 const student=typeof studentId==='string'&&studentId.length>0;
 const find=(rows,scope)=>Array.isArray(rows)?rows.find(row=>row?.scope_key===scope):null;
 const ownMult=find(multipliers,student?studentId:'class');
 const inheritedMult=student?find(multipliers,'class'):null;
 const ownAid=find(aids,student?studentId:'class');
 const inheritedAid=student?find(aids,'class'):null;
 const effectiveMult=ownMult??inheritedMult;
 const effectiveAid=ownAid??inheritedAid;
 const values=Array.isArray(effectiveMult?.multipliers)
  ?[...new Set(effectiveMult.multipliers.filter(n=>Number.isInteger(n)&&n>=2&&n<=9))].sort((a,b)=>a-b):[];
 const multText=values.length?values.join(', ')+' obligatoires':'Aucun multiplicateur imposé';
 const tablesText=effectiveAid?.allowed===false?'Tables interdites':'Tables autorisées';
 const multSource=ownMult?(student?'élève':'classe'):inheritedMult?'classe':'défaut';
 const aidSource=ownAid?(student?'élève':'classe'):inheritedAid?'classe':'défaut';
 const source=!student?'Classe'
  :multSource===aidSource
   ?(multSource==='élève'?'Propre à l’élève':multSource==='classe'?'Hérité de la classe':'Par défaut')
   :'Mult. '+multSource+' / Tables '+aidSource;
 return multText+' · '+tablesText+' · '+source;
}
