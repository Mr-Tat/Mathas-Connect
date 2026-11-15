// L'ouverture Connect reste toujours contrôlée par un secret serveur explicite.
// « pilot » : uniquement TEST ; « open » : classes activées dans connect_abaque_classes.
// Sur un autre projet Supabase, « open » ne doit jamais ouvrir une classe par erreur.
// « closed » ou une valeur inconnue prime toujours ; l'absence de secret ouvre seulement les classes activées côté SQL, sur le projet officiel.
const CONNECT_HOST='awmhpfofacaglewammxt.supabase.co';
export function resolveAbaqueAccess(setting, projectUrl){
 if(setting==='closed'||(setting!=null&&!['pilot','open'].includes(setting)))return 'closed';
 let match=false;
 try{match=new URL(projectUrl).hostname===CONNECT_HOST;}catch{}
 if(setting==='open')return match?'open':'closed';
 if(setting==='pilot')return 'pilot';
 return match?'open':'closed';
}
