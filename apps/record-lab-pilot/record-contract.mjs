// Contrat candidat pour les cinq jeux « Objectif record ».
// N'active aucune attribution : droits vérifiés et transactions sont exclusivement serveur.
// Ce fichier est volontairement indépendant des fonctions de production.
export const LAB_CLASS_ID='4bf3400d-a315-4ea4-a2f3-afaca24dc9b9';
export const GAME_KEYS=Object.freeze([
  'addition-ecrite-simple','addition-ecrite-multiple','soustraction-ecrite-simple',
  'multiplication-ecrite-simple','melange-calculs-ecrits'
]);
export const MODES=Object.freeze(['classic','three-lives','sudden']);

export function validateLabContext(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_request');
  if(input.classId!==LAB_CLASS_ID)throw Error('not_lab_class');
  if(!GAME_KEYS.includes(input.appKey))throw Error('app_not_approved');
  if(!MODES.includes(input.mode))throw Error('invalid_mode');
  if(input.approved!==true||input.sessionVerified!==true||input.studentVerified!==true)
    throw Error('approved_student_required');
  if(input.appKey==='melange-calculs-ecrits'){
    const ops=input.operationsSelectedAtStart;
    if(!Array.isArray(ops)||ops.length<1||ops.length>3||
       new Set(ops).size!==ops.length||ops.some(v=>!['add','sub','mul'].includes(v)))
      throw Error('invalid_operations');
  }
  return true;
}

function validCredit(n) {
  if(!Number.isSafeInteger(n)||n<0||n>100000)throw Error('invalid_credit');
  return n;
}

// Les valeurs fullCredit et priorAwarded viennent d'une règle/lecture serveur validée.
// Aucun montant calculé depuis le DOM ni aucun pourcentage basé sur le score seul.
export function computeComplement({mode,fullCredit,priorAwarded}) {
  const full=validCredit(fullCredit),prior=validCredit(priorAwarded);
  if(prior>full)throw Error('inconsistent_prior_credit');
  if(mode!=='three-lives'&&mode!=='sudden')throw Error('invalid_mode');
  const entitled=mode==='three-lives'?Math.floor(full/2):full;
  return Object.freeze({entitled,delta:Math.max(0,entitled-prior),nextAwarded:Math.max(prior,entitled)});
}

// Réservé au classement de la même app. Le +20% NE change ni XP ni trophées.
// La comparaison et l'admissibilité des scores entre modes restent à valider
// pédagogiquement avant toute activation serveur.
export function candidateRankPoints({mode,basePoints}) {
  const points=validCredit(basePoints);
  if(!MODES.includes(mode))throw Error('invalid_mode');
  return mode==='sudden'?Math.floor(points*6/5):points;
}

// Vérifie uniquement la politique de calcul, pas l'authentification réelle ni
// l'idempotence de la transaction. L'API devra vérifier les preuves de fin.
export function validateThreeLivesEvidence({heartsStart,wrongCompleted,endingHearts,finished,attempts}) {
  if(heartsStart!==3||!Number.isSafeInteger(wrongCompleted)||wrongCompleted<0||wrongCompleted>3)
    throw Error('invalid_hearts');
  if(endingHearts!==3-wrongCompleted)throw Error('invalid_hearts');
  if(finished!==true||wrongCompleted!==3||endingHearts!==0)throw Error('unfinished_session');
  if(!Array.isArray(attempts)||attempts.length<3||attempts.length>10000)
    throw Error('invalid_attempts');
  const seen=new Set();
  let wrong=0;
  for(const attempt of attempts){
    if(!Number.isSafeInteger(attempt?.index)||attempt.index<0||seen.has(attempt.index))
      throw Error('duplicate_or_invalid_attempt');
    seen.add(attempt.index);
    if(attempt.complete!==true)throw Error('incomplete_attempt');
    if(typeof attempt.correct!=='boolean')throw Error('invalid_attempt');
    if(!attempt.correct)wrong++;
  }
  if(wrong!==3)throw Error('invalid_wrong_count');
  return true;
}
